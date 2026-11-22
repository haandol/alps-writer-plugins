import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { commitAll, git, initRepo, mkTmp, PLUGIN_ROOT, withTmp, write } from "./helpers.mjs";
import { seedClean } from "./structure-lint-helpers.mjs";

const adr = "docs/adr/identity/login/0001-password-policy.md";
const peer = "docs/adr/identity/login/0002-rate-limit.md";
const result = {
  verdict: "FIX_REQUIRED",
  review: "R18: the time limit is missing.",
  r19: "The deadline determines whether the second request passes; no boundary is specified.",
};
function setup(dir) {
  initRepo(dir);
  seedClean(dir);
  write(dir, ".gitignore", ".adr-review/\n");
  write(dir, "requirements.md", "Initial supplied context");
  commitAll(dir);
  const command = (script, args, input) =>
    spawnSync(process.execPath, [path.join(PLUGIN_ROOT, "scripts", script), ...args], {
      cwd: dir,
      encoding: "utf8",
      input: input && JSON.stringify(input),
    });
  const manifest = {
    target: "identity/login",
    documents: { [adr]: { files: ["requirements.md"] } },
  };
  const call = (args, data) => command("adr-review-progress.mjs", args, data);
  const ok = (args, data) => {
    const out = call(args, data);
    assert.equal(out.status, 0, out.stderr);
    return JSON.parse(out.stdout);
  };
  const run = ".adr-review/a";
  ok(["plan", run, "--inputs"], manifest);
  return { ok, call, manifest, run, later: ".adr-review/b" };
}

test("restart retains per-document verdicts and R19 evidence and leaves unfinished documents for review", () => {
  withTmp((dir) => {
    const { ok, call, manifest, run, later } = setup(dir);
    const initial = ok(["plan", run]);
    assert.deepEqual(
      initial.map((i) => i.action),
      ["review", "review"],
    );
    ok(["record", run, adr, initial[0].key], result);
    const resumed = ok(["plan", run]);
    assert.deepEqual(
      resumed.map((i) => i.action),
      ["reuse", "review"],
    );
    assert.equal(resumed[0].verdict, "FIX_REQUIRED");
    assert.equal(
      JSON.parse(readFileSync(path.join(dir, run, "review-progress.json"))).records[adr].r19,
      result.r19,
    );
    ok(["record", run, peer, initial[1].key], { ...result, verdict: "BLOCK" });
    assert.notEqual(call(["plan", later, run]).status, 0);
    const repeated = ok(["plan", later, "--inputs"], manifest);
    assert.deepEqual(
      repeated.map((i) => i.action),
      ["review", "review"],
    );
    assert.notEqual(call(["record", later, adr, initial[0].key], result).status, 0);
    const file = path.join(dir, run, "review-progress.json");
    write(dir, "requirements.md", "Updated supplied context");
    assert.deepEqual(
      ok(["plan", run]).map((i) => i.action),
      ["review", "reuse"],
    );
    writeFileSync(file, "{");
    assert.equal(ok(["plan", run])[0].action, "review");
  });
});

test("changed inputs, unknown evidence and lint errors cannot silently yield a reusable PASS", () => {
  withTmp((dir) => {
    const { ok, call, manifest, run } = setup(dir);
    const plan = () => ok(["plan", run])[0];
    const initial = plan();
    const passing = { ...result, verdict: "PASS" };
    ok(["record", run, adr, initial.key], passing);
    const file = path.join(dir, run, "review-progress.json");
    manifest.documents[adr].intent = "Owner added a deadline.";
    ok(["plan", run, "--inputs"], manifest);
    assert.equal(plan().action, "review");
    assert.notEqual(call(["record", run, adr, initial.key], passing).status, 0);
    assert.equal(JSON.parse(readFileSync(file)).records[adr].key, initial.key);
    write(dir, adr, readFileSync(path.join(dir, adr), "utf8") + "\nSee example.alps.xml.\n");
    assert.notEqual(call(["record", run, adr, plan().key], passing).status, 0);
    assert.notEqual(call(["record", run, adr, plan().key], { ...result, r19: "" }).status, 0);
    manifest.documents[adr].files = ["not-available.md"];
    ok(["plan", run, "--inputs"], manifest);
    assert.equal(plan().key, undefined);
  });
});

test("an unchecked Git input affects its own documents, while changed shared rules require both reviews", () => {
  withTmp((dir) => {
    const { ok, run } = setup(dir);
    for (const item of ok(["plan", run])) ok(["record", run, item.path, item.key], result);
    git(dir, ["update-index", "--assume-unchanged", "requirements.md"]);
    assert.deepEqual(
      ok(["plan", run]).map((x) => x.action),
      ["review", "reuse"],
    );
    git(dir, ["update-index", "--no-assume-unchanged", "requirements.md"]);
    assert.deepEqual(
      ok(["plan", run]).map((x) => x.action),
      ["reuse", "reuse"],
    );
    write(dir, "docs/adr/authoring-rules.md", "Changed project rules");
    assert.deepEqual(
      ok(["plan", run]).map((x) => x.action),
      ["review", "review"],
    );
  });
});

