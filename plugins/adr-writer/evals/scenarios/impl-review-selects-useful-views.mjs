import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-selects-useful-views",
  description:
    "Select useful sequence/component views when feasible; honor figure exclusions and unavailable evidence with prose delivery, without a mandatory-figure gate or omission approval.",
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
  score({ tail }) {
    const expected = {
      A: ["sequenceDiagram"],
      B: ["flowchart", "sequenceDiagram"],
      C: ["stateDiagram-v2"],
      D: ["none"],
      E: ["none"],
      F: ["none"],
    };
    return Object.entries(expected).map(([tag, views]) => {
      const row = tail.findings.find((finding) => finding.tag === tag)?.summary || "";
      const actual =
        row
          .match(/(?:^|;)\s*views=([^;]+)/)?.[1]
          .split(",")
          .map((item) => item.trim())
          .sort() || [];
      return {
        label: `${tag} selects views for the actual question`,
        pass:
          actual.join(",") === [...views].sort().join(",") &&
          /;\s*reason=\S[^;]*/.test(row) &&
          (!views.includes("none") || /;\s*omission=\S[^;]*/.test(row)),
        detail: row || "missing selection",
      };
    });
  },
};
