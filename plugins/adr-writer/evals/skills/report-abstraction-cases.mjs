/** Fixed system facts distinguish reader adaptation from changing the explained contract. */
const systemFacts = `Supplied hypothetical request-processing system:
A caller identifies retries of the same operation with the same request identifier.
The service reuses a stored completed result for that identifier instead of sending another external operation.
The external service may finish even when its reply never reaches the caller. An unknown outcome must be checked with the external service before another operation is attempted.
No global request ordering, automatic cancellation on timeout, or always-current local record is guaranteed. No live deployment, benchmark, or reader study was performed.`;

export const abstractionCases = [
  {
    id: "report-drilldown-visual-detail",
    title: "Detailed relationships receive their own useful visual explanations",
    source: `${systemFacts}
Known reader context: the reader understands HTTP requests and prefers a small overview before inspecting the mechanism.`,
    task: "Write a Korean report explaining the retry-handling role, then unfold its internal responsibilities and detailed handling of recorded completion and unknown outcomes. Keep the overview approachable and the precise behavior reachable in the relevant deeper sections. Do not use tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "detail-visualization",
        text: "The report supplies a meaningful visual explanation within the detailed unknown-outcome discussion, using a Mermaid sequence for the central external-completion, missing-reply, caller-timeout and outcome-lookup events. An overview-only figure, a promised figure, or an unrelated appendix diagram does not satisfy this detail need. Other useful internal views are allowed without requiring a fixed count or a diagram in every leaf.",
      },
      {
        id: "same-subject-and-resolution",
        text: "The detailed view identifies the previously introduced retry-handling responsibility that it expands and exposes internal relationships or events hidden by the overview. It does not simply repeat the overview or move every low-level event to the first screen. Known reader context informs the starting point; specific illustrative identifiers or results, if used, are not presented as measurements.",
      },
      {
        id: "grounded-view",
        text: "The figure and nearby explanation preserve the required original-outcome check and distinguish a lost response from a failed operation. They do not invent global serialization, cancellation on timeout, always-current records, or tested guarantees. Mermaid source is available in this text-only delivery without claiming browser rendering, live execution, or measured learning gains.",
      },
    ],
  },
  {
    id: "report-drilldown-visual-restraint",
    title: "Review distinguishes a missing detail figure from a forced figure quota",
    source: systemFacts,
    task: `Review the following report layout and proposed revision against the supplied facts. Explain which sections need better visual explanation and which do not, with the reader impact. Do not rewrite the report, use tools, or write files. The user excludes quizzes.
Current layout:
Overview: a small Caller → Retry handling → External service diagram and the known-versus-unknown outcome limit.
Detailed unknown-outcome section: paragraphs about provider completion, a lost reply, caller timeout, and querying the original outcome; no figure. The author says the overview diagram already covers all visualization needs.
Output-language note: "The report is written in Korean."
Proposed revision: copy the overview diagram into every detail section and give the output-language note its own diagram so that the report contains exactly ten figures.`,
    semanticObligations: [
      {
        id: "specific-visual-gap",
        text: "The review identifies the detailed timing interaction as needing a focused sequence in its own section, showing completion, reply loss, timeout and lookup while retaining the parent retry-handling role. It explains that the overview hides those internal events and therefore does not satisfy that section's need. A vague request for more visuals alone is insufficient.",
      },
      {
        id: "proportionality",
        text: "The review rejects both repeating the same overview and requiring exactly ten figures. It permits the simple Korean-language note to remain prose and chooses other views only for distinct explanatory needs. It does not replace the proposed quota with a different fixed count, require every leaf to contain a picture, or claim that colorful styling establishes deeper understanding.",
      },
      {
        id: "scope-and-grounding",
        text: "The response stays review-only and preserves the known-versus-unknown outcome limit. It does not invent system events, missing guarantees, reader experience, actual file changes, rendered results, or learning gains. Its recommendation uses the supplied relationships, not speculative service calls added merely to complete a diagram.",
      },
    ],
  },
  {
    id: "report-drilldown-familiar-reader",
    title: "Known reader context grounds an analogy that unfolds into the same system",
    source: `${systemFacts}
Known reader context from the conversation: the reader manages a library request desk and understands claim slips and request records. They are new to distributed request processing and prefer an everyday explanation before technical detail.`,
    task: "Write a Korean report explaining why retry handling works this way. Start at an approachable level, then let the reader descend to a precise explanation of the same system. Use the reader context already supplied; do not ask background questions. Do not use tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "familiar-start",
        text: "The upper explanation actually uses the supplied library-desk familiarity to teach the request-tracking role, rather than merely mentioning the reader's job. It defers storage/network internals while making the answer and the unknown-outcome limit understandable. It does not invent other reader experience, repeat a profile interview, or delay the answer behind a long story.",
      },
      {
        id: "same-subject-descent",
        text: "A descent expands a role or relationship already introduced above into its actual responsibilities or mechanism. The analogy's useful elements are connected to the request identifier and recorded outcome before those terms carry the explanation. The deeper flow explains completion without a received reply and the required outcome check. Merely nesting completed/unknown peer cases or linking raw evidence does not count as lower abstraction.",
      },
      {
        id: "analogy-boundary",
        text: "The analogy does not imply that requests are globally serialized like people waiting at a desk, that a timeout cancels the operation, or that local records always know the external outcome. Important uncertainty remains visible above; precise rules and evidence limits survive below. No particular metaphor sentence, heading list, or number of levels is required.",
      },
    ],
  },
  {
    id: "report-drilldown-experienced-reader",
    title: "Known expertise changes the starting resolution without changing the facts",
    source: `${systemFacts}
Known reader context from the conversation: the reader maintains HTTP APIs, already understands request identifiers and timeouts, and is learning how a separate provider's outcome is reconciled. They prefer building on familiar API behavior to an elementary story.`,
    task: "Write a Korean report that explains this system from an overview down to the unfamiliar mechanism. Use the known reader context and preserve the supplied system facts. Do not use tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "appropriate-start",
        text: "The report builds from the supplied API familiarity and focuses its explanation on the separate provider's outcome. It does not force a beginner metaphor, re-teach all known concepts, or ask the reader to restate their background. Familiarity is used to choose a meaningful starting resolution, not as a reason to dump all internal mechanics in the overview.",
      },
      {
        id: "precise-expansion",
        text: "The overview states the role and important unknown-outcome limit; the deeper explanation opens up that same retry-handling role and shows why local timeout or missing completion cannot decide whether to send another operation. It connects the reader's known API concepts to the unfamiliar provider boundary and preserves the original-result lookup rule.",
      },
      {
        id: "grounding",
        text: "The report preserves the same facts as the novice-reader case without inventing provider guarantees, deployed results, or learning gains. Any analogy is bounded; an accurate direct explanation based on the supplied expertise is valid. No fixed metaphor or heading list is required.",
      },
    ],
  },
  {
    id: "report-drilldown-no-reader-profile",
    title: "Missing personal context does not block a grounded abstraction ladder",
    source: systemFacts,
    task: "Write a Korean report that starts with an accessible view and progressively explains this system precisely. No reader biography or expertise has been supplied. Do not use tools or write files. The user excludes quizzes.",
    semanticObligations: [
      {
        id: "no-fabricated-familiarity",
        text: "The report proceeds with a broadly understandable analogy or plain explanation without inventing a reader job, hobby, experience, or expertise. It does not require a background interview, personal-data lookup, or saved learner profile before answering. It may use a hypothetical everyday situation without claiming the reader has experienced it.",
      },
      {
        id: "depth-and-precision",
        text: "The upper explanation defers unnecessary internal vocabulary but keeps the answer and the unknown-outcome caveat. The detailed explanation opens up the same role into request recognition, stored completion, and checking the external outcome. Any analogy is connected to actual terms and is not used to infer cancellation, global ordering, or guaranteed current records.",
      },
    ],
  },
  {
    id: "report-drilldown-rejects-cosmetic-depth",
    title: "Review separates abstraction change from UI nesting and misleading analogy",
    source: `${systemFacts}
Known reader context: the reader understands a library request desk and claim slips.`,
    task: `Review these two report fragments against the supplied facts and reader context. Explain which transitions help or prevent precise understanding. Do not rewrite the fragments, invoke tools, or write files. The user excludes quizzes.
Fragment A:
The service treats the same claim slip as one request. A missing reply does not establish whether the work finished.
Inside that request-tracking role, the slip corresponds to the request identifier and the desk record to the stored result. A completed record lets the service return the earlier result without another external operation.
To understand an unknown outcome, open up the interaction: the external service can finish, its reply may never arrive, and the caller then times out. The caller must check the original outcome before another attempt. The desk analogy does not establish global request order.
Fragment B:
This works just like the library where you have trained all new staff. A timeout cancels the work, just as leaving the desk line cancels a request.
Click Completed for completed requests; click Unknown for unknown requests. These two peer status cards are the lower abstraction level.
Click Raw logs for the deepest explanation; reconstruct the mechanism there. A redesigned colored sidebar makes this a more precise report.`,
    semanticObligations: [
      {
        id: "meaningful-descent",
        text: "The review recognizes that A opens up the previously introduced request-tracking role, maps analogy elements to real concepts, and then explains the provider interaction and limit. It identifies B's peer status cards, raw-log link, and restyling as insufficient evidence of lower abstraction, while allowing navigation to support a real explanatory hierarchy.",
      },
      {
        id: "false-familiarity-and-guarantee",
        text: "The review identifies both the invented staff-training history and the false timeout-cancels-work claim in B. It explains how the cancellation analogy would lead the reader to act on an unsupported outcome, rather than treating the issue as optional wording polish. The supplied desk familiarity itself is valid and need not be discarded.",
      },
      {
        id: "review-boundary",
        text: "The response stays review-only, grounds its judgment in actual fragment transitions and supplied facts, and does not invent executed checks or measured reader improvement. It does not require a fixed number of diagrams, nested sections, or clicks.",
      },
    ],
  },
];
