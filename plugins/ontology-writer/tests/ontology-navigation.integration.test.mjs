import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { cachedRepo, commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import { EXAMPLE, cli } from "./ontology-helpers.mjs";
import { HEAD, MAPPING } from "./ontology-query-helpers.mjs";

function repo(dir) {
  cachedRepo(dir, "layered BC navigation", (at) => {
    initRepo(at);
    const categories = {
      ordering: MAPPING.categories.ordering,
      payments: MAPPING.categories.payments,
    };
    write(at, "docs/adr/.mapping.json", JSON.stringify({ categories }, null, 2));
    writeAdrFiles(at, { categories });
    write(at, "docs/ontology/model.ttl", EXAMPLE);
    commitAll(at, "layered knowledge");
  });
}
const hash = (dir, file) =>
  createHash("sha256")
    .update(readFileSync(path.join(dir, file)))
    .digest("hex");
const json = (dir, args, expectedCode = 0) => {
  const result = cli(dir, [...args, "--json"]);
  assert.equal(result.code, expectedCode, result.out);
  return JSON.parse(result.out);
};

test("the CLI follows authored BC knowledge through internal search and a step into its ADR without writes", () => {
  withTmp((dir) => {
    repo(dir);
    const files = [
      "docs/ontology/model.ttl",
      "docs/adr/.mapping.json",
      "docs/adr/ordering/0001-confirm.md",
    ];
    const before = files.map((f) => hash(dir, f));
    const top = json(dir, ["query", "--overview"]);
    assert.equal(top.knowledgeLayerComplete, true);
    assert.deepEqual(
      top.items.map((i) => i.kind),
      ["context", "context", "collaboration"],
    );
    const search = json(dir, [
      "query",
      "--context",
      "ordering",
      "--search",
      "paid order",
      "--limit",
      "3",
    ]);
    assert.ok(search.items.length <= 3);
    assert.ok(
      search.items.some(
        (i) => i.id === "ordering.confirm-order" || i.id === "ordering.confirm-on-payment",
      ),
    );
    const step = json(dir, ["query", "--step", "ordering.confirm-order"]);
    assert.equal(
      step.steps[0].step.realizedBy[0].adrs[0].path,
      "docs/adr/ordering/0001-confirm.md",
    );
    assert.equal(step.steps[0].performers[0].id, "order-system");
    assert.match(
      cli(dir, ["query", "--step", "ordering.confirm-order"]).out,
      /docs\/adr\/ordering\/0001-confirm\.md/,
    );
    assert.deepEqual(
      files.map((f) => hash(dir, f)),
      before,
    );
    assert.equal(git(dir, ["status", "--porcelain"]).trim(), "");
  });
});

test("the CLI distinguishes readable legacy knowledge from strict construction and supports scoped checks", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/ontology/legacy.ttl",
      `${HEAD}m:legacy a onto:BoundedContext ; rdfs:label "Legacy" ; onto:definition "Prior work." .\n`,
    );
    const before = hash(dir, "docs/ontology/legacy.ttl");
    const readable = json(dir, ["validate"]);
    assert.ok(
      readable.findings.some((f) => f.code === "ontology-layer-core-missing" && f.level === "warn"),
    );
    const strict = json(dir, ["validate", "--require-layers"], 1);
    assert.ok(strict.findings.some((f) => f.element === "legacy" && f.level === "error"));
    assert.equal(
      json(dir, ["validate", "--require-layers", "--layer-context", "ordering"]).ok,
      true,
    );
    assert.equal(
      json(dir, ["validate", "--require-layers", "--layer-context", "ghost"], 1).ok,
      false,
    );
    const top = json(dir, ["query", "--overview"]);
    assert.equal(top.knowledgeLayerComplete, false);
    assert.equal(top.items.find((i) => i.id === "legacy").coreLogic, null);
    assert.equal(hash(dir, "docs/ontology/legacy.ttl"), before);
  });
});

