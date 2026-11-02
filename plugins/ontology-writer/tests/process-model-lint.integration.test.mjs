// The process-model CLI's semantic diff, canonical format and save path against a
// repository's history.
import assert from "node:assert/strict";
import { cpSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseTurtle } from "../scripts/process-model-lib.mjs";
import { commitAll, initRepo, withTmp, write } from "./helpers.mjs";
import { EXAMPLE, cli } from "./process-model-helpers.mjs";
import { fixture, SHUFFLED, PREFIXES } from "./process-model-lint-helpers.mjs";

test("diff reports semantic changes against a revision and ignores formatting", () => {
  withTmp((dir) => {
    initRepo(dir);
    fixture(dir);
    commitAll(dir);
    write(dir, "docs/process/ordering.ttl", `# reordered\n${SHUFFLED}`);
    const same = cli(dir, ["diff"]);
    assert.equal(same.code, 0, same.out);
    assert.match(same.out, /no semantic change against HEAD/);

    write(
      dir,
      "docs/process/ordering.ttl",
      EXAMPLE.replace('rdfs:label "Customer"', 'rdfs:label "Shopper"'),
    );
    const changed = JSON.parse(cli(dir, ["diff", "--json"]).out);
    assert.deepEqual(
      changed.elements.map((e) => [
        e.id,
        e.properties.map((p) => [p.property, p.family, p.removed, p.added]),
      ]),
      [["customer", [["rdfs:label", "fact", ['"Customer"'], ['"Shopper"']]]]],
    );
  });
});

test("format keeps an invalid model's graph, and the save path never drops comments silently", () => {
  withTmp((dir) => {
    fixture(dir, {
      model: SHUFFLED.replace(
        '    pm:definition "A person who buys products from the store." ;\n',
        "",
      ),
    });
    const graph = (text) =>
      parseTurtle(text)
        .triples.map((t) => `${t.s} ${t.p} ${JSON.stringify(t.o)}`)
        .sort()
        .join("\n");
    const before = readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8");
    assert.equal(cli(dir, ["validate"]).code, 1, "the model has a validation error");
    assert.equal(cli(dir, ["format", "--write"]).code, 0);
    const after = readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8");
    assert.notEqual(after, before, "the document was rewritten canonically");
    assert.equal(graph(after), graph(before), "and kept its graph");
    assert.match(cli(dir, ["validate"]).out, /process-attribute-missing/);
  });
  withTmp((dir) => {
    fixture(dir, { model: `# owner: ordering team\n${EXAMPLE}` });
    cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), { recursive: true });
    write(
      dir,
      "draft/ordering.ttl",
      EXAMPLE.replace('rdfs:label "Customer"', 'rdfs:label "Shopper"'),
    );
    const summary = JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json"]).out);
    assert.deepEqual(summary.commentsDroppedOnRewrite, ["docs/process/ordering.ttl"]);
    const refused = cli(dir, ["apply", "--draft", "draft", "--base-hash", summary.baseHash]);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /Turtle comments would be dropped/);
    assert.match(readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"), /^# owner/);
    const applied = cli(dir, [
      "apply",
      "--draft",
      "draft",
      "--base-hash",
      summary.baseHash,
      "--allow-comment-removal",
    ]);
    assert.equal(applied.code, 0, applied.out);
    assert.doesNotMatch(
      readFileSync(path.join(dir, "docs/process/ordering.ttl"), "utf8"),
      /# owner/,
    );
  });
});

test("diff reads documents as strictly as validation, and an invalid byte is located exactly", () => {
  withTmp((dir) => {
    initRepo(dir);
    fixture(dir);
    commitAll(dir);
    const bytes = Buffer.concat([
      Buffer.from(
        `${PREFIXES}m:customer pm:summary "real \u{FFFD} char" .\nm:customer pm:summary "caf`,
      ),
      Buffer.from([0xe9]),
      Buffer.from('" .\n'),
    ]);
    write(dir, "docs/process/escape.ttl", bytes);
    const out = cli(dir, ["diff"]);
    assert.equal(out.code, 1);
    assert.match(out.out, /escape\.ttl:6:\d+[\s\S]*not valid UTF-8/, out.out);
    assert.doesNotMatch(out.out, /caf�/);
  });
});

test("diff reads committed documents as strictly as the working tree", () => {
  withTmp((dir) => {
    initRepo(dir);
    fixture(dir);
    write(
      dir,
      "docs/process/x.ttl",
      Buffer.concat([
        Buffer.from(`${PREFIXES}m:customer pm:summary "caf`),
        Buffer.from([0xe9]),
        Buffer.from('" .\n'),
      ]),
    );
    commitAll(dir);
    // The working tree holds the repaired document, so only the committed one fails.
    write(dir, "docs/process/x.ttl", `${PREFIXES}m:customer pm:summary "café" .\n`);
    const out = cli(dir, ["diff"]);
    assert.equal(out.code, 1, out.out);
    assert.match(
      out.out,
      /✗ \[process-parse\] HEAD:docs\/process\/x\.ttl:5:27\n\s+the document is not valid UTF-8/,
    );
    assert.doesNotMatch(out.out, /\] docs\/process\/x\.ttl/);
  });
});
