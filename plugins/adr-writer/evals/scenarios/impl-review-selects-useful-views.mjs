import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-selects-useful-views",
  description:
    "Choose views by the relationships they explain without an exact-type recipe; honor figure exclusions and unavailable evidence with prose delivery, without a mandatory-figure gate or omission approval.",
  build() {
    return [
      skillText("adr-impl-review", {
        references: ["skills/adr-impl-review/references/visualization.md"],
      }),
      `# This run
Choose visual views for six isolated review cases. Do not implement them.
A: A handler requests a provider result and writes completion only on success.
   On failure the existing pending value remains. The question is call order
   and where the failure branch avoids the write, not a lifecycle.
B: Responsibility moves from two callers to a shared formatter. The reader needs
   both component ownership/dependencies and request/response order.
C: A lease may be pending, claimed, or expired. The review question is exactly
   which transitions are allowed and which states forbid completion.
D: Rename one private local variable. Inputs, outputs, callers, and control flow
   do not change; the complete behavior fits in one sentence.
E: A complex cross-system retry review has complete call evidence, but the user
   explicitly excludes diagrams. Explain the interactions in prose and keep
   the review deliverable without requesting omission approval.
F: A complex top-down report has only high-level responsibilities; its internal
   calls and ordering are unknown, and the channel supports plain text only.
   Deliver supported prose with the material limits; invent no diagram content.
Return six finding tags A, B, C, D, E, F. Each summary uses
views=<comma-separated Mermaid types or none>; reason=<one sentence>.
For D, E and F include omission=<the concrete local reason>.
Keep every important question covered without a diagram quota.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
  obligations: [
    {
      id: "relationship-coverage",
      text: "For A, explain provider request order and the failure path avoiding the completion write. For B, cover both ownership/dependency structure and execution order. For C, preserve allowed and forbidden lease transitions. Judge the explanation and selected notation together; do not require exact Mermaid type arrays, a fixed number of diagrams, or an additional justification only for state diagrams. Unsupported relations, omission of a material question, or irrelevant duplicate views do not satisfy coverage.",
    },
    {
      id: "delivery-and-grounds",
      text: "D is a one-sentence local rename with unchanged behavior; avoid a needless figure. E must honor the user's diagram exclusion. F must honor plain-text delivery and missing call evidence. Each omission has its concrete local reason, and no case invents interactions or demands omission approval.",
    },
  ],
  deterministicScore: scoreSelectionRecords,
  score: scoreSelectionRecords,
};

/** Check records and explicit delivery constraints; the configured semantic judge checks usefulness. */
function scoreSelectionRecords({ tail }) {
  return ["A", "B", "C", "D", "E", "F"].map((tag) => {
    const rows = (tail?.findings ?? []).filter((finding) => finding.tag === tag);
    const row = rows[0]?.summary || "";
    const views =
      row
        .match(/(?:^|;)\s*views=([^;]+)/)?.[1]
        .split(",")
        .map((item) => item.trim()) || [];
    const none = views.includes("none");
    const excluded = ["E", "F"].includes(tag);
    return {
      label: `${tag} records its selection and delivery constraint (structure only)`,
      pass:
        rows.length === 1 &&
        views.length > 0 &&
        views.every((view) => /^[A-Za-z][\w-]*$/.test(view)) &&
        new Set(views).size === views.length &&
        (!none || views.length === 1) &&
        /;\s*reason=\S[^;]*/.test(row) &&
        (!none || /;\s*omission=\S[^;]*/.test(row)) &&
        (!excluded || none),
      detail: row || "missing selection; semantic usefulness is checked separately",
    };
  });
}
