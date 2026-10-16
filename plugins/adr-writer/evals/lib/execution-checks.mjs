import { unlinkSync } from "node:fs";
import path from "node:path";
import { confined, createWorkspace, snapshot, makeTools } from "../regression/workspace.mjs";
import { writableCapture } from "../skills/mechanical-checks.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

function restore(root, files) {
  for (const [file, bytes] of Object.entries(files)) {
    if (typeof bytes !== "string") throw new Error("Captured file content must be text");
    const target = confined(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

/** Re-run trusted current execution verifiers on captured documents, never captured executable code. */
export function executionChecks(root, item, currentCase, evidence, pluginRoot) {
  if (currentCase?.type !== "execution" || typeof currentCase.build !== "function")
    throw new Error("No current execution verifier is registered for the captured case");
  const fixture = currentCase.build();
  for (const [file, bytes] of Object.entries(fixture)) {
    if (
      !writableCapture(item, file) &&
      (evidence.before[file] !== bytes || evidence.after[file] !== bytes)
    )
      throw new Error(`Captured immutable fixture differs from the trusted verifier: ${file}`);
  }
  createWorkspace(root, fixture, pluginRoot);
  for (const file of Object.keys(snapshot(root)))
    if (writableCapture(item, file)) unlinkSync(confined(root, file));
  restore(
    root,
    Object.fromEntries(
      Object.entries(evidence.after).filter(([file]) => writableCapture(item, file)),
    ),
  );
  const tools = makeTools({
    root,
    pluginRoot: pluginRoot,
    logPath: path.join(path.dirname(root), "rejudge-checks.jsonl"),
    turn: evidence.turns.length,
    artifactPaths: item.artifactPaths,
  });
  const checks = ["policy-tests", "structure"].map((kind) => {
    const result = tools.call("run_check", { kind });
    return {
      label: `final ${kind}`,
      pass: result.exitCode === 0,
      detail: result.stdout + result.stderr,
    };
  });
  if (currentCase.verifyEvidence) checks.push(...currentCase.verifyEvidence(evidence));
  return checks;
}
