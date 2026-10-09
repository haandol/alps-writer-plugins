/** Report behavior fixtures, not observations of a deployed service. */
export const reportPathCases = [
  {
    id: "report-drilldown-path-review",
    title: "Review detects a shared error node that widens retry permission",
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
  {
    id: "report-drilldown-process-stages",
    title: "A process stage expands into its inputs, decisions and outputs",
    source: `Supplied hypothetical catalog process:
An operator supplies product rows. The process validates required product IDs and nonnegative whole-won prices; any invalid row rejects the complete batch.
Normalization trims the ends of product IDs and preserves case. Equal normalized IDs with equal prices collapse into one row; conflicting prices reject the complete batch.
The normalized rows are compared with the published catalog to create an immutable candidate revision and counts of added, changed and unchanged rows. Unchanged rows have no write effect.
A reviewer approves one exact revision. Changing its contents requires a new revision and approval. Publication durably stores the approved revision before atomically switching the public pointer; failure leaves the old published revision visible.
No further recovery mechanism or performance measurement was supplied.`,
    task: "Write a Korean top-down report explaining this product-catalog process for a junior developer. Show the whole process with Mermaid after the brief background and answer, then open its responsibilities so the reader can follow how input becomes a published result. Use a concrete illustrative row case where helpful. No tools, file writes, or quiz.",
    semanticObligations: [
      {
        id: "same-process",
        text: "The overview connects validation, normalization/candidate preparation and approved publication. Later explanation expands those same responsibilities and connects their inputs and outputs. Using the subject's actual process stages is valid; the answer does not replace them with the author's research history or unrelated technical layers.",
      },
      {
        id: "concrete-descent",
        text: "The normalization responsibility unfolds into trimming, equality/price decisions and the resulting rows or rejection, with a supported or clearly illustrative concrete input. Detail teaches how the parent result is produced rather than repeating its summary or presenting source excerpts as the mechanism. No fixed heading list or level count is required.",
      },
      {
        id: "source-bounds",
        text: "The report preserves whole-batch rejection, case preservation, unchanged-row behavior, exact-revision approval and durable-storage-before-pointer ordering. It does not invent recovery work, universal no-recovery guarantees, measurements or unsupported intermediate states; source limits remain explicit.",
      },
    ],
  },
];
