// Reads the guidance a skill-less MCP client receives from the committed
// alps-writer bundle: the server instructions from `initialize` and the
// profile overview from `alps_template`. Used only by the MCP-path in-flight
// research scenarios, so their prompts follow the shipped server surfaces.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.resolve(HERE, "../../../alps-writer/dist/index.js");

const CLIENT = `
const { spawn } = require("node:child_process");
const [bundle, profile] = process.argv.slice(1);
const server = spawn(process.execPath, [bundle], { stdio: ["pipe", "pipe", "pipe"] });
server.stdout.setEncoding("utf8");
let stdout = "", stderr = "", instructions = "", done = false;
const timer = setTimeout(() => finish(2, "MCP bundle timed out: " + stderr), 10000);
function send(message) { server.stdin.write(JSON.stringify(message) + "\\n"); }
function finish(code, text) {
  if (done) return;
  done = true;
  clearTimeout(timer);
  (code === 0 ? process.stdout : process.stderr).write(text);
  server.kill();
  process.exitCode = code;
}
server.stderr.on("data", (chunk) => { stderr += chunk; });
server.on("exit", (code) => { if (!done) finish(2, "MCP bundle exited (" + code + "): " + stderr); });
server.stdout.on("data", (chunk) => {
  stdout += chunk;
  for (let newline; (newline = stdout.indexOf("\\n")) >= 0; ) {
    const line = stdout.slice(0, newline).trim();
    stdout = stdout.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === 1) {
      instructions = message.result?.instructions ?? "";
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: "alps_template", arguments: { action: "overview", profile } } });
    } else if (message.id === 2) {
      const overview = message.result?.content?.find((item) => item.type === "text")?.text;
      if (!instructions || !overview) finish(2, "missing MCP guidance: " + line);
      else finish(0, JSON.stringify({ instructions, overview }));
    }
  }
});
send({ jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "adr-eval", version: "0" } } });
`;

/** Returns `{ instructions, overview }` exactly as the shipped MCP server provides them. */
export function alpsMcpGuidance(profile) {
  const result = spawnSync(process.execPath, ["-e", CLIENT, BUNDLE, profile], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(`unable to read alps-writer MCP guidance: ${(result.stderr || "").trim()}`);
  return JSON.parse(result.stdout);
}
