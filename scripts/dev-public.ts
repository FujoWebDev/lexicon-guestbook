import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Readable } from "node:stream";
import { intro, log, outro, spinner } from "@clack/prompts";
import { Command, InvalidArgumentError } from "commander";

const DEFAULT_PORT = "3003";
const DEFAULT_LOCAL_HOST = "127.0.0.1";
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";
const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";
// Match the public URL Cloudflare prints inside its boxed startup banner,
// while ignoring api.trycloudflare.com (the control-plane endpoint, also
// emitted by cloudflared but not the tunnel URL we want).
const PUBLIC_URL_PATTERN =
  /https:\/\/(?!api\.trycloudflare\.com)[^\s|]+\.trycloudflare\.com/;
const TUNNEL_STATE_FILE = join(tmpdir(), "guestbook-cloudflared.json");
const DEV_TARGETS = ["all", "client", "appview", "tunnel"] as const;

type DevTarget = (typeof DEV_TARGETS)[number];

type Options = {
  target: DevTarget;
  port: string;
  localHost: string;
};

type TunnelState = {
  pid: number;
  url: string;
  port: string;
  localHost: string;
};

class SignalTrap {
  #resolveSignal!: (signal: NodeJS.Signals) => void;
  #signal = new Promise<NodeJS.Signals>((resolve) => {
    this.#resolveSignal = resolve;
  });
  #settled = false;
  #listeners = new Map<NodeJS.Signals, () => void>();

  constructor(signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"]) {
    for (const signal of signals) {
      const listener = () => {
        if (this.#settled) {
          return;
        }

        this.#settled = true;
        this.#resolveSignal(signal);
      };

      this.#listeners.set(signal, listener);
      process.on(signal, listener);
    }
  }

  wait() {
    return this.#signal;
  }

  [Symbol.dispose]() {
    for (const [signal, listener] of this.#listeners) {
      process.off(signal, listener);
    }
  }
}

class ManagedProcess {
  constructor(
    readonly child: ChildProcess,
    private readonly onDispose?: () => void,
  ) {}

  [Symbol.dispose]() {
    this.onDispose?.();

    if (!this.child.killed) {
      this.child.kill("SIGTERM");
    }
  }
}

class TunnelSession {
  private constructor(
    readonly url: string,
    readonly source: "new" | "existing",
    readonly child?: ChildProcess,
  ) {}

  static async open(options: Options) {
    const existingTunnel = this.#getExisting(options);
    if (existingTunnel && (await this.#isReachable(existingTunnel.url))) {
      return new TunnelSession(existingTunnel.url, "existing");
    }
    if (existingTunnel) {
      this.#clearState(existingTunnel.pid);
    }

    const status = spinner();
    status.start(
      `Starting cloudflared tunnel for AppView on http://${options.localHost}:${options.port}`,
    );

    const child = spawn(NPX_COMMAND, this.#buildArgs(options), {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    child.once("exit", () => {
      this.#clearState(child.pid);
    });

    const url = await this.#waitForUrl(child, status);
    status.stop("Tunnel ready.");

    if (child.pid) {
      this.#writeState(options, url, child.pid);
    }

    return new TunnelSession(url, "new", child);
  }

  [Symbol.dispose]() {
    if (!this.child) {
      return;
    }

    TunnelSession.#clearState(this.child.pid);

    if (!this.child.killed) {
      this.child.kill("SIGTERM");
    }
  }

  static #buildArgs({ port, localHost }: Options) {
    return [
      "--yes",
      "cloudflared",
      "tunnel",
      "--no-autoupdate",
      "--url",
      `http://${localHost}:${port}`,
    ];
  }

  static #matches(state: TunnelState, options: Options) {
    return (
      state.port === options.port && state.localHost === options.localHost
    );
  }

  // Probes the tunnel's well-known DID doc — served by the appview, so a 2xx
  // confirms both that Cloudflare's edge still has the tunnel registered AND
  // that the local appview is up and reachable through it. Cloudflare returns
  // HTTP 530 once the cloudflared agent has unregistered the origin (e.g.
  // because the previous dev session crashed without disposing the tunnel).
  static async #isReachable(url: string) {
    try {
      const response = await fetch(`${url}/.well-known/did.json`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static #isAlive(pid: number) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const errorCode =
        error instanceof Error && "code" in error ? error.code : undefined;

      return errorCode === "EPERM";
    }
  }

  static #clearState(pid?: number) {
    if (!existsSync(TUNNEL_STATE_FILE)) {
      return;
    }

    try {
      if (pid !== undefined) {
        const state = JSON.parse(readFileSync(TUNNEL_STATE_FILE, "utf8")) as {
          pid?: number;
        };

        if (state.pid !== pid) {
          return;
        }
      }
    } catch {
      // Ignore unreadable state and clear it below.
    }

    rmSync(TUNNEL_STATE_FILE, { force: true });
  }

  static #getExisting(options: Options) {
    if (!existsSync(TUNNEL_STATE_FILE)) {
      return undefined;
    }

    try {
      const state = JSON.parse(readFileSync(TUNNEL_STATE_FILE, "utf8")) as
        | TunnelState
        | undefined;

      if (!state?.pid || !state.url || !this.#matches(state, options)) {
        this.#clearState();
        return undefined;
      }

      new URL(state.url);

      if (!this.#isAlive(state.pid)) {
        this.#clearState(state.pid);
        return undefined;
      }

      return state;
    } catch {
      this.#clearState();
      return undefined;
    }
  }

  static #writeState(options: Options, url: string, pid: number) {
    writeFileSync(
      TUNNEL_STATE_FILE,
      JSON.stringify(
        {
          pid,
          url,
          port: options.port,
          localHost: options.localHost,
        } satisfies TunnelState,
        null,
        2,
      ),
    );
  }

  static #waitForUrl(
    tunnel: ChildProcess,
    status: ReturnType<typeof spinner>,
  ) {
    const { stdout, stderr } = tunnel;

    if (!stdout || !stderr) {
      throw new Error("cloudflared process did not expose stdout/stderr pipes.");
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false;

      // cloudflared writes its banner (including the public URL) to stderr;
      // stdout is usually quiet but we surface anything that does appear.
      const handleLine = (line: string) => {
        if (!settled) {
          const url = line.match(PUBLIC_URL_PATTERN)?.[0];
          if (url) {
            settled = true;
            resolve(url);
            return;
          }
        }

        log.message(line, {
          symbol: "\u2139",
        });
      };

      onLines(stderr, handleLine);
      onLines(stdout, handleLine);

      tunnel.once("exit", (code, signal) => {
        this.#clearState(tunnel.pid);

        if (settled) {
          return;
        }

        status.error(
          `cloudflared exited before a public URL was detected (${signal ?? code ?? "unknown"}).`,
        );
        reject(
          new Error("cloudflared exited before a public URL was detected."),
        );
      });
    });
  }
}