test("new BCs cannot pass impact or save until their upper knowledge is authored", () => {
  withTmp((dir) => {
    repo(dir);
    const before = hash(dir, "docs/ontology/model.ttl");
    const unlayered =
      EXAMPLE +
      '\nm:new-work a onto:BoundedContext ; rdfs:label "New work" ; onto:definition "A separate business responsibility." .\n';
    write(dir, "draft/model.ttl", unlayered);
    const rejected = json(dir, ["impact", "--draft", "draft"], 1);
    assert.ok(JSON.stringify(rejected).includes("ontology-layer-core-missing"));
    const save = cli(dir, ["apply", "--draft", "draft", "--base-hash", "not-approved"]);
    assert.equal(save.code, 1);
    assert.match(save.out, /ontology-layer-core-missing/);
    assert.equal(hash(dir, "docs/ontology/model.ttl"), before);

    const layered = unlayered.replace(
      'onto:definition "A separate business responsibility." .',
      'onto:definition "A separate business responsibility." ; onto:coreLogic "A request is checked and produces a business response." .',
    );
    write(dir, "draft/model.ttl", layered);
    const proposal = json(dir, ["impact", "--draft", "draft", "--require-layers"]);
    assert.ok(proposal.baseHash);
    const applied = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--require-layers",
      "--base-hash",
      proposal.baseHash,
      "--log",
      "New work: record its business responsibility and core logic.",
    ]);
    assert.equal(applied.code, 0, applied.out);
    assert.match(
      readFileSync(path.join(dir, "docs/ontology/model.ttl"), "utf8"),
      /A request is checked and produces a business response/,
    );
    assert.equal(json(dir, ["validate", "--require-layers"]).ok, true);
  });
});

test("untrusted ADR records and unreadable model files stay visible in BC navigation", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/adr/ordering/0001-confirm.md",
      "# Confirm\n\n## Status\n\nAccepted (2026-01-01)\n",
    );
    const context = json(dir, ["query", "--context", "ordering", "--limit", "1"], 1);
    assert.equal(context.complete, false);
    assert.ok(context.errorCount > 0);
    assert.ok(context.items.length <= 1);
    const step = json(dir, ["query", "--step", "ordering.confirm-order"], 1);
    assert.equal(step.steps[0].step.realizationUnknown, true);
    write(dir, "docs/ontology/model.ttl", "invalid turtle");
    const broken = json(dir, ["query", "--overview"], 1);
    assert.equal(broken.found, null);
    assert.ok(broken.validationSample.some((f) => f.where.startsWith("docs/ontology/model.ttl:")));
  });
});

test("custom ADR directories and page continuations preserve the caller's target", () => {
  withTmp((dir) => {
    initRepo(dir);
    const custom = {
      categories: Object.fromEntries(
        Object.entries(MAPPING.categories)
          .filter(([k]) => ["ordering", "payments"].includes(k))
          .map(([k, entry]) => [
            k,
            {
              ...entry,
              adrs: entry.adrs.map((a) => ({ ...a, path: a.path.replace("docs/adr", "spec/adr") })),
            },
          ]),
      ),
    };
    write(dir, "spec/adr/.mapping.json", JSON.stringify(custom));
    writeAdrFiles(dir, custom);
    write(dir, "spec/ontology/model.ttl", EXAMPLE);
    commitAll(dir, "custom model location");
    const first = json(dir, [
      "query",
      "--context",
      "ordering",
      "--limit",
      "2",
      "--adr-dir",
      "spec/adr",
    ]);
    assert.equal(first.next.offset, 2);
    const second = json(dir, [
      "query",
      "--context",
      first.next.target.id,
      "--limit",
      String(first.next.limit),
      "--offset",
      String(first.next.offset),
      "--adr-dir",
      "spec/adr",
    ]);
    assert.ok(first.items.every((a) => !second.items.some((b) => b.key === a.key)));
    const step = json(dir, ["query", "--step", "ordering.confirm-order", "--adr-dir", "spec/adr"]);
    assert.equal(
      step.steps[0].step.realizedBy[0].adrs[0].path,
      "spec/adr/ordering/0001-confirm.md",
    );
  });
});

test("invalid query combinations and page values are rejected as usage errors", () => {
  withTmp((dir) => {
    for (const args of [
      ["query", "--overview", "--context", "ordering"],
      ["query", "--context", "ordering", "--limit", "0"],
      ["query", "--context", "ordering", "--limit", "101"],
      ["query", "--context", "ordering", "--offset", "1.5"],
      ["query", "--overview", "--search", " "],
      ["query", "--step", "ordering.confirm-order", "--limit", "1"],
      ["validate", "--layer-context", "ordering"],
    ])
      assert.equal(cli(dir, args).code, 2, args.join(" "));
    assert.equal(json(dir, ["query", "--overview"]).model, false);
  });
});
