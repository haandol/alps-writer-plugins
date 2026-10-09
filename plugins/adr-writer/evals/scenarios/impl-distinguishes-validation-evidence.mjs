import { skillText, TAIL_SPEC } from "../lib/harness.mjs";

export const obligations = [
  {
    id: "entrypoint-evidence",
    text: "A requires implementation repair because the observed signup-button behavior violates the required user flow despite green unit tests. B requires verification of the missing UI path, not a claim that the product is broken or that API tests prove UI completion. Keep independent work moving when access is unavailable.",
  },
  {
    id: "fixed-result-aggregation",
    text: "C can complete the local implementation review because every required observation and validation is supplied as passing; do not add a tension quota or deployment action. D remains unverified because a valid JSON judgment without the required claim/reference evidence does not establish semantic correctness. Do not call LLM judgment deterministic.",
  },
  {
    id: "failure-routing",
    text: "E asks for the unresolved product-policy choice rather than guessing permission. F reassesses the unchanged environmental failure or repairs the evidence path; it does not retry blindly or invent a universal retry count. No new policy or routine reapproval is required for independent contract-preserving repairs.",
  },
  {
    id: "scope",
    text: "Explain the local decisions in Korean consistently with the decision records. Do not invoke tools, claim tests were executed, weaken a required rule, or treat completion as deployment or external-action authorization.",
  },
];

/** Check the supplied decision records independently of the semantic explanation. */
export function deterministicScore({ tail, events = [] }) {
  const expected = {
    A: "REPAIR",
    B: "VERIFY",
    C: "COMPLETE",
    D: "VERIFY",
    E: "DECIDE",
    F: "REASSESS",
  };
  const expectedEntries = Object.entries(expected);
  const rows = Array.isArray(tail?.findings) ? tail.findings : [];
  return [
    {
      label: "one decision per case",
      pass:
        rows.length === expectedEntries.length &&
        new Set(rows.map((r) => r?.tag)).size === expectedEntries.length,
    },
    ...expectedEntries.map(([tag, decision]) => {
      const matches = rows.filter((r) => r?.tag === tag);
      return {
        label: `case ${tag}`,
        pass: matches.length === 1 && matches[0].summary === decision,
      };
    }),
    { label: "response-only scope", pass: !events.some((e) => e.kind === "request") },
  ];
}

export default {
  name: "impl-distinguishes-validation-evidence",
  description:
    "Completion distinguishes observed user-flow failures, missing evidence, semantic-judge uncertainty and policy decisions.",
  obligations,
  deterministicScore,
  score: deterministicScore,
  build() {
    return [
      skillText("adr-impl", {
        references: [
          "skills/adr-impl/references/planning.md",
          "references/outcome-evaluation.md",
          "references/implementation-evidence.md",
        ],
      }),
      `# This run
Choose the next local action for six independent cases. Relevant contracts and implementation scope are approved except for E's expressly unresolved policy. No deployment is requested. All descriptions below are supplied evidence, not actions for you to execute.
A. Unit/API tests pass. An actual signup-screen run shows that clicking Submit never sends the signup request and the required account is not created.
B. Unit/API tests pass. Required signup UI verification cannot run because the verification environment lacks access. There is no observed UI failure.
C. The supplied code checks, required UI flow and contract-coverage review all pass with original evidence. There are no unresolved required conditions or material risks, and no required tension metric.
D. The semantic evaluator was required to identify the judged claim and reference evidence. It returned valid JSON saying pass, but no claim or reference evidence. No independent judgment exists.
E. The user asked for a new sharing behavior but has not decided which roles may see the document. Several materially different permission policies remain possible.
F. Repeated verification attempts hit the same missing dependency. No dependency, input, implementation or evidence has changed, and no new result justifies another identical attempt.
Explain in Korean. In EVAL-FINDINGS emit exactly A through F, with each summary exactly one of REPAIR, VERIFY, COMPLETE, DECIDE or REASSESS.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
