import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { main } from "../skills/run.mjs";
import { catalog } from "../skills/catalog.mjs";
import { openCache } from "../lib/evaluation-cache.mjs";

const response = "It stays Accepted. The approved work continues without another approval.";
const judgeReply = (item, pass) => ({
  models: ["judge-stub"],
  costUSD: 0,
  structured: {
    score: pass ? 1 : 0,
    reason: pass ? "Controlled pass." : "Controlled failure.",
    obligations: item.semanticObligations.map(({ id }) => ({
      id,
      verdict: pass ? "PASS" : "FAIL",
      reason: pass ? "Controlled pass." : "Controlled failure.",
      evidence: [{ source: "reply:1", quote: response }],
    })),
  },
});

async function harness() {
  const root = mkdtempSync(path.join(tmpdir(), "eval-cache-"));
  const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
  const cache = openCache(path.join(root, "cache"));
  let outputs = 0;
  const calls = { target: 0, judge: 0 };
  const run = (
    args,
    { cases = [item], pass = true, isNew = () => false, fail = false, cost = 0.5 } = {},
  ) =>
    main(["--live", "--out", path.join(root, `run-${++outputs}`), ...args], {
      cases,
      cache,
      isNew,
      clientVersion: "client-test",
      target: async () => {
        calls.target++;
        if (fail) throw new Error("provider unavailable");
        return { text: response, models: ["target-stub"], costUSD: cost };
      },
      judge: async () => {
        calls.judge++;
        return judgeReply(cases[0], typeof pass === "function" ? pass() : pass);
      },
    });
  return { root, item, cache, calls, run };
}

