// ADR interactions lead with the Decision Digest and semantic diff while the
// ADR body and mapping keep their authority. Each assertion pins one clause of
// that behavior in the instructions the workflows actually load.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { has } from "./helpers.mjs";

const ADR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ADR, rel), "utf8");

const NEW = read("skills/adr-new/SKILL.md");
const DRAFT = read("skills/adr-new/references/draft-and-index.md");
const VERIFY = read("skills/adr-new/references/candidate-verification.md");
const SAVE = read("skills/adr-new/references/approval-and-save.md");
const GLOSSARY = read("references/glossary.md");
const QUESTIONS = read("references/decision-questions.md");
const RULES = read("templates/adr/authoring-rules.md");
const README = read("templates/adr/README.md");
const REVIEWER = read("agents/adr-reviewer.md");

test("read-only and quick modes stay unapplied and quiz selections are never answers", () => {
  has(
    QUESTIONS,
    "In read-only reviews or sync's quick mode, keep every proposed mutation unapplied regardless of a report's recommendations.",
  );
  has(
    read("skills/adr-sync/SKILL.md"),
    "Preserve the caller's read-only/quick modes and destructive approval boundaries.",
  );
  has(QUESTIONS, "never use quiz selections as intent answers or approvals");
});

test("an unknown contract stays unresolved and blocks its approval instead of being saved blank", () => {
  has(
    NEW,
    "stays visibly unresolved in the draft and blocks approval of the contract that depends on it; never save it blank to fill in during `/adr-impl`.",
  );
  has(
    NEW,
    "Only a row pending on an upper-level business change may remain in an approved revision.",
  );
  assert.doesNotMatch(NEW, /leave this blank, save as Proposed/);
  has(
    NEW,
    "If an unverified assumption changes the contract or a durable architecture boundary, resolve it before approval rather than recording it as accepted fact.",
  );
});

test("business terms reach the current-reference-level rules from every ADR-writing path", () => {
  has(
    NEW,
    "or, where `docs/ontology/` holds Turtle documents, a business term the ADR defines or relies on",
  );
  has(
    GLOSSARY,
    "When a current reference level exists (below), also use it for every business term the ADR defines or relies on.",
  );
  for (const skill of ["adr-impl", "adr-sync"])
    has(
      read(`skills/${skill}/SKILL.md`),
      "or ADR content relies on a business term where `docs/ontology/` holds Turtle documents",
    );
  has(
    read("skills/adr-rollup/SKILL.md"),
    "business terms the merged ADR relies on where `docs/ontology/` holds Turtle documents",
  );
  has(read("skills/adr-import/SKILL.md"), "to the business terms adopted ADRs rely on");
  has(
    GLOSSARY,
    "While the proposal is unapproved or rejected, do not finalize ADR content that depends on the meaning",
  );
  has(
    GLOSSARY,
    "Without a current reference level, apply only the glossary rules above and add no proposal, pending row, cleanup output or question.",
  );
});

test("a pending row is reported as pending wherever the regeneration check runs", () => {
  has(REVIEWER, "is not an omission: report it as pending, never FIX_REQUIRED");
  has(
    REVIEWER,
    '- Pending rows awaiting an upper-level business change: <each row and the change it awaits, or "none">',
  );
  has(
    VERIFY,
    "A row pending on an upper-level business change is listed as pending, not as an absent contract.",
  );
  has(
    read("skills/adr-sync/references/deep-verification.md"),
    "A row pending on an upper-level business change is reported as pending, never as a missing requirement",
  );
  has(
    read("skills/adr-rollup/references/candidate-contract.md"),
    "Carry a row pending on an upper-level business change over as pending",
  );
  has(
    SAVE,
    "a pending row awaiting an upper-level business change is listed as pending, not as an approved contract",
  );
});

test("glossary edits wait for approval and conflicts for the user", () => {
  has(GLOSSARY, "Update only confirmed entries after approval.");
  has(GLOSSARY, "Ask the user to resolve the conflict before replacing anything.");
});

test("the Decision Digest leads with intent and the decision and carries the grouped contract verbatim", () => {
  for (const field of [
    "**Decision intent**",
    "**Decision question**",
    "**Current decision**",
    "**Requirement contract**:",
    "**Why this decision**",
    "**Main risks**",
    "**Regeneration checklist**",
  ])
    has(SAVE, field);
  has(
    SAVE,
    "- Required guarantees: <verbatim values and rules with their basis, or omit this row>",
    "- Prohibitions:",
    "- Failure guarantees:",
  );
  has(
    SAVE,
    "- Observable evidence: <one implementation-independent result per obligation; no test or code details>",
  );
  assert.ok(
    SAVE.indexOf("**Current decision**") < SAVE.indexOf("**Requirement contract**"),
    "the decision comes before the detail",
  );
});

