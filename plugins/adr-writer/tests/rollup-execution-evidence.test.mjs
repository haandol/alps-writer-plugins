import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { withTmp, write, PLUGIN_ROOT, parseLint } from "./helpers.mjs";
import { createWorkspace, makeTools, snapshot } from "../evals/regression/workspace.mjs";
import { buildRollupExecutionFixture } from "../evals/skills/rollup-execution-fixture.mjs";
import { SEEDED_RULE_DOCS } from "../scripts/adr-lint-lib.mjs";
import {
  verifyRollupDiscovery,
  verifyRollupResume,
} from "../evals/skills/rollup-execution-evidence.mjs";

// Trace programs are authored independently of the verifier's private expected
// evidence sets. Only raw fixture data is shared, not a generated answer plan.
const storage = [
  "docs/adr/storage/0001-retention.md",
  "docs/adr/storage/0002-retention.md",
  "docs/adr/storage/0003-retention.md",
];
const owners = ["docs/adr/compliance/0001-clearance.md", "docs/adr/compliance/0002-audit-state.md"];
const billing = [
  "docs/adr/billing/0001-retries.md",
  "docs/adr/billing/0002-retries.md",
  "src/billing.mjs",
];
const discovery = [
  "docs/adr/.mapping.json",
  ...storage,
  ...owners,
  "src/retention.mjs",
  "test/policy.test.mjs",
  ...billing,
];
const billingReport = ".adr-review/rollup/billing.md";
const storageReport = ".adr-review/rollup/storage.md";

function fixture(temp) {
  const root = path.join(temp, "repo"),
    logPath = path.join(temp, "events.jsonl");
  createWorkspace(root, buildRollupExecutionFixture(), PLUGIN_ROOT);
  // The generic artifact snapshot omits guidance. Keep its actual contents in
  // this retrieval fixture so global search hits and guidance reads are auditable.
  const capture = () => ({
    ...snapshot(root),
    ...Object.fromEntries(
      SEEDED_RULE_DOCS.map((name) => {
        const file = `docs/adr/${name}`;
        return [file, readFileSync(path.join(root, file), "utf8")];
      }),
    ),
  });
  const before = capture(),
    retrievals = [],
    checkpoints = [];
  let turn = 1;
  const events = () =>
    existsSync(logPath)
      ? readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [];
  let tools;
  const connect = () => {
    tools = makeTools({
      root,
      pluginRoot: PLUGIN_ROOT,
      logPath,
      turn,
      artifactPaths: [billingReport, storageReport],
    });
  };
  connect();
  function call(name, args) {
    const seq = events().length + 1;
    const value = tools.call(name, args);
    // Capture the real return, not a target-authored inspect/reuse declaration.
    retrievals.push({ request: seq, value });
    return value;
  }
  const read = (file) => call("read_file", { path: file });
  return {
    root,
    before,
    call,
    read,
    discover(skip = []) {
      for (const file of discovery) if (!skip.includes(file)) read(file);
    },
    resume(change = () => {}) {
      checkpoints.push({ turn: 1, files: capture() });
      change(root);
      checkpoints.push({ turn: 2, before: capture() });
      turn = 2;
      connect();
    },
    progress() {
      call("write_file", {
        path: billingReport,
        content:
          "# Billing preparation\nThe one-to-three retry chain can proceed independently; stable payment identity and single settlement remain required.\n",
      });
    },
    evidence() {
      const after = capture();
      const phases =
        turn === 1
          ? [{ turn: 1, files: after }]
          : [checkpoints[0], { ...checkpoints[1], files: after }];
      return structuredClone({ before, after, checkpoints: phases, events: events(), retrievals });
    },
  };
}
const pass = (checks) =>
  assert.ok(
    checks.every((c) => c.pass),
    checks
      .filter((c) => !c.pass)
      .map((c) => `${c.label}: ${c.detail}`)
      .join("\n"),
  );
const fail = (checks, label) =>
  assert.ok(
    checks.some((c) => !c.pass && (!label || c.label.includes(label))),
    JSON.stringify(checks),
  );

test("execution fixture has valid ADR/index/link structure and executable local policies", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    const lint = parseLint(f.root, [], { full: true });
    assert.equal(lint.code, 0, JSON.stringify(lint.errors));
    const tests = f.call("run_check", { kind: "policy-tests" });
    assert.equal(tests.exitCode, 0, tests.stdout + tests.stderr);
  }));

