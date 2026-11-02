// The fixture tool server's MCP configuration, and the argument order the server reads.
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "tool-server.mjs");

/** The MCP configuration that starts the fixture tool server; `toolServerOptions` reads it back. */
export function toolServerConfig({
  root,
  pluginRoot,
  logPath,
  turn,
  guidance = true,
  checkerRoot,
  artifactPaths = [],
  draftRoot,
}) {
  return {
    mcpServers: {
      fixture: {
        command: process.execPath,
        args: [
          TOOL_SERVER,
          root,
          pluginRoot,
          logPath,
          String(turn),
          guidance ? "on" : "off",
          checkerRoot,
          JSON.stringify(artifactPaths),
          ...(draftRoot ? [draftRoot] : []),
        ],
      },
    },
  };
}

/** The `makeTools` options of a tool server's arguments (the configuration's args after the script). */
export function toolServerOptions([
  root,
  pluginRoot,
  logPath,
  rawTurn,
  rawGuidance,
  checkerRoot,
  rawArtifactPaths,
  rawDraftRoot,
]) {
  return {
    root,
    pluginRoot,
    logPath,
    turn: Number(rawTurn),
    guidance: rawGuidance !== "off",
    checkerRoot,
    artifactPaths: rawArtifactPaths === undefined ? [] : JSON.parse(rawArtifactPaths),
    ...(rawDraftRoot ? { draftRoot: rawDraftRoot } : {}),
  };
}