test("the Decision Digest shows the full ADR body or detailed alternatives only on request or when it cannot expose a material ambiguity", () => {
  has(
    SAVE,
    "Show the full ADR body or detailed Alternatives only when the user asks or when the digest cannot expose a material ambiguity",
  );
  has(
    SAVE,
    "**Alternatives considered**: <N realistic options; expand only on request or when one affects approval>",
  );
});

test("new ADRs are prepared in a disposable draft and applied only after approval", () => {
  has(
    NEW,
    "Prepare and verify ADR bodies and mapping changes in a disposable draft space; do not create or modify the repository's ADR bodies or `.mapping.json` before approval.",
  );
  has(NEW, "Writing the live files and then reverting them is still a pre-approval write.");
  has(NEW, "neither authorizes an ADR body or mapping change");
  has(NEW, "Silence or a draft check is not approval.");
  has(DRAFT, "Use independent copies, not symlinks or hard links to live files.");
  has(DRAFT, "It is disposable validation input, not a second authority or approval registry.");
  has(
    SAVE,
    "Do not start changing code, repository ADR bodies, or the repository mapping before approval.",
  );
  has(
    SAVE,
    "Reuse an explicit approval already covering the same candidate decision, contract, and scope",
  );
  has(SAVE, "Preserve intervening edits and revalidate affected candidates");
  has(SAVE, "Apply the approved ADR as `Proposed` and its mapping change to the final paths");
  has(
    SAVE,
    "If approval is withheld, leave live ADR bodies and mapping unchanged and report the pending decision.",
  );
});

test("an ADR change leads with a semantic diff of every axis, intent included, keeps exact values and expands only on request", () => {
  const planning = read("skills/adr-impl/references/planning.md");
  has(
    planning,
    "grouped by `Decision`, `Requirement contract`, `Decision Drivers`, and `Consequences`",
  );
  has(planning, "show a changed intent in `Purpose` as a semantic change too");
  has(planning, "Preserve exact requirement values and rules.");
  has(planning, "never present `Unverified` as `Unchanged`");
  has(
    planning,
    "Show the full revised ADR only when the user asks or when the diff cannot expose a material ambiguity.",
  );
  has(
    planning,
    "The semantic diff is ephemeral and never becomes a second authoritative artifact.",
  );
  const report = read("skills/adr-sync/references/report.md");
  has(
    report,
    "- Decision Drivers: <Changed: old pressure → current pressure | Unchanged | Unverified>",
  );
  has(
    report,
    "- Consequences: <Changed: old risk/trade-off → current risk/trade-off | Unchanged | Unverified>",
  );
  has(
    report,
    "- Purpose intent: <Changed: old problem/outcome → current problem/outcome | Unverified; omit when unchanged>",
  );
});

test("values stay in the contract, assumptions have no taxonomy, and a heading rename keeps Status", () => {
  has(NEW, "A value or rule the result must honor goes in the requirement contract.");
  has(DRAFT, "Never move requirement values into an assumption");
  has(NEW, "Do not add a separate assumptions section, confidence taxonomy, or fixed table.");
  has(
    RULES,
    "Do not add a separate assumptions section, confidence taxonomy, evidence table, or placeholder row.",
  );
  has(RULES, "do not create both sections or change lifecycle Status solely for the rename");
});

const BRIDGE = read("references/review-report-writing.md");
const REVIEW_REPORT = read("skills/adr-review/references/report.md");
const SYNC_REPORT = read("skills/adr-sync/references/report.md");
const READER = read("references/reader-first-writing.md");
const SHARED = (name) => read(`skills/report-writer/references/${name}.md`);

