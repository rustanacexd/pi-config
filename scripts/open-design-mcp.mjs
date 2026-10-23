// Open Design MCP that never launches the app and never fails.
// Open Design running: proxy to its real MCP. Not running: serve zero tools.
import { spawn } from "node:child_process";
import net from "node:net";
import readline from "node:readline";

const OD_APP = "/Applications/Open Design.app";
const OD_NODE = `${OD_APP}/Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper`;
const OD_CLI = `${OD_APP}/Contents/Resources/app/prebundled/daemon/daemon-cli.mjs`;
const DAEMON_SOCKET = process.env.OD_SIDECAR_CLIENT_ENDPOINT;

const daemonRunning = () =>
  new Promise((resolve) => {
    if (!DAEMON_SOCKET) return resolve(false);
    const socket = net.connect(DAEMON_SOCKET);
    const done = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(500, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });

function proxyRealServer() {
  const child = spawn(OD_NODE, [OD_CLI, "mcp"], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

function serveNoTools() {
  const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const emptyLists = {
    "tools/list": { tools: [] },
    "resources/list": { resources: [] },
    "resources/templates/list": { resourceTemplates: [] },
    "prompts/list": { prompts: [] },
    ping: {},
  };
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      return;
    }
    if (request.id === undefined) return;
    if (request.method === "initialize") {
      return send({
        id: request.id,
        result: {
          protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "open-design (app not running)", version: "0" },
          instructions: "Open Design is not running. Open the app, then run /mcp reconnect open-design.",
        },
      });
    }
    if (request.method in emptyLists) return send({ id: request.id, result: emptyLists[request.method] });
    send({ id: request.id, error: { code: -32601, message: "Open Design is not running" } });
  });
  process.stdin.on("end", () => process.exit(0));
}

if (await daemonRunning()) proxyRealServer();
else serveNoTools();