test("an unchanged passing case is reused without target or judge calls, and the report says so", async () => {
  const { root, calls, run } = await harness();
  try {
    const first = await run([]);
    assert.deepEqual(
      first.report.runs.map((r) => [r.verdict, r.origin]),
      [["PASS", undefined]],
    );
    assert.deepEqual(calls, { target: 1, judge: 1 });

    const second = await run([]);
    assert.deepEqual(calls, { target: 1, judge: 1 }, "reuse must not call any model");
    const [reused] = second.report.runs;
    assert.equal(reused.verdict, "PASS");
    assert.equal(reused.origin, "reused");
    assert.deepEqual(reused.calls, [], "earlier spend is not reported as new cost");
    assert.equal(reused.reusedFrom.costUSD, 0.5);
    assert.equal(reused.reusedFrom.clientVersion, "client-test");
    assert.ok(reused.reusedFrom.behaviour && reused.reusedFrom.scoring, "fingerprints are cited");
    assert.ok(reused.checks.length);
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(second.html, "utf8");
    assert.ok(
      html.includes("재사용한 사례 1개(impl-high-load-keeps-progress)"),
      "the report names reused cases apart from executed ones",
    );
    assert.ok(html.includes("새로 실행한 사례 0개(없음)"));

    await run(["--no-reuse"]);
    assert.deepEqual(calls, { target: 2, judge: 2 }, "--no-reuse executes again");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a scoring-only change rejudges stored evidence without calling the target", async () => {
  const { root, item, calls, run } = await harness();
  try {
    await run([]);
    const reworded = {
      ...item,
      semanticObligations: item.semanticObligations.map((o, i) =>
        i ? o : { ...o, text: `${o.text} (reworded)` },
      ),
    };
    const second = await run([], { cases: [reworded] });
    assert.deepEqual(calls, { target: 1, judge: 2 });
    const [rejudged] = second.report.runs;
    assert.equal(rejudged.origin, "rejudged");
    assert.equal(rejudged.verdict, "PASS");
    assert.ok(rejudged.calls.every((call) => call.stage === "judge"));

    // The rejudged result is now current evidence for the reworded case.
    const third = await run([], { cases: [reworded] });
    assert.deepEqual(calls, { target: 1, judge: 2 });
    assert.equal(third.report.runs[0].origin, "reused");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a changed fixture is executed again rather than reused", async () => {
  const { root, item, calls, run } = await harness();
  try {
    await run([]);
    const changed = {
      ...item,
      async build(dir) {
        const prompt = await item.build(dir);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(path.join(dir, "notes.md"), "One more fixture file.\n");
        return prompt;
      },
    };
    const second = await run([], { cases: [changed] });
    assert.deepEqual(calls, { target: 2, judge: 2 });
    assert.equal(second.report.runs[0].origin, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("automatic repeats: one run on pass, two for a new case, up to three after a failure", async () => {
  const { root, calls, run } = await harness();
  try {
    const fresh = await run([], { isNew: () => true });
    assert.equal(fresh.report.runs.length, 2, "a new case runs twice");
    assert.equal(fresh.report.repeatPolicy, "auto");

    const failing = await run(["--no-reuse"], { pass: false });
    assert.deepEqual(
      failing.report.runs.map((r) => r.verdict),
      ["NOT_PROVEN", "NOT_PROVEN", "NOT_PROVEN"],
      "a failed regression adds runs to measure its rate",
    );
    assert.equal(calls.target, 5);

    // Every cached sample with identical fingerprints stays in the sample, the
    // earlier passes and the later failures alike, so neither is hidden.
    const replay = await run([]);
    assert.equal(calls.target, 5, "the failing sample is reused, not re-executed");
    assert.deepEqual(
      replay.report.runs.map((r) => [r.verdict, r.origin]),
      [
        ["NOT_PROVEN", "reused"],
        ["NOT_PROVEN", "reused"],
        ["NOT_PROVEN", "reused"],
        ["PASS", "reused"],
        ["PASS", "reused"],
      ],
    );

    const reproduction = await run(["--runs", "2"]);
    assert.equal(reproduction.report.repeatPolicy, "fixed");
    assert.equal(calls.target, 7, "--runs N executes N fresh repeats");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("injected targets never touch the shared cache unless one is supplied", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-cache-default-"));
  try {
    const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
    let targets = 0;
    const options = {
      cases: [item],
      isNew: () => false,
      target: async () => {
        targets++;
        return { text: response, models: ["target-stub"] };
      },
      judge: async () => judgeReply(item, true),
    };
    await main(["--live", "--out", path.join(root, "a")], options);
    await main(["--live", "--out", path.join(root, "b")], options);
    assert.equal(targets, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a run error escalates to three runs and an unusable cache entry is executed, not reported", async () => {
  const { root, cache, item, calls, run } = await harness();
  try {
    const failed = await run([], { fail: true });
    assert.deepEqual(
      failed.report.runs.map((r) => r.verdict),
      ["ERROR", "ERROR", "ERROR"],
    );
    assert.equal(calls.target, 3);

    await run([]);
    const [entry] = cache.entries(item.id);
    const { rmSync: remove } = await import("node:fs");
    remove(path.join(cache.root, item.id, entry.id, "artifacts"), { recursive: true });
    const recovered = await run([]);
    assert.equal(calls.target, 5, "the broken entry is a cache miss");
    assert.equal(recovered.report.runs[0].origin, undefined);
    assert.equal(recovered.report.runs[0].verdict, "PASS");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown cost stays unknown on reuse and preparation shows the plan without model calls", async () => {
  const { root, calls, run } = await harness();
  try {
    await run([], { cost: null });
    const second = await run([]);
    assert.equal(second.report.runs[0].reusedFrom.costUSD, null);
    assert.equal(second.report.runs[0].reusedFrom.unpricedCalls, 1, "the target reported no cost");
    const before = { ...calls };
    const { main: skills } = await import("../skills/run.mjs");
    const lines = [];
    const write = process.stdout.write;
    process.stdout.write = (chunk) => (lines.push(String(chunk)), true);
    try {
      await skills(["--prepare", "--out", path.join(root, "prepare")], {
        cases: [await caseOf()],
        cache: (await import("../lib/evaluation-cache.mjs")).openCache(path.join(root, "cache")),
        isNew: () => false,
        clientVersion: "client-test",
      });
    } finally {
      process.stdout.write = write;
    }
    assert.deepEqual(calls, before, "preparation calls no model");
    assert.ok(lines.some((line) => /Evidence plan: execute 0; rejudge 0; reuse 1/.test(line)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

async function caseOf() {
  return (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
}

test("routing selections are reused only while the shown catalog is unchanged", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-cache-routing-"));
  try {
    const { routingCases } = await import("../skills/catalog.mjs");
    const typo = routingCases.find((c) => c.id === "routing-typo");
    const cache = openCache(path.join(root, "cache"));
    let targets = 0;
    const options = {
      cases: [typo],
      cache,
      isNew: () => false,
      clientVersion: "client-test",
      target: async () => {
        targets++;
        return { structured: { selected: [] }, text: "{}", models: ["stub"], costUSD: 0 };
      },
    };
    await main(["--live", "--suite", "routing", "--out", path.join(root, "a")], options);
    const second = await main(
      ["--live", "--suite", "routing", "--out", path.join(root, "b")],
      options,
    );
    assert.equal(targets, 1);
    assert.equal(second.report.runs[0].origin, "reused");
    const changed = await main(["--live", "--suite", "routing", "--out", path.join(root, "c")], {
      ...options,
      cases: [{ ...typo, prompt: `${typo.prompt} 지금 바로.` }],
    });
    assert.equal(targets, 2, "a changed request is a changed prompt");
    assert.equal(changed.report.runs[0].origin, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an execution case whose obligations alone changed is rejudged with the same checks, without the target", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-cache-execution-"));
  try {
    const { cases } = await import("../regression/cases.mjs");
    const source = cases.find((c) => c.id === "rollup-encbird-withheld-approval");
    const item = { ...source, type: "execution", group: source.skill };
    const cache = openCache(path.join(root, "cache"));
    let targets = 0;
    const options = (overrides = {}) => ({
      cases: [item],
      cache,
      isNew: () => false,
      evaluate: async () => ({ verdict: "PASS", frameworkResult: { testResults: [] } }),
      target: async () => {
        targets++;
        return { text: "No official documents changed.", models: ["local-stub"], costUSD: 0 };
      },
      ...overrides,
    });
    const first = await main(
      ["--live", "--suite", "execution", "--out", path.join(root, "a")],
      options(),
    );
    const calls = targets;
    assert.ok(calls > 0);
    const reworded = {
      ...item,
      obligations: item.obligations.map((o, i) => (i ? o : { ...o, text: `${o.text} (reworded)` })),
    };
    const second = await main(
      ["--live", "--suite", "execution", "--out", path.join(root, "b")],
      options({ cases: [reworded] }),
    );
    assert.equal(targets, calls, "a rejudge never calls the target");
    const [run] = second.report.runs;
    assert.equal(run.origin, "rejudged");
    const outcomes = (r) => r.checks.map(({ label, pass }) => [label, pass]);
    assert.deepEqual(outcomes(run), outcomes(first.report.runs[0]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a different model or client reuses content-identical evidence and the report names the original", async () => {
  const { root, item, cache } = await harness();
  try {
    let targets = 0;
    const run = (out, model, clientVersion) =>
      main(["--live", "--out", path.join(root, out), ...(model ? ["--model", model] : [])], {
        cases: [item],
        cache,
        isNew: () => false,
        clientVersion,
        target: async () => {
          targets++;
          return { text: response, models: ["model-a"], costUSD: 0.1 };
        },
        judge: async () => judgeReply(item, true),
      });
    await run("a", null, "client-a");
    const second = await run("b", "model-b", "client-b");
    assert.equal(targets, 1, "model and client are recorded, not reuse keys");
    const [reused] = second.report.runs;
    assert.equal(reused.origin, "reused");
    assert.deepEqual(reused.targetModels, ["model-a"]);
    const { readFileSync } = await import("node:fs");
    assert.ok(readFileSync(second.html, "utf8").includes("model-a / client-a"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("change selection adds carried and stale cases beyond the impact map and records the omitted rest", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-cache-changed-"));
  try {
    const all = await catalog();
    const carrier = all.find((c) => c.id === "impl-high-load-keeps-progress");
    const other = all.find((c) => c.id === "impl-provability");
    const unrelated = all.find((c) => c.id === "review-provability");
    const marker = "A sentence that only the carrier case embeds in its prompt.";
    const carrying = {
      ...carrier,
      async build(dir) {
        return `${await carrier.build(dir)}\n${marker}`;
      },
    };
    const result = await main(["--live", "--changed", "HEAD", "--out", path.join(root, "a")], {
      cases: [carrying, other, unrelated],
      cache: openCache(path.join(root, "cache")),
      isNew: () => false,
      changedPaths: ["plugins/adr-writer/references/nothing-maps-here.md"],
      probes: [
        {
          file: "plugins/adr-writer/references/nothing-maps-here.md",
          lines: [marker],
          blocks: [],
          mention: null,
        },
      ],
      target: async () => ({ text: response, models: ["target-stub"], costUSD: 0 }),
      judge: async () => judgeReply(carrier, true),
    });
    assert.deepEqual(Object.keys(result.report.selection.beyondImpactMap), [carrier.id]);
    assert.match(result.report.selection.beyondImpactMap[carrier.id], /^carries /);
    assert.deepEqual(result.report.selection.omitted.sort(), [other.id, unrelated.id].sort());
    assert.deepEqual(
      result.report.runs.map((r) => r.caseId),
      [carrier.id],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a rejudge keeps the original entry, sends no earlier verdict to the judge, and covers every stored run", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-cache-rejudge-all-"));
  try {
    const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
    const cache = openCache(path.join(root, "cache"));
    const verdicts = [false, false, true];
    let targets = 0;
    let judged = 0;
    const prompts = [];
    const run = (out, cases, judge) =>
      main(["--live", "--out", path.join(root, out)], {
        cases,
        cache,
        isNew: () => false,
        target: async () => {
          targets++;
          return { text: response, models: ["target-stub"], costUSD: 0 };
        },
        judge,
      });
    await run("a", [item], async () => judgeReply(item, verdicts[judged++] ?? true));
    assert.equal(targets, 3, "a failure escalated to three runs");
    const before = cache.entries(item.id).map((e) => JSON.stringify(e));
    const reworded = {
      ...item,
      semanticObligations: item.semanticObligations.map((o, i) =>
        i ? o : { ...o, text: `${o.text} (reworded)` },
      ),
    };
    const second = await run("b", [reworded], async ({ prompt }) => {
      prompts.push(prompt);
      return judgeReply(reworded, true);
    });
    assert.equal(targets, 3, "the rejudge calls no target");
    assert.deepEqual(
      second.report.runs.map((r) => r.origin),
      ["rejudged", "rejudged", "rejudged"],
      "every stored run with this behaviour is rejudged, the earlier failures included",
    );
    assert.ok(prompts.every((prompt) => !prompt.includes("Controlled failure.")));
    const after = cache.entries(item.id);
    assert.equal(after.length, 6, "rejudged results are stored as separate entries");
    for (const entry of before) assert.ok(after.some((e) => JSON.stringify(e) === entry));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--confirm asks for two runs and listing a change calls no model", async () => {
  const { root, calls, run } = await harness();
  try {
    await run([]);
    const confirmed = await run(["--confirm"]);
    assert.deepEqual(
      confirmed.report.runs.map((r) => r.origin),
      ["reused", undefined],
      "one cached pass is reused and one confirming run executes",
    );
    assert.equal(calls.target, 2);
    const noCall = async () => {
      throw new Error("listing must not call a model");
    };
    await main(["--list", "--changed", "HEAD"], {
      cases: [await caseOf()],
      cache: null,
      target: noCall,
      judge: noCall,
      changedPaths: [],
      probes: [],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a scenario's declared agent timeout raises the target limit", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-timeout-"));
  try {
    const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
    const limits = [];
    await main(["--live", "--runs", "1", "--out", path.join(root, "a")], {
      cases: [{ ...item, agentTimeoutMs: 600_000 }],
      target: async ({ timeoutMs }) => {
        limits.push(timeoutMs);
        return { text: response, models: ["target-stub"] };
      },
      judge: async () => judgeReply(item, true),
    });
    assert.deepEqual(limits, [600_000]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a fixture inside this repository's work tree never sees the outer repository", async () => {
  const { spawnSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");
  // `.codex/` is ignored and absent from a fresh checkout such as CI.
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.join(repo, ".codex"), { recursive: true });
  const out = mkdtempSync(path.join(repo, ".codex", "git-isolation-"));
  try {
    const item = (await catalog()).find((c) => c.id === "impl-high-load-keeps-progress");
    const probe = {
      ...item,
      async build(dir) {
        const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
          cwd: dir,
          encoding: "utf8",
        });
        return `${await item.build(dir)}\nGIT_PROBE=${git.status === 0 ? "inside" : "outside"}`;
      },
    };
    const before = process.env.GIT_CEILING_DIRECTORIES;
    const result = await main(["--prepare", "--runs", "1", "--out", path.join(out, "run")], {
      cases: [probe],
      cache: null,
    });
    const input = JSON.parse(
      readFileSync(path.join(result.output, result.report.runs[0].artifactDirectory, "input.json")),
    );
    assert.match(input.prompt, /GIT_PROBE=outside/);
    assert.equal(process.env.GIT_CEILING_DIRECTORIES, before, "the ceiling is restored");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