test("review and sync reports draw the smallest grounded Mermaid of the fitting type when the result needs one and keep prose reviewable", () => {
  has(
    BRIDGE,
    "Include the smallest grounded Mermaid when the result has three or more participants, steps, states or ADR relationships; a system boundary, a dependency or a conflict between ADRs; a state transition, failure, retry, rollback or fallback; or a before/after meaning the reader would otherwise reassemble from prose.",
  );
  has(
    BRIDGE,
    "Prefer `sequenceDiagram` for request and event flow, `stateDiagram-v2` for states, `flowchart` for branches, dependencies and conflicts, and `erDiagram` for data relations.",
  );
  has(
    BRIDGE,
    "Follow each diagram with one `Notice:` sentence naming what the reader should verify.",
  );
  has(BRIDGE, "A single-ADR PASS that one or two sentences explain gets no diagram.");
  has(
    BRIDGE,
    "Never add a participant or relation the evidence does not establish; name the unverified axis in text instead.",
  );
  has(BRIDGE, "The prose must remain reviewable when Mermaid does not render.");
  for (const template of [REVIEW_REPORT, SYNC_REPORT]) has(template, "Notice: <");
  has(SHARED("diagrams"), "Never invent participants or calls");
  has(SHARED("explanation-design"), "identify the missing premise");
});

test("reports leave out filler and treat the named mechanical patterns as rewrite signals", () => {
  has(
    BRIDGE,
    "Leave out praise, scene-setting, a restatement of the request, unsupported generalities, future speculation, repeated conclusions, findings or evidence, and empty headings.",
  );
  has(
    BRIDGE,
    "repeated contrast templates, one-off ornamental English labels, forced first/second/third structure or filler bridges",
  );
  has(BRIDGE, "do not restate adjacent prose in a table, diagram, blockquote or bold sentence");
  has(BRIDGE, "These are rewrite signals, not banned words.");
  has(BRIDGE, "a junior developer seeing the subject for the first time");
  has(
    BRIDGE,
    "Never lose exact values, allowed states, permissions, ordering, units, test results, or an unverified axis when summarizing.",
  );
  has(
    SHARED("editorial-review"),
    "At first needed use",
    "Never remove or downgrade that finding to pass editorial review.",
  );
  has(
    SHARED("explanation-design"),
    "Do not invent incidents, impact or exclusions to justify a choice after the fact.",
  );
  has(SHARED("quantitative-claims"), "distinguishable from measurements");
});

test("review and sync reports put the at-a-glance answer after Purpose and Context and before the detailed lists", () => {
  has(
    BRIDGE,
    "Lead with the verdict, observable impact, next action and residual risk in the common report opening.",
  );
  has(
    read("skills/report-writer/SKILL.md"),
    "Open with separate Purpose and Context sections, in that order, before the answer.",
  );
  has(
    SHARED("explanation-design"),
    'Directly below the title, place two separate sections in this order: "Purpose", then "Context" ("목표", then "배경" in Korean).',
    "Immediately follow with the answer, material implication, conclusion-changing limitations and required next action in a distinct display area.",
    "Put navigation and detailed evidence after this early answer; choose later headings for the subject rather than imposing a universal outline.",
  );
  for (const [template, detail] of [
    [REVIEW_REPORT, "### Per-ADR"],
    [SYNC_REPORT, "### Fixed"],
  ]) {
    has(template, "### At a glance", "- Verdict:", "- Impact:", "- Action:", "- Risk:");
    assert.ok(
      template.indexOf("### At a glance") < template.indexOf("### Scope"),
      "At a glance comes before Scope",
    );
    assert.ok(
      template.indexOf("### Scope") < template.indexOf(detail),
      `Scope comes before ${detail}`,
    );
  }
});

test("chat summaries lead with the answer; sync shows changed decisions and contracts first", () => {
  has(
    REVIEW_REPORT,
    "open with the At a glance verdict, impact, action and risk, then compress the two or three ADRs that need attention most through the four questions",
  );
  has(
    SYNC_REPORT,
    "In chat, lead with At a glance, then show each changed ADR's `Decision` and `Requirement contract` semantic diff. Keep file locations, code evidence, and harness detail in the full report",
  );
  has(
    read("skills/adr-sync/SKILL.md"),
    "[result presentation](references/report.md)",
    "Lead with At a glance, then the semantic diff of each changed Decision and Requirement contract.",
  );
});

