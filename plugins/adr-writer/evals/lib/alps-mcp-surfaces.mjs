// Drives the committed alps-writer bundle the way a skill-less MCP client does:
// one stdio session runs `initialize` and a fixed sequence of tool calls. Used
// only by the scenarios that embed the shipped server guidance or a real tool
// response, so their prompts follow the bundle users install.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.resolve(HERE, "../../../alps-writer/dist/index.js");

const CLIENT = `
const { spawn } = require("node:child_process");
const [bundle, rawSteps] = process.argv.slice(1);
const steps = JSON.parse(rawSteps);
const server = spawn(process.execPath, [bundle], { stdio: ["pipe", "pipe", "pipe"] });
server.stdout.setEncoding("utf8");
let stdout = "", stderr = "", instructions = "", done = false;
const results = [];
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
function call(index) {
  if (index === steps.length) return finish(0, JSON.stringify({ instructions, results }));
  send({ jsonrpc: "2.0", id: index + 2, method: "tools/call", params: steps[index] });
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
      call(0);
    } else if (typeof message.id === "number") {
      const text = message.result?.content?.find((item) => item.type === "text")?.text;
      if (message.error || message.result?.isError || text === undefined)
        return finish(2, "MCP tool call failed: " + line);
      results.push(text);
      call(message.id - 1);
    }
  }
});
send({ jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "adr-eval", version: "0" } } });
`;

/** Run `initialize` and the given tool calls in one bundle session; return the instructions and each call's text. */
export function alpsMcpSession(steps) {
  const result = spawnSync(process.execPath, ["-e", CLIENT, BUNDLE, JSON.stringify(steps)], {
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(`alps-writer MCP session failed: ${(result.stderr || "").trim()}`);
  return JSON.parse(result.stdout);
}

/** Returns `{ instructions, overview }` exactly as the shipped MCP server provides them. */
export function alpsMcpGuidance(profile) {
  const { instructions, results } = alpsMcpSession([
    { name: "alps_template", arguments: { action: "overview", profile } },
  ]);
  return { instructions, overview: results[0] };
}

/**
 * The real `alps_document` load response of a Lite document whose given
 * subsections were saved first, so a resume prompt matches the saved state.
 */
export function alpsLiteResumeText(dir, sections = []) {
  const target = path.join(dir, "resume.lite.alps.xml");
  const { results } = alpsMcpSession([
    {
      name: "alps_document",
      arguments: { action: "init", profile: "lite", project_name: "resume", output_path: target },
    },
    ...sections.map(({ section, subsection_id, title, content }) => ({
      name: "alps_section",
      arguments: { action: "save", doc_path: target, section, subsection_id, title, content },
    })),
    { name: "alps_document", arguments: { action: "load", doc_path: target } },
  ]);
  return results.at(-1).trim();
}
