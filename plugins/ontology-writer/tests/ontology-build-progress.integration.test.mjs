import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { initRepo, PLUGIN_ROOT, withTmp } from "./helpers.mjs";

const script = path.join(PLUGIN_ROOT, "scripts/ontology-build-progress.mjs");
const first = {
  scope: "주문 확정",
  stage: "sources",
  unit: "주문 정책",
  finding: "결제된 주문에 확정 책임이 있다.",
  open: ["반려 시 담당자 미확인"],
  references: ["policy.md#orders"],
  next: "인계 사건을 연결한다.",
};
function cli(cwd, args, input, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    input: JSON.stringify(input),
    encoding: "utf8",
    ...options,
  });
}
function ok(cwd, args, input, options) {
  const result = cli(cwd, args, input, options);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("a fresh session recovers each completed batch, map, boundary and workflow before the next step", () => {
  withTmp((dir) => {
    initRepo(dir);
    mkdirSync(path.join(dir, "nested"));
    writeFileSync(path.join(dir, "policy.md"), "original source text");
    const { run } = ok(dir, ["save"], first);
    for (const [index, stage] of [
      "sources",
      "sources",
      "event-map",
      "boundaries",
      "workflow",
    ].entries()) {
      const unit =
        index === 0
          ? first
          : {
              ...first,
              stage,
              unit: `unit-${index}`,
              finding: `finding-${index}`,
              next: `next-${index}`,
            };
      if (index) ok(dir, ["save", run], unit);
      const { selected } = ok(path.join(dir, "nested"), ["resume"]);
      assert.equal(selected.run, run);
      assert.equal(selected.scope, first.scope);
      assert.equal(selected.next, unit.next);
      assert.equal(selected.units.length, index + 1);
      const last = selected.units.at(-1);
      for (const field of ["unit", "stage", "finding", "open", "references"])
        assert.deepEqual(last[field], unit[field]);
      assert.deepEqual(last.recheck, []);
      assert.equal(last.modelFilesChanged, false);
    }
    assert.deepEqual(readdirSync(run), ["build-progress.json"]);
    assert.doesNotMatch(
      readFileSync(path.join(run, "build-progress.json"), "utf8"),
      /original source text/,
    );
    assert.ok(
      !existsSync(path.join(dir, "docs")),
      "no model, ADR or candidate is required or created",
    );
  });
});

test("ambiguity requires selection and completed work drops out of discovery", () => {
  withTmp((dir) => {
    const { run: a } = ok(dir, ["save"], first);
    const { run: b } = ok(dir, ["save"], { ...first, scope: "주문 취소" });
    const snapshots = [a, b].map((run) =>
      readFileSync(path.join(run, "build-progress.json"), "utf8"),
    );
    const choice = ok(dir, ["resume", "주문"]);
    assert.equal(choice.selected, undefined);
    assert.deepEqual(choice.matches.map((m) => m.scope).sort(), ["주문 확정", "주문 취소"].sort());
    assert.equal(ok(dir, ["resume", "취소"]).selected.run, b);
    assert.equal(ok(dir, ["show", a]).scope, first.scope);
    assert.deepEqual(
      [a, b].map((run) => readFileSync(path.join(run, "build-progress.json"), "utf8")),
      snapshots,
    );
    ok(dir, ["finish", b]);
    assert.equal(ok(dir, ["resume"]).selected.run, a);
    assert.equal(ok(dir, ["show", b]).complete, true);
    assert.equal(cli(dir, ["save", b], first).status, 1);
    ok(dir, ["finish", a]);
    assert.deepEqual(ok(dir, ["resume"]).matches, []);
  });
});

test("recovery identifies changed evidence, scope and new model areas without changing business documents", () => {
  withTmp((dir) => {
    const write = (name, text) => writeFileSync(path.join(dir, name), text);
    write("policy.md", "policy v1");
    write("ops.md", "operations");
    const { run } = ok(dir, ["save"], { ...first, references: ["policy.md#orders", "ops.md"] });
    ok(dir, ["save", run], { ...first, unit: "운영", references: ["ops.md"] });
    mkdirSync(path.join(dir, "docs/ontology"), { recursive: true });
    write("docs/ontology/orders.ttl", "model v1");
    ok(dir, ["save", run], {
      ...first,
      scope: "주문과 취소",
      stage: "boundaries",
      unit: "책임",
      references: ["docs/ontology/orders.ttl", "conversation:운영자"],
    });
    write("policy.md", "policy v2");
    write("docs/ontology/orders.ttl", "model v2");
    const { selected } = ok(dir, ["resume"]);
    const [policy, operations, boundaries] = selected.units;
    assert.deepEqual(policy.recheck, [{ location: "policy.md#orders", reason: "changed" }]);
    assert.equal(policy.modelFilesChanged, true);
    assert.equal(policy.scopeChanged, true);
    assert.deepEqual(operations.recheck, []);
    assert.equal(boundaries.scopeChanged, false);
    assert.equal(boundaries.modelFilesChanged, false);
    assert.deepEqual(boundaries.recheck, [
      { location: "docs/ontology/orders.ttl", reason: "changed" },
      { location: "conversation:운영자", reason: "verify-at-source" },
    ]);
    assert.equal(readFileSync(path.join(dir, "docs/ontology/orders.ttl"), "utf8"), "model v2");
    assert.ok(!existsSync(path.join(dir, "docs/adr")));
    rmSync(path.join(dir, "ops.md"));
    assert.equal(ok(dir, ["show", run]).units[1].recheck[0].reason, "missing");
  });
});

test("file sections retain their cited locations when a source changes or its alias moves", () => {
  withTmp((dir) => {
    const policy = path.join(dir, "policy.md");
    const alias = path.join(dir, "policy-alias.md");
    writeFileSync(policy, "policy A");
    writeFileSync(path.join(dir, "replacement.md"), "policy B");
    symlinkSync("policy.md", alias);
    const references = ["policy.md#orders", "./policy.md#refunds", "policy-alias.md#returns"];
    const { run } = ok(dir, ["save"], { ...first, references });
    const summary = () => ok(dir, ["show", run]).units[0];
    assert.deepEqual(summary().recheck, []);

    rmSync(alias);
    symlinkSync("replacement.md", alias);
    assert.deepEqual(summary().recheck, [{ location: references[2], reason: "changed" }]);
    writeFileSync(policy, "policy C");
    const current = summary();
    assert.deepEqual(current.references, references);
    assert.deepEqual(
      current.recheck,
      references.map((location) => ({ location, reason: "changed" })),
    );
  });
});

test("a failed or interrupted update leaves the last complete summary and a retry replaces its unit", () => {
  withTmp((dir) => {
    const { run } = ok(dir, ["save"], first);
    const committed = readFileSync(path.join(run, "build-progress.json"), "utf8");
    writeFileSync(path.join(run, ".build-progress-interrupted.tmp"), '{"version":');
    const failed = cli(dir, ["save", run], { ...first, finding: "" });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /finding/);
    assert.equal(readFileSync(path.join(run, "build-progress.json"), "utf8"), committed);
    if (process.getuid?.() > 0) {
      chmodSync(run, 0o500);
      try {
        const denied = cli(dir, ["save", run], { ...first, finding: "unwritten" });
        assert.notEqual(denied.status, 0);
        assert.equal(readFileSync(path.join(run, "build-progress.json"), "utf8"), committed);
      } finally {
        chmodSync(run, 0o700);
      }
    }
    assert.equal(ok(dir, ["resume"]).selected.units[0].finding, first.finding);
    ok(dir, ["save", run], { ...first, finding: "수정된 발견" });
    const state = ok(dir, ["resume"]).selected;
    assert.equal(state.units.length, 1);
    assert.equal(state.units[0].finding, "수정된 발견");
  });
});

