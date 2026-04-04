import { type ChildProcess, spawn } from "node:child_process";
import { type Readable } from "node:stream";
import { intro, log, outro, spinner } from "@clack/prompts";
import { Command, InvalidArgumentError } from "commander";

const DEFAULT_PORT = "3003";
const DEFAULT_LOCAL_HOST = "127.0.0.1";
const PUBLIC_URL_PATTERN = /https?:\/\/[^\s]+/;
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";
const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";

type Options = {
  port: string;
  localHost: string;
  host?: string;
  subdomain?: string;
  tunnelOnly: boolean;
};

const getScriptInvocation = () => {
  if (process.env.npm_lifecycle_event === "tunnel:appview") {
    return "npm run tunnel:appview --";
  }

  if (process.env.npm_lifecycle_event === "dev") {
    return "npm run dev --";
  }

  return "npm run dev:tunnel --";
};

const parsePort = (value: string) => {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError("Port must be a number.");
  }

  return value;
};

const onLines = (stream: Readable, handler: (line: string) => void) => {
  let buffer = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      handler(line);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      handler(buffer);
    }
  });
};

const buildTunnelArgs = (options: Options) => {
  const args = [
    "--yes",
    "localtunnel",
    "--port",
    options.port,
    "--local-host",
    options.localHost,
  ];

  if (options.host) {
    args.push("--host", options.host);
  }

  if (options.subdomain) {
    args.push("--subdomain", options.subdomain);
  }

  return args;
};

const maybeExtractUrl = (text: string) => {
  return text.match(PUBLIC_URL_PATTERN)?.[0];
};

const logTunnelDomain = (domain: string) => {
  log.info(`APPVIEW_DOMAIN=${domain}`);
  log.info(`GUESTBOOK_APPVIEW_DOMAIN=${domain}`);
};

const program = new Command()
  .name(getScriptInvocation())
  .usage("[options]")
  .description(
    "Start localtunnel for the AppView and optionally launch the repo dev stack with the tunnel domain exported."
  )
  .showHelpAfterError()
  .option("-p, --port <port>", "Local AppView port to expose", parsePort, DEFAULT_PORT)
  .option(
    "-l, --local-host <host>",
    "Local host for the AppView",
    DEFAULT_LOCAL_HOST
  )
  .option("-h, --host <url>", "Localtunnel server host")
  .option("-s, --subdomain <name>", "Requested localtunnel subdomain")
  .option("--tunnel-only", "Start the tunnel without launching the dev stack");

program.parse(process.argv);
const options = program.opts<Options>();

const tunnelStatus = spinner();
const tunnel = spawn(NPX_COMMAND, buildTunnelArgs(options), {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

if (!tunnel.stdout || !tunnel.stderr) {
  throw new Error("Localtunnel process did not expose stdout/stderr pipes.");
}

let devServer: ChildProcess | undefined;
let shutdownStarted = false;
let launched = false;

intro("Guestbook Tunnel");
tunnelStatus.start(
  `Starting localtunnel for AppView on http://${options.localHost}:${options.port}`
);

const shutdown = (signal: NodeJS.Signals = "SIGTERM") => {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  if (devServer && !devServer.killed) {
    devServer.kill(signal);
  }

  if (!tunnel.killed) {
    tunnel.kill(signal);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const launchDevServer = (publicUrl: string) => {
  if (launched) {
    return;
  }

  launched = true;

  const domain = new URL(publicUrl).host;
  tunnelStatus.stop(`Tunnel ready at ${publicUrl}`);
  logTunnelDomain(domain);

  if (options.tunnelOnly) {
    outro("Tunnel is running. Press Ctrl+C to stop it.");
    return;
  }

  log.step("Launching Astro site, AppView, and ingestor with the tunnel domain.");

  devServer = spawn(NPM_COMMAND, ["run", "dev:stack"], {
    stdio: "inherit",
    env: {
      ...process.env,
      APPVIEW_DOMAIN: domain,
      GUESTBOOK_APPVIEW_DOMAIN: domain,
    },
  });

  devServer.on("exit", (code, signal) => {
    if (!shutdownStarted) {
      shutdown(signal ?? "SIGTERM");
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    outro("Dev processes stopped.");
    process.exit(code ?? 0);
  });
};

onLines(tunnel.stderr, (line) => {
  log.warn(line);
});

onLines(tunnel.stdout, (line) => {
  const url = maybeExtractUrl(line);
  if (url) {
    launchDevServer(url);
    return;
  }

  log.message(line, {
    symbol: "\u2139",
  });
});

tunnel.on("exit", (code, signal) => {
  if (!launched) {
    tunnelStatus.error(
      `Localtunnel exited before a public URL was detected (${signal ?? code ?? "unknown"}).`
    );
    process.exit(code ?? 1);
  }

  if (!shutdownStarted && (!devServer || devServer.exitCode === null)) {
    log.error("Localtunnel exited, shutting down the dev server.");
    shutdown(signal ?? "SIGTERM");
  }
});
