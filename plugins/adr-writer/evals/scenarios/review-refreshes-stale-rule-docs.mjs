import { skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { responseChecks } from "../lib/response-checks.mjs";

const EXPECTED = { A: "REFRESH_FIRST", B: "STOP_AFTER_REFRESH", C: "REVIEW_WITH_LAG", D: "REVIEW" };

export const obligations = [
  {
    id: "refresh-first",
    text: "A offers the rule-document refresh before reviewing any ADR, naming the lagging documents, the 0.15.1 → 0.15.4 versions and the rules the lag costs, and asks once. It diffs against the plugin templates and carries the team's Korean translation of the decision-log section into the refreshed authoring-rules.md instead of dropping it.",
  },
  {
    id: "choice-after-refresh",
    text: "B stops after the approved refresh because the user only wanted the rules updated; it does not start a full sweep. C continues the sweep with the existing documents and leads the report with the lag and the rules it leaves unjudged. D reviews normally with no refresh question.",
  },
  {
    id: "no-adr-edits",
    text: "The refresh touches only README.md, concepts.md, authoring-rules.md and structure.md; it never edits an ADR body, .mapping.json, a decision-log.md, a glossary or code, and it does not rewrite existing ADRs to the new rules. Explain in Korean and do not invoke tools in this response-only probe.",
  },
];

export function deterministicScore(input) {
  const rows = Array.isArray(input.tail?.findings) ? input.tail.findings : [];
  return [
    ...responseChecks(input, {}),
    ...Object.entries(EXPECTED).map(([tag, decision]) => ({
      label: `case ${tag}`,
      pass:
        rows.filter((r) => r?.tag === tag).length === 1 &&
        rows.find((r) => r?.tag === tag)?.summary?.trim() === decision,
      detail: rows.find((r) => r?.tag === tag)?.summary ?? "missing",
    })),
  ];
}

export default {
  name: "review-refreshes-stale-rule-docs",
  description:
    "After a plugin upgrade, /adr-review refreshes lagging seeded rule documents first, preserving hand edits, and lets the user choose whether to review the ADRs afterwards.",
  obligations,
  deterministicScore,
  build() {
    return [
      skillText("adr-review", { references: ["references/rule-doc-refresh.md"] }),
      `# This run
Response-only probe. Do not use tools. Describe what /adr-review does next in each
independent case. The installed plugin is 0.15.4. The deterministic harness has run.
A. The user just upgraded the plugin and ran /adr-review with no argument. The harness
   reports rules-doc-stale: README.md, concepts.md, authoring-rules.md and structure.md
   carry the 0.15.1 stamp. The team translated the decision-log section of their
   authoring-rules.md into Korean.
B. As in A, the user approves the refresh and says "규칙 문서만 맞춰 주세요".
C. As in A, the user declines the refresh.
D. The rule documents already carry the 0.15.4 stamp.
Explain in Korean. In EVAL-FINDINGS emit exactly A through D; each summary is exactly
one of REFRESH_FIRST, STOP_AFTER_REFRESH, REVIEW_WITH_LAG, REVIEW.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
