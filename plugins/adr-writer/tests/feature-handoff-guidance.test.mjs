// The PRD → ADR handoff keeps these behaviors in the instructions /feature-to-adr
// loads. Each assertion pins one clause a model could otherwise lose without any
// other test noticing.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { has } from "./helpers.mjs";

const ADR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALPS = path.resolve(ADR, "..", "alps-writer");
const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");
const SKILL = read(ALPS, "skills/feature-to-adr/SKILL.md");
const MODULE = read(ALPS, "skills/feature-to-adr/references/current-reference-level.md");
const REIMPORT = read(ALPS, "skills/feature-to-adr/references/reimport.md");
const DELEGATION = [
  read(ADR, "references/requirement-delegation.md"),
  read(ALPS, "references/requirement-delegation.md"),
];
const GLOSSARY = read(ADR, "references/glossary.md");
const CONCEPTS = read(ADR, "templates/adr/concepts.md");

test("terms keep their contract in the owning ADR and hold completion while unclear", () => {
  has(MODULE, "After approval the owning ADR body keeps the short explanation its contract needs.");
  has(
    SKILL,
    "Keep short explanations and all requirement values, states, permissions and success conditions in their owning ADR bodies.",
  );
  has(
    GLOSSARY,
    "Requirement values, states, permissions, ordering, failure guarantees and success conditions remain in the owning ADR, never only in the glossary.",
  );
  has(SKILL, "ask about an unclear meaning before finalizing dependent contracts");
  has(
    SKILL,
    "Resolve conflicting definitions with the user before overwriting them or completing the affected handoff.",
  );
});

test("re-import leaves an equivalent term meaning unchanged and checks affected contracts before changing or removing one", () => {
  has(
    SKILL,
    "Explicit re-import also compares term meanings: equivalent input leaves the glossary unchanged; a changed or removed definition requires checking affected contracts rather than automatic replacement or deletion.",
  );
});

test("a proposal is approved only by the upper level's own approval path", () => {
  has(
    MODULE,
    "A proposal is approved only through that level's own approval path",
    "never by approving the ADR contracts shown beside it",
  );
  has(
    GLOSSARY,
    "it is decided only through that level's own approval path",
    "Approving the ADR does not approve the proposal.",
  );
  has(SKILL, "It counts as routed only once that level approves the proposal.");
});

test("the preflight exemption covers the items that depend on an awaited proposal", () => {
  has(
    SKILL,
    "apart from current-reference-level proposals that await this handoff's approval summary and the items that depend on them",
  );
  has(
    SKILL,
    "apart from a proposal awaiting this handoff's approval summary and the items depending on it, stop before writing ADRs",
  );
});

test("the handoff carries the problem and intended outcome into Purpose and offers realistic alternatives", () => {
  has(SKILL, "Transfer the problem, intended outcome, and supplied priorities/scope into Purpose.");
  has(SKILL, "For architectural choices, offer up to three realistic alternatives when useful.");
});

test("a clear scope gets a non-blocking progress update instead of an approval per Feature count", () => {
  has(SKILL, "Show the requested scope and dependency order as a non-blocking progress update.");
  has(SKILL, "Do not request another approval merely because two or more Features are queued.");
  for (const copy of DELEGATION)
    has(copy, "the number of items or their dependency order does not create a separate approval");
});

test("the handoff asks only about an unresolved target, cost or protected decision and keeps each ADR's own approval", () => {
  has(SKILL, "Ask only when the target, added cost, or a protected decision remains unresolved.");
  has(SKILL, "Each new or changed ADR still uses the adr-writer path's own baseline approval.");
  for (const copy of DELEGATION) {
    has(copy, "Ask only for a new gap, contradiction or scope/cost change.");
    has(copy, "Contract changes and destructive actions retain their own approval boundaries.");
  }
});

test("the PRD is the authority until a Feature commits and is never read afterwards", () => {
  has(
    SKILL,
    "Until then, the PRD remains authoritative for that Feature and implementation must not start from a partial ADR set.",
  );
  has(SKILL, "normal implementation, review, and sync do not read it.");
  has(
    SKILL,
    "that committed PRD scopes are now legacy planning documents and normal implementation reads only ADRs",
  );
  has(
    CONCEPTS,
    "Before handoff, the PRD owns the planning intent.",
    "implementation, review, and sync do not read it.",
  );
  // No adr-writer instruction loads a PRD: none names the ALPS document tools.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) files.push(full);
    }
  };
  for (const dir of ["skills", "agents", "references"]) walk(path.join(ADR, dir));
  for (const f of files)
    assert.doesNotMatch(
      readFileSync(f, "utf8"),
      /(?:get|read|load)_alps_(?:section|document|overview)|mcp__plugin_alps-writer/,
      path.relative(ADR, f),
    );
});