test("a build can use its own working file and rejects another task's file or link", () => {
  withTmp((dir) => {
    const a = ok(dir, ["save"], first).run;
    const b = ok(dir, ["save"], { ...first, scope: "반품" }).run;
    const own = path.join(a, "notes.md"),
      foreign = path.join(b, "notes.md");
    writeFileSync(own, "current notes");
    writeFileSync(foreign, "other notes");
    ok(dir, ["save", a], { ...first, references: [path.relative(dir, own)] });
    const checkpoint = path.join(a, "build-progress.json");
    const original = readFileSync(checkpoint);
    symlinkSync(foreign, path.join(dir, "linked.md"));
    for (const location of [path.relative(dir, foreign), "linked.md"]) {
      const denied = cli(dir, ["save", a], { ...first, references: [location] });
      assert.notEqual(denied.status, 0);
      assert.match(denied.stderr, /another task/i);
      assert.deepEqual(readFileSync(checkpoint), original);
    }
    const legacy = JSON.parse(original);
    delete legacy.task;
    legacy.units[0].references = [path.relative(dir, foreign)];
    writeFileSync(checkpoint, JSON.stringify(legacy));
    const selected = ok(dir, ["resume", "확정"]).selected;
    assert.equal(selected.run, a);
    assert.equal(selected.units[0].finding, undefined);
    assert.deepEqual(selected.units[0].recheck, [{ reason: "rebuild-from-original-sources" }]);
  });
});

