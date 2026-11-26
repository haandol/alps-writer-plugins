import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cachedSamples,
  dependenciesMatch,
  normalize,
  recordDependencies,
} from "../evals/lib/evaluation-cache.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(
  readFileSync(path.join(PLUGIN, ".claude-plugin/plugin.json"), "utf8"),
).version;

test("normalisation hides the fixture path and the current release stamp only", () => {
  const text = `root /tmp/x/workspace\n<!-- adr-writer:rules-version ${VERSION} -->\n<!-- adr-writer:rules-version 0.1.0 -->`;
  const result = normalize(text, "/tmp/x/workspace");
  assert.ok(result.includes("root <FIXTURE>"));
  assert.ok(result.includes("rules-version <CURRENT>"), "a release bump keeps the fingerprint");
  assert.ok(result.includes("rules-version 0.1.0"), "a deliberately old stamp stays distinct");
  const repo = path.resolve(PLUGIN, "../..");
  const dated = normalize(`run ${repo}/x on 2026-11-26`, null, "2026-11-26");
  assert.equal(dated, "run <REPO>/x on <DATE>", "repository path and reference date are values");
});

test("reuse keys are content: the target model, client and judge are not part of them", async () => {
  const { behaviourFingerprint, scoringFingerprint } =
    await import("../evals/lib/evaluation-cache.mjs");
  const item = { type: "classification", semanticObligations: [{ id: "a", text: "keep" }] };
  const behaviour = behaviourFingerprint({ prompt: "same prompt", item });
  assert.equal(behaviourFingerprint({ prompt: "same prompt", item }), behaviour);
  assert.notEqual(behaviourFingerprint({ prompt: "other prompt", item }), behaviour);
  const scoring = scoringFingerprint({ item });
  assert.notEqual(
    scoringFingerprint({ item: { ...item, semanticObligations: [{ id: "a", text: "drop" }] } }),
    scoring,
  );
  assert.equal(
    scoringFingerprint({ item: { ...item, title: "renamed", description: "edited" } }),
    scoring,
    "a title or description is not scoring content",
  );
});

test("only plugin files a run consumed decide whether its evidence is still current", () => {
  const plugin = mkdtempSync(path.join(tmpdir(), "eval-deps-"));
  try {
    for (const [file, text] of Object.entries({
      "references/read.md": "read me",
      "references/unread.md": "not read",
      "scripts/adr-structure-lint.mjs": "// checker",
      "scripts/adr-impl-review-report.mjs": "// unrelated script",
    })) {
      mkdirSync(path.dirname(path.join(plugin, file)), { recursive: true });
      writeFileSync(path.join(plugin, file), text);
    }
    const events = [
      { kind: "request", tool: "read_file", arguments: { path: "plugin/references/read.md" } },
      { kind: "request", tool: "read_file", arguments: { path: "docs/adr/a.md" } },
      { kind: "request", tool: "list_files", arguments: { prefix: "plugin/references" } },
      { kind: "result", tool: "read_file", ok: true },
    ];
    const context = { pluginRoot: plugin };
    const deps = recordDependencies(events, context);
    assert.deepEqual(Object.keys(deps), ["list:references", "read:references/read.md"]);
    assert.equal(dependenciesMatch(deps, context), true);

    writeFileSync(path.join(plugin, "references/unread.md"), "edited, never read");
    assert.equal(dependenciesMatch(deps, context), true, "an unread file does not invalidate");

    writeFileSync(path.join(plugin, "references/read.md"), "edited");
    assert.equal(dependenciesMatch(deps, context), false, "a file the run read invalidates");

    writeFileSync(path.join(plugin, "references/read.md"), "read me");
    writeFileSync(path.join(plugin, "references/new.md"), "listing changed");
    assert.equal(dependenciesMatch(deps, context), false, "a listing the run saw invalidates");

    const checked = recordDependencies(
      [{ kind: "request", tool: "run_check", arguments: { kind: "structure" } }],
      context,
    );
    assert.deepEqual(Object.keys(checked), ["program:checkers", "template:*"]);
    writeFileSync(path.join(plugin, "scripts/adr-impl-review-report.mjs"), "// edited");
    assert.equal(dependenciesMatch(checked, context), true, "a script no check runs is no input");
    writeFileSync(path.join(plugin, "scripts/adr-structure-lint.mjs"), "// changed checker");
    assert.equal(dependenciesMatch(checked, context), false, "checker output is an input");

    assert.deepEqual(
      recordDependencies(events, context, { guidance: false }),
      {},
      "without guidance plugin reads fail regardless of content",
    );
  } finally {
    rmSync(plugin, { recursive: true, force: true });
  }
});

test("routing trials depend on the skill bodies they were shown", () => {
  const skills = new Map([["adr-new", "body"]]);
  const deps = recordDependencies([], { skills }, { skills: ["adr-new"] });
  assert.deepEqual(Object.keys(deps), ["skill:adr-new"]);
  assert.equal(dependenciesMatch(deps, { skills }), true);
  assert.equal(dependenciesMatch(deps, { skills: new Map([["adr-new", "edited"]]) }), false);
});

