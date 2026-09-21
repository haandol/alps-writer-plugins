import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");

test("ADR authoring requires confirmed meanings without making a glossary a prerequisite", () => {
  const guide = read("../references/glossary.md");
  assert.match(guide, /ask at first use and wait before finalizing/);
  assert.match(guide, /Reuse meanings already supplied/);
  assert.match(guide, /Create `docs\/adr\/glossary\.md` only when/);
  assert.match(guide, /current ADR's approval digest/);
  assert.match(guide, /equivalent existing entry is a no-op/);
  assert.match(guide, /preserve unrelated terms/);
  assert.match(guide, /conflicts with an existing definition/);
  assert.match(guide, /glossary alone cannot change that contract/);
  assert.match(guide, /no ADR number or\nStatus/);
  assert.match(guide, /not registered in `\.mapping\.json`/);
  for (const skill of ["adr-new", "adr-impl", "adr-sync"]) {
    assert.match(read(`../skills/${skill}/SKILL.md`), /references\/glossary\.md/);
  }
});

test("handoff transfers needed meanings without upstream references or replacing unrelated terms", () => {
  const handoff = read("../../alps-writer/skills/feature-to-adr/SKILL.md");
  assert.match(handoff, /optional trailing Glossary Appendix/);
  assert.match(handoff, /`docs\/adr\/glossary\.md`/);
  assert.match(handoff, /selected transfer needs/);
  assert.match(handoff, /Preserve unrelated entries and existing layout/);
  assert.match(handoff, /equivalent meanings are no-ops/);
  assert.match(handoff, /Resolve conflicting definitions with the user/);
  assert.match(handoff, /without PRD paths, Section IDs, or source links/);
  assert.match(handoff, /Explicit re-import also compares\nterm meanings/);
  assert.match(handoff, /Do not introduce DDD or domain classification/);
});

test("Full and Lite clarify terms during authoring and place only needed definitions last", () => {
  for (const overview of [
    "../../alps-writer/src/templates/overview.md",
    "../../alps-writer/src/templates/lite/overview.md",
  ]) {
    const text = read(overview);
    assert.match(text, /ask at first use and wait/);
    assert.match(text, /read_alps_glossary/);
    assert.match(text, /save_alps_glossary_entry/);
    assert.match(text, /approval digest/);
    assert.match(text, /ordinary-language documents|Ordinary-language documents/);
    assert.match(text, /defining a qualifying\s+term is mandatory/);
    assert.match(text, /Do not require DDD or domain classification/);
  }
});

test("review paths read definitions selectively and retain report-only permissions", () => {
  for (const skill of ["adr-review", "adr-impl-review", "adr-rollup"]) {
    const text = read(`../skills/${skill}/SKILL.md`);
    assert.match(text, /only when the selected ADRs need a term definition/);
    assert.match(text, /Review-only work reports unclear or conflicting meanings without editing/);
  }
  for (const role of [
    "adr-reviewer",
    "adr-impl-explainer",
    "adr-impl-necessity-reviewer",
    "adr-impl-sufficiency-reviewer",
  ]) {
    assert.match(read(`../agents/${role}.md`), /glossary\.md` selectively/);
  }
});
