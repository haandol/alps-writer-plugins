// Fixtures that evals-harness.test.mjs and evals-harness.integration.test.mjs share.
import assert from "node:assert/strict";
import { readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));

// Every fixture directory this file creates is removed when the file finishes,
// so repeated runs do not fill the system temporary directory.
export const scratchDirs = [];

export const scratch = (prefix) => {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
};

export const PLUGIN_ROOT = path.resolve(HERE, "..");

export const EVALS = path.join(PLUGIN_ROOT, "evals");

// Each scenario is built once per file: the tests that read its prompt or its
// fixture share that build instead of rebuilding the same files.
export const builds = new Map();

export function built(file) {
  if (!builds.has(file))
    builds.set(
      file,
      loadScenario(file).then(async (scenario) => {
        const dir = scratch("adr-eval-built-");
        return { scenario, dir, prompt: await scenario.build(dir) };
      }),
    );
  return builds.get(file);
}

export function scenarioFiles() {
  return readdirSync(path.join(EVALS, "scenarios")).filter((f) => f.endsWith(".mjs"));
}

export async function loadScenario(file) {
  return (await import(path.join(EVALS, "scenarios", file))).default;
}

// A scenario that reads its target out of the environment (the real-repo one)
// throws from build() when it is unset. That is correct behaviour — a silent
// empty fixture would be worse — so the sweep tests skip it and it gets its own.
export function needsEnv(scenario) {
  return scenario.name === "review-real-repo-adr";
}

/**
 * A built scenario prompt carries the SHIPPED instruction text and the scorer's tail. If a
 * scenario ever paraphrased the rules instead, the eval would measure the paraphrase.
 */
export function assertShippedPrompt(scenario, prompt) {
  // A directive-only scenario measures the SessionStart directives without any skill body, so
  // it is checked for both shipped directive markers instead of a long skill text. A scenario
  // whose repository has no Ontology Writer carries only ADR Writer's directive.
  if (scenario.directiveOnly) {
    const markers = scenario.withoutOntologyWriter
      ? ["[ADR-first directive]"]
      : ["[ADR-first directive]", "[Business-context directive]"];
    for (const marker of markers)
      assert.ok(prompt.includes(marker), `${scenario.name}: missing shipped ${marker}`);
    if (scenario.withoutOntologyWriter)
      assert.ok(
        !prompt.includes("[Business-context directive]"),
        `${scenario.name}: carries Ontology Writer's directive without that plugin`,
      );
  } else if (scenario.directiveProbe) {
    // A session-start probe carries the shipped directive text, not a skill body.
    assert.ok(
      /\[Business-context directive\]|Ontology Writer is installed/.test(prompt),
      `${scenario.name}: missing the shipped session directive`,
    );
  } else {
    assert.ok(
      prompt.length > 5000,
      `${scenario.name}: prompt is too short to hold a real skill body`,
    );
  }
  assert.ok(
    prompt.length <= 100_000,
    `${scenario.name}: prompt exceeds the non-invasive 100k-character budget (${prompt.length})`,
  );
  // a distinctive line from the shipped docs, not something a summary would coin
  if (scenario.name.startsWith("alps-") || scenario.name.startsWith("lite-alps-")) {
    assert.match(
      prompt,
      /Atomic is the default|top-3 focus set|separately labeled draft|plain-text approval digest|Comprehension load/i,
    );
  } else if (scenario.name.startsWith("ontology-")) {
    // Ontology Writer's own skills and directives, which never load the ADR concepts document.
    assert.match(
      prompt,
      /ontology\.mjs|onto:[A-Za-z]|\[Business-context directive\]|EventStorming|business (model|ontology)/i,
    );
  } else {
    assert.match(
      prompt,
      /abstraction ladder|requirement gate|admission gate|Regeneration|decision ledger/i,
    );
  }
  // Raw legacy scenario fixtures keep the transport trailer; semantic runs strip it before inference.
  assert.match(prompt, /EVAL-VERDICT/);
  assert.match(prompt, /EVAL-FINDINGS/);
}
