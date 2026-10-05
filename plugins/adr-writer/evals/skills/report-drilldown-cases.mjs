/** Supplied scenarios probe explanation depth, not live service behavior or learning gains. */
const retryFacts = `Supplied hypothetical comparison:
An operator needs to avoid duplicate payment charges when clients retry.
Option A sends every retry to the provider as a new charge.
Option B reuses a stored completion for the same request key. If the provider outcome is unknown after a timeout, B must reconcile that outcome before another charge.
The request key connects the client's retry to the payment record; the record identifies whether completion is known. No benchmark, deployed-system check, or user study was performed.`;

export const drilldownCases = [
  {
    id: "report-drilldown-comparison",
    title: "Comparison explains the decision before its mechanism and conditions",
    source: retryFacts,
    task: "Write a Korean comparison report for a junior developer deciding how to handle retries. Use a useful hierarchy with your own headings, not a prescribed outline. The reader should understand the choice before reading detailed evidence and learn something new when opening a deeper explanation. Do not use tools or write files. The user excludes quizzes for this report.",
    semanticObligations: [
      {
        id: "orientation",
        text: "The opening connects avoiding duplicate charges to the reader's concrete use of this comparison: deciding which retry outcomes can reuse completion and which require more evidence. A task recap or broad reliability goal alone is insufficient. The answer explains that B protects completed retries while unknown provider outcomes still require reconciliation; that limitation is visible without reading the detailed branch. No unsupported measurements are added.",
      },
      {
        id: "relationship",
        text: "Before relying on request keys or stored completion in a deeper branch, the report explains how the client's request key connects a retry to the recorded outcome. It does not merely list client, storage and provider as unrelated components.",
      },
      {
        id: "depth",
        text: "The deeper explanation adds why a known completion can be reused and why a timeout cannot authorize a fresh charge. It does not repeat the parent conclusion at every depth or require reading raw source material to infer the mechanism. Topic-specific headings are allowed; no particular heading list is required.",
      },
    ],
  },
  {
    id: "report-drilldown-incident",
    title: "Incident explanation separates outcome, cause and supporting sequence",
    source: `Supplied hypothetical incident:
The provider completed a payment, but its response did not reach the caller. The caller timed out and retried. The retry was forwarded as a new charge because the local system had not recorded completion. A second charge occurred.
Reconciliation means asking the provider for the original payment outcome before deciding whether to issue another charge. This is a proposed correction; no corrected implementation or recovery test was run.`,
    task: "Explain this incident in Korean for a junior developer, using a top-down report whose headings fit the incident. Let the reader understand the outcome and uncertainty before drilling into the causal sequence. Do not invoke tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "opening",
        text: "The opening makes the intended reading outcome concrete: the junior developer can distinguish a caller timeout from a failed charge and locate the retry decision that caused the duplicate. The answer states that a lost response followed by a fresh-charge retry caused the duplicate, and distinguishes the proposed correction from verified recovery. It does not merely announce an incident review or promise improved reliability.",
      },
      {
        id: "causality",
        text: "The detailed explanation teaches the difference between a caller timeout and the provider not charging, with the actual supplied ordering. It introduces reconciliation in plain language before relying on it, and explains how the lost response links the provider result to the local missing completion.",
      },
      {
        id: "progression",
        text: "The hierarchy lets the reader move from outcome to mechanism and supporting sequence without jumping directly from a conclusion to uninterpreted logs. Any diagram preserves the supplied participants and order. It does not impose comparison-only sections or invent executed fixes, guarantees or metrics.",
      },
    ],
  },
  {
    id: "report-drilldown-opening-purpose",
    title: "Opening distinguishes a task recap from a concrete reading outcome",
    source: retryFacts,
    task: `Review only these two report openings for the supplied retry comparison. Explain whether each conveys why the document is useful and what the junior developer should be able to do with it. Use the same supplied facts for both. Do not rewrite either opening, use tools or write files. The user excludes quizzes.
Opening A:
The user requested a comparison of retry designs to avoid duplicate charges. This report reviews the options and aims to improve payment reliability.
Opening B:
A client can retry when the original payment has a recorded completion or when its outcome is still unknown. This comparison helps the developer decide what evidence is needed before acting on each kind of retry, so the design does not create a second charge.`,
    semanticObligations: [
      {
        id: "request-versus-use",
        text: "The review identifies that A supplies the task and product goal but leaves the reader's concrete judgment unspecified. B names the recorded-versus-unknown cases and the evidence decision the comparison should support. It explains that distinction rather than treating the presence of a purpose word or an action verb as sufficient.",
      },
      {
        id: "grounded-promise",
        text: "The review checks the openings against the supplied cases and treats B's reader outcome as an intended use, not measured learning or proven reliability. It does not invent an incident, deployment, approval need or reader deficit, and does not require a particular heading or the literal phrase after reading.",
      },
      {
        id: "review-scope",
        text: "The response explains the gap and reader impact without rewriting either opening, adding quizzes, creating files or implying that a good opening alone establishes the quality of the rest of the report.",
      },
    ],
  },
  {
    id: "report-drilldown-distinguishes-shallow",
    title: "Review distinguishes explanation depth from repeated nested headings",
    source: retryFacts,
    task: `Review these two short explanations against the supplied facts. Explain whether each supports top-down understanding, using specific transitions. Do not rewrite them, use tools or write files. The user excludes quizzes.
Excerpt A:
# Retry decision
## Background and goals
The operator wants to avoid charging twice when a client retries.
## Reuse only a known completion
B reuses completed requests, but an unknown provider outcome still needs reconciliation. The client's request key identifies the payment record used to distinguish these cases.
### Why the recorded outcome matters
For the same key, a completed record returns the earlier result without sending a new charge. A timeout may occur after the provider has charged, so an unknown outcome must be checked with the provider before another charge.
Excerpt B:
# Retry decision
## Background and goals
The operator wants to avoid charging twice when a client retries.
## Reuse only a known completion
B reuses completed requests, but an unknown provider outcome still needs reconciliation.
### Payment branch
B reuses completed requests, but an unknown provider outcome still needs reconciliation.
#### Detailed mechanism
Apply idempotency at the boundary; read the original supplied facts to work out how the request key, record, and provider outcome interact.`,
    semanticObligations: [
      {
        id: "specific-gap",
        text: "The review identifies that B repeats the same conclusion without teaching the mechanism, then assumes unexplained idempotency and sends the reader to raw facts to reconstruct the relationships. It explains the effect on the reader rather than grading by heading count or a keyword alone.",
      },
      {
        id: "sound-transition",
        text: "The review recognizes that A introduces the request-key to record relationship before using it and then adds known-completion behavior and the timeout caveat. It does not reject A merely because its headings differ from a fixed template.",
      },
      {
        id: "boundary",
        text: "The response proposes outcome-focused improvements without rewriting either excerpt, claiming reader-study results, inventing facts, or adding quizzes. It distinguishes semantic explanation quality from valid nesting.",
      },
    ],
  },
];
