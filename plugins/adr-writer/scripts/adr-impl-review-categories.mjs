// adr-impl-review-categories.mjs — the finding-category vocabulary shared by the
// impl-review validator and the HTML report renderer.
//
// One table, because the same eleven categories were spelled out in three places
// (the validator's allow-list, the renderer's display metadata, and the
// renderer's sort order) with nothing asserting they agreed. Adding a category to
// one and not the others fails quietly in a different way each time: the
// validator rejects a finding the renderer would have drawn, or the sort order
// falls through to the `?? 99` default and the docket silently stops reading
// worst-first. Both are invisible in a green test run.
//
// Each entry carries everything either consumer needs:
//   hue              severity accent (left rule + tag) in the report
//   blurb            one-line explanation shown on the card
//   authority        which side the confrontation resolves toward — drives the
//                    direction indicator AND matches the SKILL routing:
//                      "adr"        ADR is the spec → fix the code
//                      "minimality" smaller diff is authoritative
//                      "code"       code is authoritative on this fact → fix ADR
//                      "contested"  a real decision change → user must rule
//                      "convention" measured against project conventions
//                      "advisory"   decision-neutral, no ADR↔code tension
//   defaultDecision  seeds the ruling radio so the common follow-up is
//                    pre-selected while the user stays in control
//   actionGroup      the human task bucket shown before technical categories
//   priority         remediation priority retained for shared routing and
//                    compatibility. The HTML renderer preserves the report
//                    writer's reader-facing order instead of category-sorting
//                    the final narrative.
//
// Dependency-free and side-effect-free: importable from a CLI without running one.

export const CATEGORIES = {
  "Spec violation": {
    hue: "#c0362c",
    blurb: "The code did not honor the ADR decision — the ADR is the spec, so fix the code.",
    authority: "adr",
    defaultDecision: "fix",
    actionGroup: "fix",
    priority: 0,
  },
  "Unnecessary change": {
    hue: "#a92f27",
    blurb: "A change removable while keeping the ADR goal — shrink the diff.",
    authority: "minimality",
    defaultDecision: "fix",
    actionGroup: "fix",
    priority: 1,
  },
  "Undecided behavior": {
    hue: "#c77b0e",
    blurb:
      "The code adds an ADR-worthy behavior the ADR never decided — after the admission gate, add the decision vs remove the behavior.",
    authority: "contested",
    defaultDecision: "defer",
    actionGroup: "decide",
    priority: 2,
  },
  "Best practice": {
    hue: "#1f5fa8",
    blurb:
      "Violates project conventions (primary) or general patterns (secondary) — a code-improvement candidate.",
    authority: "convention",
    defaultDecision: "fix",
    actionGroup: "fix",
    priority: 3,
  },
  "Decision changed in code": {
    hue: "#b4690e",
    blurb:
      "The code implemented a different but coherent decision — update the ADR vs revert the code; user decides.",
    authority: "contested",
    defaultDecision: "defer",
    actionGroup: "decide",
    priority: 4,
  },
  "Impl-fact mismatch": {
    hue: "#6b3fa0",
    blurb:
      "The ADR carries stale code-level facts — remove them via /adr-sync, or correct only an admitted public/architectural contract.",
    authority: "code",
    defaultDecision: "defer",
    actionGroup: "fix",
    priority: 5,
  },
  "Simpler alternative": {
    hue: "#8a4f0f",
    blurb:
      "The same contract is met by a smaller existing structure — simplify after checking the trade-off.",
    authority: "contested",
    defaultDecision: "defer",
    actionGroup: "note",
    priority: 6,
  },
  "Test gap": {
    hue: "#566173",
    blurb: "The decided behavior is not verified by tests.",
    authority: "advisory",
    defaultDecision: "defer",
    actionGroup: "verify",
    priority: 7,
  },
  "Unverified risk": {
    hue: "#7a5b14",
    blurb:
      "A concrete failure hypothesis or contract/safety-affecting premise lacks execution or authoritative evidence — verify it first.",
    authority: "contested",
    defaultDecision: "defer",
    actionGroup: "verify",
    priority: 8,
  },
  Contradiction: {
    hue: "#7b3f91",
    blurb: "The independent reviews' premises conflict — a human must confirm which premise holds.",
    authority: "contested",
    defaultDecision: "defer",
    actionGroup: "decide",
    priority: 9,
  },
  Refactor: {
    hue: "#2e7d4f",
    blurb: "An opportunity to tidy up without changing the decision.",
    authority: "advisory",
    defaultDecision: "defer",
    actionGroup: "note",
    priority: 10,
  },
};

// The allow-list a findings.json category is validated against.
export const CATEGORY_NAMES = new Set(Object.keys(CATEGORIES));

// authority → the center indicator between ADR and code.
export const AUTHORITY = {
  adr: { glyph: "→", label: "ADR is the basis", hint: "the code must follow the decision" },
  minimality: {
    glyph: "−",
    label: "Minimal change",
    hint: "shrink the code while keeping the contract",
  },
  code: {
    glyph: "←",
    label: "Code is the basis",
    hint: "remove stale code detail; correct only an admitted contract",
  },
  contested: { glyph: "⇄", label: "Needs a ruling", hint: "decide which side is right" },
  convention: {
    glyph: "▸",
    label: "Convention is the basis",
    hint: "compare against project conventions",
  },
  advisory: { glyph: "·", label: "Advisory", hint: "decision-neutral" },
};

export const VERDICTS = {
  PASS: {
    hue: "#2e7d4f",
    note: "No removable change and no confirmed counterexample; every decision-ledger row has evidence and the targeted tests passed.",
  },
  FIX_REQUIRED: {
    hue: "#b4690e",
    note: "Follow-up needed — remove unnecessary changes, fix code, correct the ADR, strengthen tests, or get a human ruling.",
  },
  INCONCLUSIVE: {
    hue: "#7a5b14",
    note: "An important path could not be executed or the scope not pinned down, so there is not enough evidence to rule PASS or FIX.",
  },
  BLOCK: {
    hue: "#c0362c",
    note: "Fragmented vertical slice, anti-pattern category, or a forked decision — restructuring needed.",
  },
};

export const VERDICT_NAMES = new Set(Object.keys(VERDICTS));