test("cached samples count one original once and keep earlier failures", () => {
  const entries = [
    { id: "a", behaviour: "b", scoring: "old", verdict: "PASS" },
    { id: "a2", source: "a", behaviour: "b", scoring: "new", verdict: "PASS" },
    { id: "c", behaviour: "b", scoring: "new", verdict: "NOT_PROVEN" },
    { id: "d", behaviour: "b", scoring: "old", verdict: "ERROR" },
    { id: "f", behaviour: "other", scoring: "new", verdict: "PASS" },
  ].map((entry, index) => ({ ...entry, caseId: "x", createdAt: String(index) }));
  const cache = { entries: () => entries };
  const { reusable, rejudgeable } = cachedSamples(cache, "x", {
    behaviour: "b",
    scoring: "new",
    context: { pluginRoot: tmpdir() },
  });
  assert.deepEqual(
    reusable.map((e) => e.id),
    ["c", "a2"],
  );
  assert.deepEqual(
    rejudgeable.map((e) => e.id),
    ["d"],
    "an original already rejudged under the current scoring is not rejudged again",
  );
  assert.deepEqual(cachedSamples(null, "x", {}), { reusable: [], rejudgeable: [] });
});

test("an unreadable cache entry is skipped and an incomplete one cannot be restored", async () => {
  const { openCache } = await import("../evals/lib/evaluation-cache.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "eval-cache-corrupt-"));
  try {
    const cache = openCache(dir);
    const folder = mkdtempSync(path.join(tmpdir(), "eval-cache-run-"));
    writeFileSync(path.join(folder, "result.json"), "{}");
    const stored = cache.store("x", { behaviour: "b", scoring: "s", verdict: "PASS" }, folder);
    mkdirSync(path.join(dir, "x", "broken"));
    writeFileSync(path.join(dir, "x", "broken", "meta.json"), '{"id": "trunc');
    assert.deepEqual(
      cache.entries("x").map((e) => e.id),
      [stored.id],
    );
    rmSync(path.join(dir, "x", stored.id, "artifacts", "result.json"));
    assert.throws(() => cache.restore(stored, folder), /incomplete/);
    rmSync(folder, { recursive: true, force: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("one cached run that read a since-changed file makes the whole case stale", () => {
  const plugin = mkdtempSync(path.join(tmpdir(), "eval-stale-"));
  try {
    mkdirSync(path.join(plugin, "references"));
    writeFileSync(path.join(plugin, "references/read.md"), "before");
    const context = { pluginRoot: plugin };
    const readIt = recordDependencies(
      [{ kind: "request", tool: "read_file", arguments: { path: "plugin/references/read.md" } }],
      context,
    );
    const entries = [
      { id: "a", behaviour: "b", scoring: "s", verdict: "PASS", dependencies: readIt },
      { id: "c", behaviour: "b", scoring: "s", verdict: "PASS", dependencies: {} },
    ].map((e, i) => ({ ...e, caseId: "x", createdAt: String(i) }));
    const cache = { entries: () => entries };
    const query = { behaviour: "b", scoring: "s", context };
    assert.equal(cachedSamples(cache, "x", query).reusable.length, 2);
    writeFileSync(path.join(plugin, "references/read.md"), "after");
    assert.deepEqual(cachedSamples(cache, "x", query), {
      reusable: [],
      rejudgeable: [],
      stale: true,
    });
  } finally {
    rmSync(plugin, { recursive: true, force: true });
  }
});

test("a seeded rule document is a template input only when the run reads it", async () => {
  const { fixtureFiles } = await import("../evals/lib/evaluation-cache.mjs");
  const root = mkdtempSync(path.join(tmpdir(), "eval-seeded-"));
  const plugin = mkdtempSync(path.join(tmpdir(), "eval-seeded-plugin-"));
  try {
    const template = readFileSync(path.join(PLUGIN, "templates/adr/authoring-rules.md"), "utf8");
    mkdirSync(path.join(root, "docs/adr"), { recursive: true });
    writeFileSync(path.join(root, "docs/adr/authoring-rules.md"), template);
    assert.deepEqual(fixtureFiles(root), [
      ["docs/adr/authoring-rules.md", "template:authoring-rules.md"],
    ]);
    writeFileSync(
      path.join(root, "docs/adr/authoring-rules.md"),
      template.replace(/rules-version \d+\.\d+\.\d+/, "rules-version 0.1.0"),
    );
    assert.notEqual(
      fixtureFiles(root)[0][1],
      "template:authoring-rules.md",
      "a copy the scenario changed keeps its own content",
    );
    mkdirSync(path.join(plugin, "templates/adr"), { recursive: true });
    writeFileSync(path.join(plugin, "templates/adr/authoring-rules.md"), "rules v1");
    const context = { pluginRoot: plugin };
    const deps = recordDependencies(
      [{ kind: "request", tool: "read_file", arguments: { path: "docs/adr/authoring-rules.md" } }],
      context,
    );
    assert.deepEqual(Object.keys(deps), ["template:authoring-rules.md"]);
    assert.equal(dependenciesMatch(deps, context), true);
    writeFileSync(path.join(plugin, "templates/adr/authoring-rules.md"), "rules v2");
    assert.equal(
      dependenciesMatch(deps, context),
      false,
      "a read template that changed invalidates",
    );
    assert.deepEqual(recordDependencies([], context), {}, "an unread copy is no dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(plugin, { recursive: true, force: true });
  }
});
