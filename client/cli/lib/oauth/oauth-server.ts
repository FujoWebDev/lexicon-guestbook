import { createServer, IncomingMessage, Server } from "node:http";
import {
  CALLBACK_PATH,
  CLIENT_METADATA_PATH,
  CLIENT_METADATA,
  JWKS_PATH,
  JWKS,
  LOCAL_SERVER_PORT,
} from "./oauth-client.ts";

const getAuthServerAddress = (authServer: Server) => {
  const address = authServer.address();
  if (!address) {
    throw new Error("Auth server address is not set");
  }
  if (typeof address === "object") {
    return `http://${address.address}:${address.port}`;
  }
  return address;
};

const AuthServer = createServer();
const getRequestUrl = (req: IncomingMessage) => {
  return new URL(req.url ?? "/", getAuthServerAddress(AuthServer));
};

AuthServer.on("request", (req, res) => {
  switch (getRequestUrl(req).pathname) {
    case CLIENT_METADATA_PATH: {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(CLIENT_METADATA));
      return;
    }
    case JWKS_PATH: {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(JWKS.publicJwk));
      return;
    }
    case CALLBACK_PATH: {
      if (res.headersSent) {
        // In this case, the request was handled by another listener
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("No pending callback requests found");
      return;
    }
    default: {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
  }
});

export const startAuthServer = async () => {
  const { promise, resolve } = Promise.withResolvers();
  AuthServer.listen(Number(LOCAL_SERVER_PORT), "127.0.0.1", () => {
    resolve(getAuthServerAddress(AuthServer));
  });
  return promise;
};

export const waitForAuthCallback = async () => {
  const { promise, resolve } = Promise.withResolvers<URL>();
  // Prevent the server from closing if the program wants to exit
  AuthServer.ref();
  AuthServer.prependListener(
    "request",
    async function callbackListener(req, res) {
      const requestUrl = getRequestUrl(req);
      if (requestUrl.pathname === CALLBACK_PATH) {
        resolve(requestUrl);

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Authorization successful. You can close this window now.");

        // We stop listening for requests and allow the server to close
        // if the program wants to exit
        AuthServer.removeListener("request", callbackListener);
        AuthServer.unref();
      }
    }
  );
  return promise;
};
