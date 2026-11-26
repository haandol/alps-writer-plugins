import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { confined, createWorkspace, snapshot, makeTools } from "../regression/workspace.mjs";
import { capturedChecks, writableCapture } from "../skills/mechanical-checks.mjs";

/** Restore only recorded bytes inside a fresh check workspace; never execute captured commands. */
export function restore(root, files) {
  for (const [file, bytes] of Object.entries(files)) {
    if (typeof bytes !== "string") throw new Error("Captured file content must be text");
    const target = confined(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

/**
 * A real repository ignores `.adr-review/` before any report is written (the
 * review-artifact rule); the fixture tools only let the target write the report
 * itself. Give the final verifiers the same ignore so a disposable report is
 * never mistaken for code that references ADRs.
 */
export function ignoreReviewArtifacts(root) {
  const folder = path.join(root, ".adr-review");
  if (existsSync(folder) && !existsSync(path.join(folder, ".gitignore")))
    writeFileSync(path.join(folder, ".gitignore"), "*\n");
}

/** Run the mandatory final verifiers on an execution workspace; live capture and rejudge share them. */
export function finalChecks(tools) {
  return ["policy-tests", "structure"].map((kind) => {
    const result = tools.call("run_check", { kind });
    return {
      label: `final ${kind}`,
      pass: result.exitCode === 0,
      detail: result.stdout + result.stderr,
    };
  });
}

/** Apply the same action, filesystem, final verifier and case-specific gates to a run and its replay. */
export function executionOutcome(tools, item, evidence, fixture, verifyEvidence) {
  for (const [file, bytes] of Object.entries(fixture)) {
    if (
      !writableCapture(item, file) &&
      (evidence.before[file] !== bytes || evidence.after[file] !== bytes)
    )
      throw new Error(`Captured immutable fixture differs from the trusted verifier: ${file}`);
  }
  const caseChecks = verifyEvidence ? verifyEvidence(evidence) : [];
  if (
    verifyEvidence &&
    (!Array.isArray(caseChecks) ||
      !caseChecks.length ||
      caseChecks.some((c) => typeof c?.pass !== "boolean"))
  )
    throw new Error("Invalid execution evidence checks");
  const checks = [
    ...capturedChecks(item, {
      before: evidence.before,
      files: evidence.after,
      events: evidence.events,
    }),
    ...finalChecks(tools),
    ...caseChecks,
  ];
  return { checks, caseChecks };
}

/** Re-run trusted current execution verifiers on captured documents, never captured executable code. */
export function executionChecks(root, item, currentCase, evidence, pluginRoot) {
  if (currentCase?.type !== "execution" || typeof currentCase.build !== "function")
    throw new Error("No current execution verifier is registered for the captured case");
  const fixture = currentCase.build();
  createWorkspace(root, fixture, pluginRoot);
  for (const file of Object.keys(snapshot(root)))
    if (writableCapture(item, file)) unlinkSync(confined(root, file));
  restore(
    root,
    Object.fromEntries(
      Object.entries(evidence.after).filter(([file]) => writableCapture(item, file)),
    ),
  );
  ignoreReviewArtifacts(root);
  const tools = makeTools({
    root,
    pluginRoot: pluginRoot,
    logPath: path.join(path.dirname(root), "rejudge-checks.jsonl"),
    turn: evidence.turns.length,
    artifactPaths: item.artifactPaths,
  });
  return executionOutcome(tools, item, evidence, fixture, currentCase.verifyEvidence).checks;
}
