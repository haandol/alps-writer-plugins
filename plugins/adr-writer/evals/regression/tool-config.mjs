// The fixture tool server's MCP configuration, and the argument order the server reads.
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "tool-server.mjs");
const FAULTS = "--faults=";

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
  businessContext = false,
  faults = [],
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
          ...(draftRoot || businessContext ? [draftRoot ?? ""] : []),
          ...(businessContext ? ["business-context"] : []),
          ...(faults.length ? [`${FAULTS}${JSON.stringify(faults)}`] : []),
        ],
      },
    },
  };
}

/** The `makeTools` options of a tool server's arguments (the configuration's args after the script). */
export function toolServerOptions(args) {
  // Injected faults trail the positional arguments, so the optional ones keep their places.
  const faultArg = args.find((arg) => arg.startsWith(FAULTS));
  const [
    root,
    pluginRoot,
    logPath,
    rawTurn,
    rawGuidance,
    checkerRoot,
    rawArtifactPaths,
    rawDraftRoot,
    queryCapability,
  ] = args.filter((arg) => arg !== faultArg);
  return {
    root,
    pluginRoot,
    logPath,
    turn: Number(rawTurn),
    guidance: rawGuidance !== "off",
    checkerRoot,
    artifactPaths: rawArtifactPaths === undefined ? [] : JSON.parse(rawArtifactPaths),
    ...(rawDraftRoot ? { draftRoot: rawDraftRoot } : {}),
    ...(queryCapability === "business-context" ? { businessContext: true } : {}),
    ...(faultArg ? { faults: JSON.parse(faultArg.slice(FAULTS.length)) } : {}),
  };
}
