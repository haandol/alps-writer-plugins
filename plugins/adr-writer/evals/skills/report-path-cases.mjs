/** Report behavior fixtures, not observations of a deployed service. */
// Each `references` lists only the content modules its obligations use; report-cases.mjs adds the common ones.
export const reportPathCases = [
  {
    id: "report-drilldown-path-review",
    title: "Review detects a shared error node that widens retry permission",
    // Review-only diagram path check against the source policy.
    references: ["diagrams", "review-results"],
    source: `Supplied hypothetical delivery policy:
A delivery attempt returns success, transport unavailable, or permission denied.
Transport unavailable permits one retry of the same delivery.
Permission denied is terminal: do not retry it. Preserve the denial for the caller.
No recovery action for a denial, extra retry, or deployed result is supplied.`,
    task: `Review the following two detailed diagrams in Korean prose only. Explain which preserves the policy and what a reader would wrongly do if following the other. Do not redraw or rewrite the diagrams, invoke tools, write files, or add a quiz.
Diagram A:
flowchart TD
  A[Delivery attempt] --> B{Outcome}
  B -->|transport unavailable| E[Failure]
  B -->|permission denied| E
  E --> R[Retry the same delivery once]
  B -->|success| S[Return success]
Its prose says: Permission denial must not be retried.
Diagram B:
flowchart TD
  A[Delivery attempt] --> B{Outcome}
  B -->|transport unavailable| R[Retry the same delivery once]
  B -->|permission denied| D[Return denial without retry]
  B -->|success| S[Return success]`,
    semanticObligations: [
      {
        id: "path-permission",
        text: "The review traces permission denied through A's shared Failure node to retry and identifies this as an unsupported action. It does not treat the nearby prose prohibition as repairing the depicted path. It explains the consequence to a reader following the diagram.",
      },
      {
        id: "supported-control",
        text: "The review recognizes that B keeps the two failure conditions distinct and restricts the single retry to transport unavailable. It proposes separating or narrowing the erroneous path, without inventing another recovery action, retry count, or guarantee.",
      },
      {
        id: "review-boundary",
        text: "The response stays review-only, uses the supplied policy and diagrams as evidence, and does not claim to have edited or executed them. It does not claim diagram syntax validity alone establishes the policy's correctness.",
      },
    ],
  },
];