test("ADR bodies and the Digest lead with intent and the chosen direction, then a causal flow ordered by importance", () => {
  has(RULES, "## Reading order — intent before detail");
  has(
    README,
    "Open with the affected actor or system, the concrete problem or condition, and why it matters.",
  );
  has(
    README,
    "State the outcome this decision protects and briefly preview the proposed or adopted direction, so the reader understands the intent before reaching the drivers and contract.",
  );
  has(RULES, "State the outcome to protect and briefly preview the proposed or adopted direction.");
  has(
    READER,
    "Purpose orients the reader to the problem and direction; the adjacent Decision Drivers state all currently applicable selection criteria; Decision states the choice, why it fits, and its exact contract.",
  );
  has(
    DRAFT,
    "Purpose opens with the affected actor or system, verified problem, intended outcome, and a brief direction preview.",
  );
  has(
    READER,
    "Can the title and opening alone explain the problem, intended outcome, and answer or proposed direction, with any qualification that changes the claim?",
  );
  has(
    README,
    "State the currently valid architectural choice first and connect it to the driver that explains why it addresses the problem in Purpose.",
  );
  has(
    READER,
    "The Decision Digest follows the same intent-to-choice order before classification or scoring.",
  );
  has(READER, "`starting condition or trigger -> action -> system response -> observable result`");
  has(
    READER,
    "Order the report by importance to the reader.",
    "Chronological execution, file order, and implementation order are optional tools, not the default structure.",
  );
  has(READER, "If no coherent story exists, lead with the most consequential behavior or decision");
  has(
    READER,
    "Use a list only when independent items are genuinely easier to scan than a causal explanation.",
  );
  has(DRAFT, "Prefer a verified causal flow to a forced list.");
  assert.ok(SAVE.indexOf("**Decision intent**") < SAVE.indexOf("**Alternatives considered**"));
  assert.ok(SAVE.indexOf("**Decision question**") < SAVE.indexOf("**Alternatives considered**"));
});

test("reader-first passes treat the named patterns as rewrite signals and keep evidence levels", () => {
  has(READER, "Treat these as rewrite signals, not automatic forbidden words:");
  has(READER, "generic bridge phrases such as `the key is`, `what matters is`");
  has(
    READER,
    "a table, diagram, blockquote, heading, or bold sentence that repeats adjacent prose without adding a relationship or decision",
  );
  has(
    READER,
    "the evidence level of each statement: observed fact, supported inference, or proposal.",
  );
  has(
    READER,
    "Do not shorten by removing requirement values, permissions, states, failure guarantees, evidence, or risk.",
  );
  has(REVIEWER, "filler bridges");
});

/** A retirement recommendation that names a Driver or alternative count, in either order. */
const RETIRE_BY_COUNT = new RegExp(
  [
    String.raw`\bretir\w*[^.]{0,80}\b(?:fewer|too few|only one|single|no second)\b[^.]{0,20}\b(?:drivers?|alternatives?|options?)\b`,
    String.raw`\b(?:fewer|too few|only one|single|no second)\b[^.]{0,20}\b(?:drivers?|alternatives?|options?)\b[^.]{0,80}\bretir`,
  ].join("|"),
  "i",
);

test("Driver and alternative counts stay advisory and never justify retirement on any path", () => {
  has(RULES, "3-5 is a default, not a quota");
  has(RULES, "## Alternatives — realistic comparison, not a quota");
  has(
    RULES,
    "If neither realistic alternatives nor a constraining reason is established, report the missing rationale; consider a different document only if the core subject fails the ADR admission gate",
  );
  has(
    README,
    "Whether the decision needs an ADR follows the ADR admission gate, not the number of alternatives.",
  );
  has(VERIFY, "A warning is not an instruction to invent Drivers or Alternatives to fill a quota.");
  const deep = read("skills/adr-sync/references/deep-verification.md");
  has(deep, '"Alternatives — realistic comparison, not a quota"');
  has(
    deep,
    "A smaller count is valid when the recorded constraints explain the choice; count warnings alone do not require additions.",
  );
  has(
    deep,
    "Report strawmen or missing rationale in `Suggestions`; never invent past options, require another option merely for its count, or suggest retirement solely because alternatives are constrained.",
    "Retirement follows the admission gate in item 4.",
  );
  const rollup = read("skills/adr-rollup/references/candidate-contract.md");
  has(rollup, "no count quota");
  has(
    rollup,
    "One credible rejected alternative, or evidence that constraints leave no other valid path, is sufficient.",
    "Never invent an option for its count",
  );
  // A coarse guard against the usual count wordings (fewer, too few, only one,
  // single, no second) wherever a line wraps; the positive pins above are what
  // keep the advisory rule itself.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) files.push(full);
    }
  };
  for (const dir of ["skills", "agents", "references", "templates"]) walk(path.join(ADR, dir));
  for (const file of files)
    assert.doesNotMatch(
      readFileSync(file, "utf8").replace(/\s+/g, " "),
      RETIRE_BY_COUNT,
      path.relative(ADR, file),
    );
});