test("enrichment uses the regeneration lens, asks only for real gaps and resumes the preflight", () => {
  has(SKILL, "Start with the regeneration test: if the PRD disappeared after handoff");
  has(SKILL, "the proposed ADR set passes the regeneration test without reading the PRD");
  has(SKILL, "Ask only for that gap.");
  has(SKILL, "ask them, and resume this preflight after the answer");
  has(
    SKILL,
    "Do not ask for facts whose change would preserve the contract and durable boundaries.",
  );
  has(SKILL, "Exclude it without asking.");
});

test("delegated proposals stay unapproved and are classified by their effect", () => {
  has(
    SKILL,
    "Keep proposals unapproved until confirmed; delegation does not turn a requirement into implementation tuning.",
  );
  for (const copy of DELEGATION) {
    has(copy, "Keep it visibly unapproved until the user confirms it.");
    has(copy, "Classify a value by its effect before deciding who chooses it.");
    has(
      copy,
      "Keep a value or rule as a requirement when changing it changes required user behavior, quotas, retention, permissions, allowed states, ordering, uniqueness, failure guarantees, or a durable system/data/security/external boundary.",
    );
  }
});

test("confirmed answers are ephemeral handoff input carried into the ADRs, never a stored report or a PRD rewrite", () => {
  has(SKILL, "Treat confirmed answers as ephemeral handoff input.");
  has(
    SKILL,
    "Do not persist a separate enrichment report or registry, and do not silently rewrite the PRD.",
  );
  has(
    SKILL,
    "After enrichment, classify every relevant source item and confirmed answer into exactly one final route",
  );
  has(
    SKILL,
    "confirmed enrichment answers, realistic alternatives already considered, and decision-changing assumptions",
  );
});

test("the transfer inventory and the completion report stay ephemeral", () => {
  has(
    SKILL,
    "The transfer inventory is ephemeral. Do not store it in the PRD, ADR, `.mapping.json`, or a handoff registry.",
  );
  has(SKILL, "Do not persist this report as another source of truth.");
});

test("ADR bodies and the mapping keep no PRD paths, section numbers or Feature IDs", () => {
  has(
    REIMPORT,
    "Do not store PRD paths, section numbers, Feature IDs, semantic fingerprints, approval state, or import reports in ADR bodies or `.mapping.json`.",
  );
  has(
    read(ADR, "skills/adr-new/references/draft-and-index.md"),
    "`feature` is a human-readable label, never a PRD back-reference, including after an import.",
  );
});

test("the PRD's NFRs, architecture constraints, external boundaries, fallback and related non-goals reach the owning ADRs", () => {
  has(SKILL, "the requirements summary, measurable NFRs, non-goals, and feature dependency graph");
  has(SKILL, "the high-level architecture constraints and external boundaries");
  has(
    SKILL,
    "**ADR-owned** — motivation, a discriminating Driver, requirement contract, domain invariant, state/permission rule, system/data/security boundary, external provider or fallback, adopted algorithm, consistency model, durable trade-off, or implementation-independent observable evidence.",
  );
  has(SKILL, "discriminating NFRs and architecture constraints");
  has(
    SKILL,
    "user-observable behavior, failure guarantees, related non-goals, and implementation-independent observable evidence",
  );
});

test("a swap-only source item is implementation discretion, not a transferable Feature", () => {
  has(
    SKILL,
    "A source item that contains only a replaceable implementation swap and no product contract is implementation discretion, not a transferable Feature and not a placeholder ADR.",
  );
});

test("prerequisite edges record only real contract dependencies, never reuse or work order", () => {
  has(
    SKILL,
    "Do not create edges for shared SDKs, helper reuse, preferred work order, or technical-layer sequencing.",
  );
});

test("an untransferred prerequisite keeps the dependent Feature uncommitted", () => {
  has(
    SKILL,
    "If a required prerequisite Feature has not been transferred yet, do not commit the dependent Feature either.",
  );
  has(SKILL, "no `dependsOn` edge points at a category that does not exist");
});

test("re-import runs only on request and confirms changes through the current owner", () => {
  has(SKILL, "Only when the user explicitly requests re-import, read");
  has(REIMPORT, "Enter this path only when the user explicitly asks to re-import a changed PRD.");
  has(
    REIMPORT,
    "wording, order, examples, or explanation changed while the obligations and decision remain the same.",
  );
  has(
    REIMPORT,
    "The current ADR remains authoritative until the user approves the changed contract",
  );
  has(SKILL, "The PRD never silently regains implementation authority.");
  has(REIMPORT, "Ask whether the removal is an intended contract change.");
  has(SKILL, "changed or removed contracts require confirmation through the existing owner");
});