test("complete evidence accepts repeated/reordered retrieval, search, global checks and freshness reads", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.call("list_files", {});
    // This successful search returns the entire unique one-line billing source.
    f.call("search", { text: "export const canRetry" });
    for (const file of [...discovery].reverse()) if (file !== "src/billing.mjs") f.read(file);
    f.read(storage[0]);
    f.call("search", { text: "0001-retention.md" });
    for (const kind of ["structure", "invariants"])
      assert.equal(f.call("run_check", { kind }).exitCode, 0);
    pass(verifyRollupDiscovery(f.evidence()));
    f.resume();
    // Reusing old evidence and obtaining fresh copies are both legitimate.
    for (const file of [...discovery, "docs/ops/retention-link.md"]) f.read(file);
    f.progress();
    pass(verifyRollupResume(f.evidence()));
  }));

for (const file of [
  storage[0],
  storage[1],
  owners[0],
  owners[1],
  "src/retention.mjs",
  "test/policy.test.mjs",
]) {
  test(`omitting required original or contract evidence fails: ${file}`, () =>
    withTmp((temp) => {
      const f = fixture(temp);
      f.discover([file]);
      fail(verifyRollupDiscovery(f.evidence()), "required originals");
    }));
}

test("a successful excerpt, filename listing or failed retrieval cannot replace full originals", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover([storage[0]]);
    f.call("list_files", { prefix: "docs/adr/storage" });
    f.call("search", { text: "Standard accounts retain data for 30 days" });
    assert.throws(() => f.call("read_file", { path: "missing/0001-retention.md" }));
    fail(verifyRollupDiscovery(f.evidence()), "required originals");
    f.read(storage[0]);
    pass(verifyRollupDiscovery(f.evidence()));
  }));

for (const file of [
  "docs/adr/notifications/0001-delivery.md",
  "src/notifications.mjs",
  "deploy.md",
]) {
  test(`unrelated deep retrieval is rejected: ${file}`, () =>
    withTmp((temp) => {
      const f = fixture(temp);
      f.discover();
      f.read(file);
      fail(verifyRollupDiscovery(f.evidence()), "source scope");
    }));
}

test("an unrelated search result is still retrieved evidence, not a method exemption", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.call("search", { text: "export const deliveryAttempts" });
    fail(verifyRollupDiscovery(f.evidence()), "source scope");
  }));

test("global metadata/reference searches and guidance reads remain allowed without deep unrelated discovery", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.read("docs/adr/authoring-rules.md");
    for (const text of ["# ADR", "Accepted (2026-09-01)", "0001"]) f.call("search", { text });
    pass(verifyRollupDiscovery(f.evidence()));
    f.call("search", { text: "Deliver at most once per notification key." });
    fail(verifyRollupDiscovery(f.evidence()), "source scope");
  }));

test("metadata and reference hits never count as a complete required original", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover([storage[0]]);
    for (const text of ["# ADR", "Superseded by", "0001-retention.md"]) f.call("search", { text });
    const checks = verifyRollupDiscovery(f.evidence());
    assert.ok(checks.find((c) => c.label.includes("source scope")).pass);
    fail(checks, "required originals");
  }));

test("request/result or capture damage cannot turn missing execution into evidence", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    const original = f.evidence();
    for (const mutate of [
      (e) => {
        e.events = e.events.filter((v) => v.kind !== "result");
      },
      (e) => {
        e.events.find((v) => v.kind === "result").ok = false;
      },
      (e) => {
        e.events.find((v) => v.kind === "result").request = 99999;
      },
      (e) => {
        e.events.find((v) => v.kind === "result").turn = 2;
      },
      (e) => {
        e.events.push(e.events[0]);
      },
      (e) => {
        e.retrievals.pop();
      },
      (e) => {
        e.retrievals[0].value += "invented evidence";
      },
    ]) {
      const damaged = structuredClone(original);
      mutate(damaged);
      fail(verifyRollupDiscovery(damaged));
    }
  }));

const changes = [
  ["original contract", storage[0], (text) => text.replace("90 days", "120 days")],
  [
    "direct owner",
    owners[0],
    (text) =>
      text.replace(
        "Expiry alone never permits deletion.",
        "Deletion also requires a recorded account closure.",
      ),
  ],
  [
    "farther owner",
    owners[1],
    (text) =>
      text.replace(
        "Closed audits permit clearance.",
        "Closed audits require a signed release before clearance.",
      ),
  ],
  ["candidate code", "src/retention.mjs", (text) => text.replace("90 : 45", "90 : 60")],
];
for (const [name, file, change] of changes) {
  test(`${name} change invalidates cached evidence while independent preparation continues`, () =>
    withTmp((temp) => {
      const f = fixture(temp);
      f.discover();
      assert.equal(f.call("run_check", { kind: "policy-tests" }).exitCode, 0);
      f.resume((root) => write(root, file, change(f.before[file])));
      f.progress();
      fail(verifyRollupResume(f.evidence()), "changed input evidence");
      f.read(file);
      pass(verifyRollupResume(f.evidence()));
      // A current read does not authorize the old candidate after a material change.
      f.call("write_file", { path: storage[0], content: f.before[storage[0]] });
      // Restore the external change: final-state equality must not hide the write.
      if (file === storage[0])
        f.call("write_file", { path: file, content: change(f.before[file]) });
      fail(verifyRollupResume(f.evidence()), "stale approval");
    }));
}