test("resume lists task scopes without opening other units and a copied checkpoint does not become a new task", () => {
  withTmp((dir) => {
    const a = ok(dir, ["save"], first).run;
    const b = ok(dir, ["save"], { ...first, scope: "반품" }).run;
    const file = path.join(b, "build-progress.json");
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.slice(0, text.indexOf('"units": [') + '"units": ['.length) + "broken");
    const list = ok(dir, ["resume"]);
    assert.deepEqual(
      list.matches.map((x) => Object.keys(x)),
      [
        ["run", "scope"],
        ["run", "scope"],
      ],
    );
    assert.deepEqual(list.warnings, []);
    assert.equal(ok(dir, ["resume", "확정"]).selected.run, a);
    assert.equal(cli(dir, ["show", b]).status, 1);
    writeFileSync(file, readFileSync(path.join(a, "build-progress.json")));
    assert.equal(cli(dir, ["show", b]).status, 1);
    assert.equal(ok(dir, ["resume"]).selected.run, a);
    rmSync(path.join(a, "build-progress.json"));
    assert.deepEqual(ok(dir, ["resume"]).matches, []);
    assert.equal(ok(dir, ["save", b], { ...first, scope: "새 업무" }).scope, "새 업무");
  });
});

test("the project can discover its temporary fallback without inspecting another project's run", () => {
  withTmp((dir) => {
    const temp = path.join(dir, "temporary");
    mkdirSync(temp);
    const options = { env: { ...process.env, TMPDIR: temp } };
    const projects = ["one", "two"].map((name) => {
      const project = path.join(dir, name);
      mkdirSync(project);
      writeFileSync(path.join(project, ".adr-review"), "occupied");
      return project;
    });
    const [one, two] = projects.map((project) => ok(project, ["save"], first, options));
    assert.equal(path.dirname(one.run), temp);
    assert.equal(ok(projects[0], ["resume"], undefined, options).selected.run, one.run);
    assert.equal(ok(projects[1], ["resume"], undefined, options).selected.run, two.run);
    assert.equal(cli(projects[1], ["finish", one.run], undefined, options).status, 1);
  });
});

test("a local run remains usable when the configured temporary directory is missing", () => {
  withTmp((dir) => {
    const options = { env: { ...process.env, TMPDIR: path.join(dir, "missing") } };
    const { run } = ok(dir, ["save"], first, options);
    assert.equal(ok(dir, ["resume"], undefined, options).selected.run, run);
    assert.equal(ok(dir, ["show", run], undefined, options).scope, first.scope);
    assert.equal(ok(dir, ["finish", run], undefined, options).complete, true);
  });
});

test("a linked temporary directory returns the same fallback run across sessions", () => {
  withTmp((dir) => {
    const temp = path.join(dir, "temporary");
    const alias = path.join(dir, "temp-alias");
    mkdirSync(temp);
    symlinkSync(temp, alias, "dir");
    writeFileSync(path.join(dir, ".adr-review"), "occupied");
    const options = { env: { ...process.env, TMPDIR: alias } };
    const { run } = ok(dir, ["save"], first, options);
    assert.equal(path.dirname(run), realpathSync(temp));
    assert.equal(ok(dir, ["resume"], undefined, options).selected.run, run);
    assert.equal(
      ok(dir, ["show", path.join(alias, path.basename(run))], undefined, options).run,
      run,
    );
  });
});

test(
  "an unreadable review directory still lists accessible temporary runs with a warning",
  {
    skip: !(process.getuid?.() > 0),
  },
  () => {
    withTmp((dir) => {
      const local = path.join(dir, ".adr-review");
      const temp = path.join(dir, "temporary");
      mkdirSync(local);
      mkdirSync(temp);
      const options = { env: { ...process.env, TMPDIR: temp } };
      chmodSync(local, 0);
      try {
        const { run } = ok(dir, ["save"], first, options);
        const result = ok(dir, ["resume"], undefined, options);
        assert.equal(result.selected, undefined);
        assert.deepEqual(result.matches, [{ run, scope: first.scope }]);
        assert.deepEqual(
          result.warnings.map((warning) => warning.run),
          [local],
        );
        assert.equal(ok(dir, ["show", run], undefined, options).scope, first.scope);
      } finally {
        chmodSync(local, 0o700);
      }
    });
  },
);
