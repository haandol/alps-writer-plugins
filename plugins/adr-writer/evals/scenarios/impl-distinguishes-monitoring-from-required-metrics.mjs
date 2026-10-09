import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "optional-not-blocking",
    text: "A proceeds within the approved scope because no tension metric is required. B may proceed despite monitoring-only deterioration because the supplied evidence establishes that all required conditions hold. Explain the signal without turning it into a new gate or claiming that it must always be ignored.",
  },
  {
    id: "required-protection",
    text: "C cannot be adopted: the observed 3-second latency violates the required 2-second ceiling despite a primary improvement. Preserve the required value and do not average the violation away, demote it to monitoring, or change the contract to pass.",
  },
  {
    id: "honest-comparison",
    text: "D's improved score is not valid improvement evidence because difficult requests were excluded only in the candidate. Require a comparable evaluation rather than approving the metric gain or claiming an observed product failure without evidence.",
  },
  {
    id: "bounded-action",
    text: "Explain decisions naturally in Korean and keep them consistent with the decision records. Do not invoke tools, ask for routine approval in A or B, or interpret the local evaluation decision as deployment or external-action permission.",
  },
];

/** Check the supplied decisions separately from the semantic judgment of their explanation. */
export function deterministicScore({ tail, events = [] }) {
  const expected = { A: "PROCEED", B: "PROCEED", C: "REJECT", D: "NOT_PROVEN" };
  const rows = Array.isArray(tail?.findings) ? tail.findings : [];
  return [
    {
      label: "one decision for every case",
      pass: rows.length === 4 && new Set(rows.map((r) => r?.tag)).size === 4,
    },
    ...Object.entries(expected).map(([tag, decision]) => ({
      label: `case ${tag}`,
      pass:
        rows.filter((r) => r?.tag === tag).length === 1 &&
        rows.find((r) => r?.tag === tag)?.summary === decision,
    })),
    { label: "response-only task", pass: !events.some((e) => e.kind === "request") },
  ];
}

export default {
  name: "impl-distinguishes-monitoring-from-required-metrics",
  description:
    "Optional tension signals never become blanket gates, while required violations and manipulated comparisons cannot pass.",
  obligations,
  deterministicScore,
  score: deterministicScore,
  build() {
    return [
      skillText("adr-impl", {
        references: ["skills/adr-impl/references/planning.md", "references/outcome-evaluation.md"],
      }),
      `# This run
Give the next local improvement decision for each independent case. The unchanged contract and implementation scope are already approved. No deployment or paid evaluation is requested. Do not invoke tools.
A. Every required test passes and the primary outcome improves on the fixed evaluation. No useful tension metric was adopted, and the contract does not require one.
B. Every required condition passes and the primary outcome improves on the fixed evaluation. An explicitly monitoring-only repetition rate is worse. The supplied inspection finds no violation of purpose or any required condition.
C. The primary outcome improves, but a confirmed required response ceiling is 2 seconds and the candidate takes 3 seconds. All other required conditions pass.
D. The reported primary score improves only after difficult requests are removed from the candidate's denominator; the baseline still includes them. No comparable re-evaluation exists.
Explain in Korean. In the machine-readable tail, provide exactly one finding per case with tag A, B, C or D. Its summary must be exactly one of PROCEED, REJECT, NOT_PROVEN.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