const parseTarget = (value: string) => {
  if (DEV_TARGETS.some((target) => target === value)) {
    return value as DevTarget;
  }

  throw new InvalidArgumentError(
    `Target must be one of: ${DEV_TARGETS.join(", ")}.`,
  );
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

const waitForExit = (child: ChildProcess) => {
  return new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
};

const localCommandByTarget: Record<Exclude<DevTarget, "tunnel">, string> = {
  all: "dev:all:local",
  client: "dev:client:local",
  appview: "dev:appview:local",
};

const program = new Command()
  .name("dev-public")
  .usage("[options]")
  .description(
    "Make the AppView public with a Cloudflare quick tunnel, then optionally launch local dev processes.",
  )
  .showHelpAfterError()
  .option(
    "-t, --target <target>",
    "What to launch: all, client, appview, or tunnel",
    parseTarget,
    "all",
  )
  .option(
    "-p, --port <port>",
    "Local AppView port to expose",
    (value) => {
      if (!/^\d+$/.test(value)) {
        throw new InvalidArgumentError("Port must be a number.");
      }

      return value;
    },
    DEFAULT_PORT,
  )
  .option(
    "-l, --local-host <host>",
    "Local host for the AppView",
    DEFAULT_LOCAL_HOST,
  );

const runTarget = async (
  options: Options,
  publicUrl: string,
  source: "new" | "existing",
  signalTrap: SignalTrap,
  tunnel?: ChildProcess,
): Promise<{ code?: number; signal?: NodeJS.Signals }> => {
  const domain = new URL(publicUrl).host;

  log.step(
    source === "existing"
      ? `Reusing tunnel at ${publicUrl}`
      : `Tunnel ready at ${publicUrl}`,
  );
  log.info(`APPVIEW_DOMAIN=${domain}`);
  log.info(`GUESTBOOK_APPVIEW_DOMAIN=${domain}`);

  if (options.target === "tunnel") {
    outro(
      source === "existing"
        ? "Tunnel is already running in another process."
        : "Tunnel is running. Press Ctrl+C to stop it.",
    );
    return { signal: await signalTrap.wait() };
  }

  log.step(`Launching ${options.target} with APPVIEW_DOMAIN=${domain}.`);

  using devServer = new ManagedProcess(
    spawn(NPM_COMMAND, ["run", localCommandByTarget[options.target]], {
      stdio: "inherit",
      env: {
        ...process.env,
        APPVIEW_DOMAIN: domain,
        GUESTBOOK_APPVIEW_DOMAIN: domain,
      },
    }),
  );

  const result = await Promise.race([
    waitForExit(devServer.child).then((exit) => ({
      kind: "dev" as const,
      exit,
    })),
    signalTrap.wait().then((signal) => ({ kind: "signal" as const, signal })),
    tunnel
      ? waitForExit(tunnel).then((exit) => ({ kind: "tunnel" as const, exit }))
      : new Promise<never>(() => {}),
  ]);

  if (result.kind === "signal") {
    return { signal: result.signal };
  }

  if (result.kind === "tunnel") {
    log.error("Localtunnel exited, shutting down the dev server.");
    return {
      code: result.exit.code ?? 1,
      signal: result.exit.signal ?? undefined,
    };
  }

  if (result.exit.signal) {
    return { signal: result.exit.signal };
  }

  outro("Dev processes stopped.");
  return { code: result.exit.code ?? 0 };
};

program.parse(process.argv);
const options = program.opts<Options>();

intro("Guestbook Tunnel");
using signalTrap = new SignalTrap();

using tunnel = await TunnelSession.open(options);

const result = await runTarget(
  options,
  tunnel.url,
  tunnel.source,
  signalTrap,
  tunnel.child,
);

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(result.code ?? 0);
