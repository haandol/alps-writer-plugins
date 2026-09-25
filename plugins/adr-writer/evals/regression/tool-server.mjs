#!/usr/bin/env node
// Minimal newline-delimited MCP stdio transport for the evaluation-only tools.
// No network transport, external accounts, arbitrary shell, or SDK dependency.
import { createInterface } from "node:readline";
import { makeTools } from "./workspace.mjs";

const [root, pluginRoot, logPath, rawTurn, rawGuidance, checkerRoot] = process.argv.slice(2);
if (!root || !pluginRoot || !logPath || !/^\d+$/.test(rawTurn ?? "")) {
  throw new Error("tool-server requires fixture root, plugin root, event log, turn");
}
const tools = makeTools({
  root,
  pluginRoot,
  logPath,
  turn: Number(rawTurn),
  guidance: rawGuidance !== "off",
  checkerRoot,
});
const send = (message) => process.stdout.write(JSON.stringify(message) + "\n");

for await (const line of createInterface({ input: process.stdin })) {
  let message;
  try {
    message = JSON.parse(line);
    if (message.id === undefined) continue;
    let result;
    if (message.method === "initialize") {
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "adr-eval-fixture", version: "1.0.0" },
      };
    } else if (message.method === "ping") {
      result = {};
    } else if (message.method === "tools/list") {
      result = { tools: tools.definitions };
    } else if (message.method === "tools/call") {
      try {
        const value = tools.call(message.params.name, message.params.arguments);
        result = {
          content: [
            {
              type: "text",
              text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
            },
          ],
        };
      } catch (error) {
        result = { isError: true, content: [{ type: "text", text: error.message }] };
      }
    } else {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: "Method not found" },
      });
      continue;
    }
    send({ jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id: message?.id ?? null,
      error: { code: -32700, message: error.message },
    });
  }
}
