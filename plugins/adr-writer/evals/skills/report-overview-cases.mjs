const facts = `Supplied hypothetical request-processing system:
A caller identifies retries with the same request identifier.
The service reuses a stored completed result instead of sending another external operation.
The external service may finish even when its reply never reaches the caller.
An unknown outcome must be checked externally before another operation is attempted.
No global ordering, cancellation on timeout or always-current local record is guaranteed.
No live deployment, benchmark or reader study was performed.`;

export const overviewCases = [
  {
    id: "report-drilldown-overview-explicit",
    title: "A feasible C4-like walkthrough supplies an overview without a delivery gate",
    source: facts,
    task: "Write a Korean report walking through the whole system in a top-down, C4-like manner. First draw the most abstract process using Mermaid, then open up each important responsibility and explain its internal behavior. Use supported flowchart or sequence syntax. Keep the brief background and answer first. Do not invoke tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "overview-presence-and-order",
        text: "The supplied evidence and supported output make a useful Mermaid overview feasible, so the report includes it after the brief opening and before component detail. It shows the caller, service and external outcome relationship at a higher resolution than the mechanics. It does not declare figures mandatory or make their presence a delivery gate.",
      },
      {
        id: "correspondence-and-descent",
        text: "The report expands each material overview responsibility or relationship in recognizable explanations with consistent terms. The service role unfolds into retry recognition, recorded completion reuse and unknown outcome lookup. Newly revealed timing receives a useful local diagram. Detail adds internals, not just repetition or peer examples. No fixed heading list or figure count is required.",
      },
      {
        id: "grounded-contract",
        text: "The opening retains the unknown-outcome limit. Prose and figures preserve lookup before another attempt without cancellation, global ordering or always-current records. Supported Mermaid source is supplied without claiming browser checks or measured learning.",
      },
    ],
  },
  {
    id: "report-drilldown-overview-default",
    title: "A whole-process explanation defaults to an overview without a diagram keyword",
    source: facts,
    task: "Write a Korean report explaining the complete request-processing system from caller input through handling retries and deciding what can be returned or attempted next. Explain each responsibility so a developer can follow the whole process. Do not invoke tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "default-overview",
        text: "The report provides an actual Mermaid overview before internal mechanics even though the task does not explicitly say diagram, top-down or C4. The overview makes the essential caller/service/external-outcome relationships understandable and retains the unknown-outcome limitation.",
      },
      {
        id: "grounded-descent",
        text: "Later explanation opens up the same responsibilities into retry recognition, completion reuse and reconciliation, preserving the supplied rules. It avoids an invented fixed execution topology, unsupported guarantees, unsupported literal C4 declarations and quizzes.",
      },
    ],
  },
  {
    id: "report-drilldown-overview-excluded",
    title: "A diagram exclusion overrides the whole-system overview default",
    source: facts,
    task: "Write a Korean top-down report explaining the whole system, but use prose only: no diagrams, Mermaid or quizzes. Explain the whole responsibility and then its internals. Do not invoke tools or write files.",
    semanticObligations: [
      {
        id: "user-override",
        text: "The report honors prose-only delivery without diagrams or Mermaid, does not demand a diagram requirement guard, and does not ask for approval of the explicit exclusion. It still explains the whole role before its internals.",
      },
      {
        id: "contract-preserved",
        text: "Same request identity, recorded completion reuse and outcome lookup before another attempt remain understandable with the unknown-outcome caveat. No unsupported cancellation, ordering, current-record or verification guarantee is added.",
      },
    ],
  },
  {
    id: "report-drilldown-overview-review-missing",
    title: "Review recommends a feasible missing overview without failing delivery for absence",
    source: facts,
    task: `Review only this outline against an explicit request for a Mermaid overview followed by C4-like drill-down. Do not rewrite it, invoke tools or write files. No quiz.
Outline: A brief background and accurate answer precede nested prose sections on retry identity, completion reuse and unknown outcome lookup. A Mermaid sequence appears only inside the unknown-outcome detail. All source links are present. The author says hierarchy validation passed and review.status is reviewed, so the report is complete.`,
    semanticObligations: [
      {
        id: "missing-requested-view",
        text: "The review recommends an evidenced overview before component detail because it is feasible and improves orientation. It distinguishes that improvement from a delivery gate: it does not declare the report failed or blocked solely because the overview is absent, require omission approval, or impose a diagram quota. It preserves useful detail and suggests recognizable expansions.",
      },
      {
        id: "validation-boundary",
        text: "The review rejects a validator pass or self-authored reviewed status as proof of this meaning requirement, preserves useful detail and exact system facts, and stays review-only without claiming file changes or executed fixes.",
      },
    ],
  },
  {
    id: "report-drilldown-overview-unavailable",
    title: "Unavailable visual evidence still allows an accurate prose report",
    source:
      "Supplied hypothetical request-processing system with limited evidence: The system accepts requests and eventually returns a result. Its participants, internal steps, ordering, state changes and failure handling were not supplied. The delivery channel supports plain text only. No tools or live inspection are available.",
    task: "Write a Korean C4-like, top-down report using only these supplied facts. Prefer useful figures whenever possible, but figures are never mandatory. Deliver the explanation now without inventing internals, invoking tools or asking permission. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "nonblocking-delivery",
        text: "The response delivers a concise prose explanation without a figure, without treating the top-down request as a mandatory diagram condition, without blocking completion or asking permission to omit one. It explains the supplied whole-system role and the lack of evidence for deeper detail.",
      },
      {
        id: "evidence-preserved",
        text: "The report retains the missing internal evidence and plain-text limitation without inventing participants, call order, states, failure guarantees or successful rendering. It does not promise a later diagram in place of the requested current explanation.",
      },
    ],
  },
];
