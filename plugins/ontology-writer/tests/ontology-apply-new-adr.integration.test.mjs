import assert from "node:assert/strict";
import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  MAPPING,
  apply,
  cli,
  draft,
  impact,
  read,
  repo,
} from "./ontology-apply-helpers.mjs";

const source = "adr-drafts/dispatch/0001-release.md";
const destination = "docs/adr/dispatch/0001-release.md";
const body =
  "# ADR 0001: Dispatch release\n\n## Status\n\nProposed\n\n## Decision\n\nRecord a release exactly once for a confirmed order.\n";
const options = ["--mapping", "mapping.next.json", "--adr-drafts", "adr-drafts"];
function prepare(dir) {
  repo(dir);
  draft(dir, ACCEPTED.replaceAll("ordering.confirm-order", "ordering.release-order"));
  const mapping = structuredClone(MAPPING);
  mapping.categories.checkout.realizes = ["ordering.submit-order"];
  mapping.categories.dispatch = {
    adrs: [{ path: destination, status: "Proposed", summary: "Release confirmed orders." }],
    realizes: ["ordering.release-order"],
    dependsOn: ["checkout"],
  };
  write(dir, "mapping.next.json", JSON.stringify(mapping));
  write(dir, source, body);
  return mapping;
}

test("a new Proposed ADR, its newly defined step and its realization link use one approval", () =>
  withTmp((dir) => {
    const mapping = prepare(dir);
    write(dir, "adr-drafts/review-notes.md", "Working notes are not ADRs.");
    const preview = impact(dir, options);
    assert.deepEqual(preview.newAdrs, [destination]);
    assert.ok(preview.affectedAdrs.includes(destination));
    assert.equal(existsSync(path.join(dir, destination)), false);
    assert.equal(git(dir, ["diff", "--", "docs"]), "");
    assert.equal(
      cli(dir, ["impact", "--draft", "draft", "--mapping", "mapping.next.json"]).code,
      1,
    );
    write(dir, source, body + "\nA different decision.\n");
    const stale = apply(dir, preview.baseHash, options);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary/);
    assert.equal(git(dir, ["diff", "--", "docs"]), "");
    write(dir, source, body);
    const saved = apply(dir, preview.baseHash, options);
    assert.equal(saved.code, 0, saved.out);
    assert.equal(read(dir, destination), body);
    assert.equal(existsSync(path.join(dir, "docs/adr/review-notes.md")), false);
    assert.deepEqual(JSON.parse(read(dir, "docs/adr/.mapping.json")), mapping);
    assert.ok(
      read(dir, "docs/ontology/model.ttl").includes("m:ordering.release-order a onto:Step"),
    );
    assert.equal(cli(dir, ["validate"]).code, 0);
  }));

test("a new ADR draft cannot hide an invalid body, overwrite existing work or escape the ADR root", () =>
  withTmp((dir) => {
    prepare(dir);
    const preview = impact(dir, options);
    for (const [invalid, diagnostic] of [
      [body.replace("Proposed", "Accepted (2026-01-01)"), /must be Proposed/],
      [body + "\nUses `ordering.release-order`.\n", /ontology-adr-identifier/],
    ]) {
      write(dir, source, invalid);
      const refused = cli(dir, ["impact", "--draft", "draft", ...options]);
      assert.equal(refused.code, 1, refused.out);
      assert.match(refused.out, diagnostic);
    }
    write(dir, source, body);
    mkdirSync(path.join(dir, "other"));
    symlinkSync(path.join(dir, "other"), path.join(dir, "docs/adr/dispatch"));
    const outside = apply(dir, preview.baseHash, options);
    assert.equal(outside.code, 1, outside.out);
    assert.match(outside.out, /outside the ADR directory/);
    unlinkSync(path.join(dir, "docs/adr/dispatch"));
    write(dir, destination, "a colleague's new ADR");
    const collision = cli(dir, ["impact", "--draft", "draft", ...options]);
    assert.equal(collision.code, 1, collision.out);
    assert.match(collision.out, /already indexed or exists/);
    assert.equal(apply(dir, preview.baseHash, options).code, 1);
    assert.equal(read(dir, destination), "a colleague's new ADR");
    assert.equal(git(dir, ["diff", "--", "docs"]), "");
  }));

test("a failed save removes its new ADR and restores the model and the realization index", () =>
  withTmp((dir) => {
    prepare(dir);
    mkdirSync(path.join(dir, "docs/ontology/change-log.md/blocked"), { recursive: true });
    const preview = impact(dir, options);
    const saved = apply(dir, preview.baseHash, [...options, "--log", "Dispatch owns the release."]);
    assert.equal(saved.code, 1, saved.out);
    assert.match(saved.out, /writing failed/);
    assert.equal(existsSync(path.join(dir, destination)), false);
    assert.equal(git(dir, ["diff", "--", "docs"]), "");
  }));

test("an approved direct step edit gains its new ADR and link without rewriting the user's model", () =>
  withTmp((dir) => {
    const mapping = prepare(dir);
    write(dir, "docs/ontology/model.ttl", read(dir, "draft/model.ttl"));
    const marked = cli(dir, [
      "transition",
      "--process",
      "ordering.place-order",
      "--to",
      "Proposed",
    ]);
    assert.equal(marked.code, 0, marked.out);
    const before = read(dir, "docs/ontology/model.ttl");
    const comparison = ["--base", "HEAD", ...options];
    const preview = cli(dir, ["impact", ...comparison, "--json"]);
    assert.equal(preview.code, 0, preview.out);
    const { baseHash } = JSON.parse(preview.out);
    const saved = cli(dir, ["apply", ...comparison, "--base-hash", baseHash]);
    assert.equal(saved.code, 0, saved.out);
    assert.equal(read(dir, "docs/ontology/model.ttl"), before);
    assert.equal(read(dir, destination), body);
    assert.deepEqual(JSON.parse(read(dir, "docs/adr/.mapping.json")), mapping);
    assert.equal(cli(dir, ["validate"]).code, 0);
  }));