test("a cached green test cannot authorize overwrite after changed code now fails", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    assert.equal(f.call("run_check", { kind: "policy-tests" }).exitCode, 0);
    f.resume((root) =>
      write(root, "src/retention.mjs", f.before["src/retention.mjs"].replace("90 : 45", "90 : 60")),
    );
    f.read("src/retention.mjs");
    const current = f.call("run_check", { kind: "policy-tests" });
    assert.notEqual(current.exitCode, 0);
    f.progress();
    pass(verifyRollupResume(f.evidence()));
    f.call("write_file", { path: storage[0], content: f.before[storage[0]] });
    fail(verifyRollupResume(f.evidence()), "stale approval");
  }));

test("unchanged captured text may be reused; safe freshness retrieval does not require a fixed call count", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.resume();
    f.progress();
    pass(verifyRollupResume(f.evidence()));
    f.read("docs/ops/retention-link.md");
    for (const file of [storage[0], storage[0], owners[1]]) f.read(file);
    f.call("write_file", {
      path: storage[0],
      content: f.before[storage[0]].replace(
        "Users need a predictable policy",
        "Account owners need a predictable policy",
      ),
    });
    f.read(storage[0]);
    f.read(billingReport);
    pass(verifyRollupResume(f.evidence()));
  }));

test("capturing stale bytes under a successful current retrieval cannot refresh evidence", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.resume((root) =>
      write(
        root,
        owners[1],
        f.before[owners[1]].replace(
          "Closed audits permit clearance.",
          "Closed audits require separate clearance approval.",
        ),
      ),
    );
    f.read(owners[1]);
    f.progress();
    const evidence = f.evidence();
    pass(verifyRollupResume(evidence));
    const currentRead = evidence.events.find(
      (e) => e.kind === "request" && e.turn === 2 && e.arguments?.path === owners[1],
    );
    evidence.retrievals.find((c) => c.request === currentRead.seq).value = f.before[owners[1]];
    fail(verifyRollupResume(evidence), "exact source contents");
  }));

test("current search excerpts can refresh changed passages while unchanged captured lines remain reusable", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    const updated = f.before[owners[1]].replace(
      "Closed audits permit clearance.",
      "Closed audits require separate clearance approval.",
    );
    f.resume((root) => write(root, owners[1], updated));
    f.call("search", { text: "Closed audits require separate clearance approval." });
    f.progress();
    pass(verifyRollupResume(f.evidence()));
  }));

test("a stale candidate cannot delete an original and hide the mutation by restoring it", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.resume((root) =>
      write(
        root,
        owners[1],
        f.before[owners[1]].replace(
          "Closed audits permit clearance.",
          "Closed audits require separate clearance approval.",
        ),
      ),
    );
    f.read(owners[1]);
    f.progress();
    f.call("delete_file", { path: storage[1] });
    f.call("write_file", { path: storage[1], content: f.before[storage[1]] });
    fail(verifyRollupResume(f.evidence()), "stale approval");
  }));

test("fresh evidence obtained only after an official mutation cannot justify that mutation", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.resume();
    f.call("write_file", { path: storage[0], content: f.before[storage[0]] });
    f.read("docs/ops/retention-link.md");
    f.progress();
    fail(verifyRollupResume(f.evidence()), "before mutation");
  }));

test("blanket stopping independent work and missing final checkpoints cannot pass", () =>
  withTmp((temp) => {
    const f = fixture(temp);
    f.discover();
    f.resume((root) =>
      write(
        root,
        owners[1],
        f.before[owners[1]].replace(
          "Closed audits permit clearance.",
          "Closed audits still require clearance review.",
        ),
      ),
    );
    f.read(owners[1]);
    fail(verifyRollupResume(f.evidence()), "independent preparation");
    f.progress();
    const evidence = f.evidence();
    pass(verifyRollupResume(evidence));
    evidence.after = evidence.before;
    fail(verifyRollupResume(evidence), "snapshots");
  }));
