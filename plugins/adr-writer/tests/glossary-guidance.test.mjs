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
    assert.match(text, /alps_glossary\(action: 'read'/);
    assert.match(text, /alps_glossary\(action: 'save'/);
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

test("a current reference level owns business terms while dependent ADR rows stay pending", () => {
  const guide = read("../references/glossary.md");
  assert.match(guide, /A business term's meaning has one current owner/);
  assert.match(guide, /stays current after handoff and that ADRs follow/);
  assert.match(guide, /`docs\/ontology\/`/);
  assert.match(guide, /A PRD\s+is planning input, not a current reference level/);
  assert.match(guide, /reuse its definition and do not define the term again/);
  assert.match(guide, /ADR approval summary\s+as that level's change proposal/);
  assert.match(guide, /visible pending marker/);
  assert.match(guide, /without the upper level's file location or\s+element identifiers/);
  assert.match(guide, /not an approved contract and is not implemented/);
  assert.match(guide, /show it as pending\s+instead of counting it as an approved contract/);
  assert.match(guide, /may remain in an approved revision/);
  assert.match(guide, /An ADR with a pending row stays `Proposed`/);
  assert.match(guide, /never deletes or overwrites it on its\s+own/);
  assert.match(guide, /Without a current reference level, apply only the glossary rules above/);
  assert.match(
    guide.replace(/\s+/g, " "),
    /a heading named exactly like a business concept or bounded context of the model counts as that term's entry; name a heading that only groups other terms differently/,
  );
  assert.match(
    guide.replace(/\s+/g, " "),
    /A name in another table column \(a context, a category, a related term\) may be other content: ADR Writer asks whether it defines the term, and it stops no save\./,
  );

  assert.match(
    read("../skills/adr-impl/SKILL.md"),
    /pending on an upper-level business change is not an approved contract[\s\S]*keep the ADR `Proposed` until the row is resolved/,
  );
  assert.match(
    read("../agents/adr-impl-sufficiency-reviewer.md"),
    /pending on an upper-level business change is not an approved contract: record it `UNVERIFIED` as pending/,
  );
  assert.match(
    read("../skills/adr-new/references/approval-and-save.md"),
    /pending row awaiting an upper-level business change is listed as pending/,
  );
});

test("handoff routes current-reference-level terms as proposals and completes per Feature", () => {
  const handoff = read("../../alps-writer/skills/feature-to-adr/SKILL.md");
  assert.match(handoff, /one or more Turtle documents in `docs\/ontology\/`/);
  assert.match(handoff, /PRD being\s+transferred is never a current reference level/);
  assert.match(handoff, /\[current reference level\]\(references\/current-reference-level\.md\)/);
  assert.match(
    handoff,
    /Without a current reference level,\s+skip that module, transfer definitions to the glossary/,
  );
  assert.match(handoff, /\*\*Current reference level\*\* — /);
  assert.match(handoff, /still awaiting approval or was\s+rejected/);
  assert.match(handoff, /every\s+current-reference-level proposal it depends on is approved/);
  assert.match(
    handoff,
    /Features left unresolved, with the current-reference-level proposals or\s+prerequisite Features they wait for/,
  );

  const level = read(
    "../../alps-writer/skills/feature-to-adr/references/current-reference-level.md",
  );
  assert.match(level, /Read this module only when step 1 found a current reference level/);
  assert.match(
    level,
    /Do not transfer a term it owns into the glossary\. Reuse a meaning it already\s+holds/,
  );
  assert.match(level, /Never delete or overwrite an existing glossary entry/);
  assert.match(
    level,
    /change proposals, written in business\s+language and shown in the same handoff approval summary/,
  );
  assert.match(
    level,
    /Transfer the feature-resolution values, conditions and compliance contracts/,
  );
  assert.match(level, /A value never moves into a\s+proposal/);
  assert.match(level, /repeated handoff with the same meaning creates no proposal/);
  assert.match(level, /does not block drafting/);
  assert.match(level, /stay Unresolved, so that Feature is not reported as transferred/);
  assert.match(level, /Features that do\s+not depend on it continue/);
  assert.match(level, /keep those rows pending and the ADR `Proposed`/);
  assert.match(level, /Current reference level proposals:/);
});
