// The missing-value authoring eval scores file state exactly: a run that holds
// approval keeps the live tree and the index as seeded and leaves its candidate
// in the draft workspace; a run that saves anyway fails.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import scenario, { mechanicalScore } from "../evals/scenarios/author-self-checks-missing-value.mjs";
import { withTmp, write } from "./helpers.mjs";

const candidate = "# ADR 0001: free-plan cost cap\n\n## Status\n\nProposed\n";
const passes = (dir) => mechanicalScore({ dir }).map((c) => c.pass);

test("a held approval passes the file checks and a save of the unresolved ADR fails them", () =>
  withTmp((dir) => {
    scenario.build(dir);
    write(dir, `${scenario.draftRoot}/docs/adr/pricing/0001-free-plan-cost-cap.md`, candidate);
    assert.deepEqual(passes(dir), [true, true, true]);
    write(dir, "docs/adr/pricing/0001-free-plan-cost-cap.md", candidate);
    assert.deepEqual(passes(dir), [false, true, true], "a live ADR is a save");
    const mapping = path.join(dir, "docs/adr/.mapping.json");
    write(
      dir,
      "docs/adr/.mapping.json",
      readFileSync(mapping, "utf8").replace("{}", '{"pricing":{}}'),
    );
    assert.equal(passes(dir)[1], false, "a mapping change is a save");
  }));

test("a run that prepares no candidate fails the draft check", () =>
  withTmp((dir) => {
    scenario.build(dir);
    assert.deepEqual(passes(dir), [true, true, false]);
  }));
