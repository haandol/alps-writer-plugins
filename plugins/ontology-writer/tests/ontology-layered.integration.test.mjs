import assert from "node:assert/strict";
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { cli } from "./ontology-helpers.mjs";
import { commitAll, git, initRepo, withTmp, write } from "./helpers.mjs";
import {
  ADR_BODY,
  ADR_PATH,
  BUSINESS,
  BUSINESS_BOARD,
  LAYER_MAPPING,
  layeredData,
  writeLayeredFixture,
} from "./ontology-layered-helpers.mjs";

function runView(dir, extra = []) {
  const result = cli(dir, ["view", "--no-open", ...extra]);
  assert.equal(result.code, 0, result.out);
  const file = /NOT_OPENED (.+) — opening was not requested/.exec(result.out)?.[1];
  assert.ok(file, result.out);
  const html = readFileSync(file, "utf8");
  return { file, html, data: layeredData(html) };
}

test("the view CLI previews an explicit draft/index/board without creating or adopting a saved business model", () =>
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "draft/business.ttl", BUSINESS);
    write(dir, "draft-index.json", JSON.stringify(LAYER_MAPPING));
    write(dir, "business-board.json", JSON.stringify(BUSINESS_BOARD));
    write(dir, ADR_PATH, ADR_BODY);
    write(dir, "docs/adr/billing/0001-credit.md", "# Credit\n\n## Status\n\nProposed\n");
    commitAll(dir);
    const before = git(dir, ["status", "--porcelain"]);
    const { data } = runView(dir, [
      "--draft",
      "draft",
      "--mapping",
      "draft-index.json",
      "--board",
      "business-board.json",
    ]);
    assert.equal(data.sourceKind, "draft");
    assert.equal(data.containers.length, 3);
    assert.equal(data.domains[0].id, "visual");
    assert.deepEqual(data.changeSummary, { changed: false, unverified: false });
    assert.equal(existsSync(path.join(dir, "docs/ontology")), false);
    assert.equal(existsSync(path.join(dir, "docs/adr/.mapping.json")), false);
    assert.equal(git(dir, ["status", "--porcelain"]), before);
    assert.equal(readFileSync(path.join(dir, "draft/business.ttl"), "utf8"), BUSINESS);
  }));

test("the view CLI rejects malformed supplied business evidence and displays an unreadable selected index as unverified", () =>
  withTmp((dir) => {
    writeLayeredFixture(dir);
    initRepo(dir);
    commitAll(dir);
    write(dir, "bad-board.json", '{"version":1}');
    const invalid = cli(dir, ["view", "--no-open", "--board", "bad-board.json"]);
    assert.equal(invalid.code, 2);
    assert.match(invalid.out, /invalid --board/);
    const { data } = runView(dir, ["--mapping", "missing-index.json"]);
    assert.ok(data.errors.some((error) => error.code === "ontology-index-unreadable"));
    assert.equal(data.businessSteps["studio.request"].state, "unknown");
  }));

test("the normal view front door rejects an ADR symlink escape before validation can quote its contents", () =>
  withTmp((dir) => {
    writeLayeredFixture(dir);
    initRepo(dir);
    commitAll(dir);
    const mapping = structuredClone(LAYER_MAPPING);
    const escaped = "docs/adr/rendering/0002-outside.md";
    write(
      dir,
      "outside.md",
      "# SECRET_OUTSIDE_DOCUMENT\n\n## Status\n\nAccepted (2026-10-01)\n\nm:studio.secret\n",
    );
    symlinkSync(path.join(dir, "outside.md"), path.join(dir, escaped));
    mapping.categories.rendering.adrs.push({
      path: escaped,
      status: "Accepted (2026-10-01)",
      summary: "An unsafe document record",
    });
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping));
    const { html, data } = runView(dir);
    assert.equal(data.adrs[escaped].body, null);
    assert.equal(data.businessSteps["studio.request"].state, "unknown");
    assert.equal(html.includes("SECRET_OUTSIDE_DOCUMENT"), false);
    assert.equal(html.includes("m:studio.secret"), false);
  }));

test("the normal view marks changed and incomplete process nodes while keeping invalid model details readable", () =>
  withTmp((dir) => {
    writeLayeredFixture(dir);
    initRepo(dir);
    commitAll(dir);
    write(
      dir,
      "docs/ontology/business.ttl",
      BUSINESS.replace('onto:startCondition "A creator requests an image." ;', "").replace(
        "onto:flowsTo m:billing.reserve",
        "onto:flowsTo m:billing.missing",
      ),
    );
    const { data } = runView(dir);
    assert.ok(data.errors.length > 0);
    assert.equal(data.changeSummary.changed, true);
    assert.ok(data.containers.find((c) => c.id === "studio.image").marks & 2);
    assert.ok(data.containers.find((c) => c.id === "studio.image").marks & 8);
  }));

test("retired processes stay hidden until explicitly included, then retain their retirement marker", () =>
  withTmp((dir) => {
    writeLayeredFixture(dir);
    write(
      dir,
      "docs/ontology/business.ttl",
      BUSINESS.replace('onto:status "Proposed"', 'onto:status "Deprecated (2026-10-01)"'),
    );
    initRepo(dir);
    commitAll(dir);
    const normal = runView(dir).data;
    assert.equal(
      normal.containers.some((c) => c.id === "studio.image"),
      false,
    );
    const included = runView(dir, ["--include-retired"]).data;
    assert.ok(included.containers.find((c) => c.id === "studio.image").marks & 1);
  }));