test("declared dependency documents invalidate reused results and stale recording keys", () => {
  withTmp((dir) => {
    const { ok, call, run } = setup(dir);
    const mapFile = path.join(dir, "docs/adr/.mapping.json");
    const mapping = JSON.parse(readFileSync(mapFile));
    const dependency = "docs/adr/orders/0001-approval.md";
    mapping.categories.orders = {
      adrs: [{ path: dependency, status: "Proposed", summary: "Approval rules" }],
      dependsOn: [],
    };
    mapping.categories["identity/login"].dependsOn = ["orders"];
    writeFileSync(mapFile, JSON.stringify(mapping));
    write(dir, dependency, "# Order approval\n");
    commitAll(dir);
    const initial = ok(["plan", run]);
    for (const item of initial) ok(["record", run, item.path, item.key], result);
    assert.deepEqual(
      ok(["plan", run]).map((x) => x.action),
      ["reuse", "reuse"],
    );
    write(dir, dependency, "# Revised order approval\n");
    assert.deepEqual(
      ok(["plan", run]).map((x) => x.action),
      ["review", "review"],
    );
    assert.notEqual(call(["record", run, adr, initial[0].key], result).status, 0);
  });
});

test("an unreadable project index keeps document review available without reusing a verdict", () => {
  withTmp((dir) => {
    const { ok, run } = setup(dir);
    write(dir, "docs/adr/.mapping.json", "{");
    const [item] = ok(["plan", run]);
    assert.equal(item.action, "review");
    ok(["record", run, adr, item.key], result);
    assert.equal(
      JSON.parse(readFileSync(path.join(dir, run, "review-progress.json"))).records[adr].base,
      null,
    );
    assert.equal(ok(["plan", run])[0].action, "review");
  });
});

test("one disposable checkpoint resumes only its own task and the delivered report survives finish", () => {
  withTmp((dir) => {
    const { ok, run, later, manifest } = setup(dir);
    const fresh = ok(["plan", run, "--with-lint"]);
    assert.equal(fresh.lint.documents.length, 2);
    for (const item of fresh.documents) ok(["record", run, item.path, item.key], result);
    const checkpoint = path.join(dir, run, "review-progress.json");
    assert.deepEqual(readdirSync(path.join(dir, run)), ["review-progress.json"]);
    assert.deepEqual(
      ok(["plan", run]).map((i) => [i.action, i.r19]),
      [
        ["reuse", result.r19],
        ["reuse", result.r19],
      ],
    );
    ok(["plan", later, "--inputs"], manifest);
    copyFileSync(checkpoint, path.join(dir, later, "review-progress.json"));
    assert.deepEqual(
      ok(["plan", later, "--inputs"], manifest).map((i) => i.action),
      ["review", "review"],
    );
    write(dir, run + "/report.html", "final result with evidence");
    assert.equal(ok(["finish", run]).removed, true);
    assert.deepEqual(readdirSync(path.join(dir, run)), ["report.html"]);
    assert.equal(ok(["finish", run]).removed, false);
    assert.deepEqual(
      ok(["plan", run, "--inputs"], manifest).map((i) => i.action),
      ["review", "review"],
    );
    rmSync(checkpoint);
    write(dir, later + "/lint.json", "unusable intermediate from an older version");
    assert.equal(ok(["plan", later, "--with-lint"]).documents.length, 2);
    assert.equal(existsSync(checkpoint), false);
  });
});

test("a separate task's working file cannot be registered as an input even if it exists", () => {
  withTmp((dir) => {
    const { call, ok, run, later, manifest } = setup(dir);
    ok(["plan", later, "--inputs"], manifest);
    manifest.documents[adr].files = [later + "/review-progress.json"];
    const out = call(["plan", run, "--inputs"], manifest);
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /another task/i);
    assert.ok(!readFileSync(path.join(dir, run, "review-progress.json"), "utf8").includes(later));
  });
});

test("parallel results survive in one checkpoint for a fresh reviewer process", async () => {
  const dir = mkTmp();
  try {
    const { ok, run } = setup(dir);
    const items = ok(["plan", run]);
    const children = items.map((item) =>
      Bun.spawn(
        [
          process.execPath,
          path.join(PLUGIN_ROOT, "scripts/adr-review-progress.mjs"),
          "record",
          run,
          item.path,
          item.key,
        ],
        {
          cwd: dir,
          stdin: new TextEncoder().encode(JSON.stringify(result)),
          stdout: "ignore",
          stderr: "pipe",
        },
      ),
    );
    for (const child of children)
      assert.equal(await child.exited, 0, await new Response(child.stderr).text());
    assert.deepEqual(
      ok(["plan", run]).map((item) => item.action),
      ["reuse", "reuse"],
    );
    assert.deepEqual(readdirSync(path.join(dir, run)), ["review-progress.json"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
