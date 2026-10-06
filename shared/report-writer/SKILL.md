---
name: report-writer
description: Create or revise requested reports, and automatically explain complex topics or review findings through a report when structured depth materially helps understanding. Answer short, simple requests in chat; ask when report usefulness is unclear. For selected reports, default to standalone HTML and open it in the default browser, honoring delivery preferences.
---

# Report writing

Decide whether a report is useful before starting the report workflow. These
rules apply to technical explanations, reviews, audits, evaluations, sync and
rollup results; the task's name alone does not require a report.

## Choose the delivery

- **Explicit request:** Create or revise a report when the user asks for one or
  directly invokes this skill, even for a short topic. Honor explicit chat-only,
  no-file, no-open, other-format and browser requests within their scope.
- **Complex content:** Automatically create a report when the reader needs to
  connect conditions, relationships, comparisons or evidence that structured
  depth, diagrams or evidence navigation would materially clarify. A failure
  path across several components or a comparison with interacting constraints
  may qualify. Do not ask for routine permission in this case.
- **Short, simple content:** Answer in chat when a short explanation or small
  list can convey the complete answer and necessary evidence. A term definition,
  one-step instruction or local review finding often fits. Do not create a
  report file, open a browser or add a quiz. Technical vocabulary, a review
  request, word count or item count alone is not a complexity threshold.
- **Unclear usefulness:** Ask one brief question about whether the user wants a
  report before generating it. Keep the clarification to that question and only
  the context needed to choose; do not repeat it after an explanation or turn it
  into a report outline. Reuse a delivery choice already established for
  the same scope. Continue independent investigation or task work while waiting;
  silence is not permission to create a file.

Apply the delivery criteria without narrating the skill or its routing rules to
the user. On chat and clarification paths, answer or ask directly.

Preserve report and audit artifacts explicitly required by a specialized
workflow the user has selected. Do not infer such a requirement merely because
the task is a review or evaluation. This skill does not change the caller's
inspection scope, evidence, verdict, permissions or mandatory artifact schema.

Stop here for chat delivery; the report structure and quiz rules below do not
apply. Once a report is selected, read [review results](references/review-results.md)
for review presentation and follow the workflow below. Unless the user specifies
another format or delivery constraint, create standalone HTML, validate it, open
the final file once in the operating system's default browser and return its
absolute path. A chat summary accompanies a selected HTML report rather than
replacing it. Keep caller-required Markdown or JSON as supporting artifacts.

## Compose a selected report

Before creating review, audit, sync, or rollup report files or supporting
artifacts, follow [review artifact storage](references/review-artifacts.md).
Keep each run in its own Git-ignored `.adr-review/` subdirectory in the reviewed
project; final reports and intermediate evidence use the same run directory.

Generate one to five medium-difficulty quiz questions about the report's core
content to support understanding and reduce cognitive load. Apply
[comprehension support](references/comprehension.md) when composing the report;
this skill owns quiz generation, including for reviews. Omit the quiz only when
the user excludes it or the output has no substantive concept to check. Keep
questions in the report and start a conversational quiz only on explicit request.

Write skill instructions and model-facing prompts in English. Write the report
in the user's requested language. This skill governs final human-facing
presentation; a caller's review strength, findings, approval boundaries, required
data fields, and source artifacts remain authoritative.

Read [editorial review](references/editorial-review.md) before drafting or
reviewing prose, and [format and layout](references/format-and-layout.md) for the
chosen delivery format. Reuse instructions already loaded in the current
context. The same instructions apply inside another skill.

Omit commentary that explains what the reader already understands, including
obvious example labels, repeated conclusions, and repeated caveats. Keep context
and qualifications that change the meaning; follow the editorial guidance below.

## Establish the reader's question

Preserve intent as the basis for judgment when the request leaves details open.
Explain the user's problem, intended outcome, and supplied scope or priorities;
connect material autonomous choices and evidence to that purpose. Follow
[editorial review](references/editorial-review.md) for this meaning check. Keep
the early answer, domain hierarchy, native schema, and exact evidence.

- Identify the reader, the question or decision, the requested language and
  format, and the evidence available. Follow the user's current preferences.
  Actively use relevant user context already available to choose a familiar
  starting point, analogy, vocabulary, and depth; the specified audience takes
  precedence. Do not repeat a background interview or invent familiarity.
- Directly below the title, show the standalone heading "Background and goals",
  localized in the report's language (see `references/report-document.md`).
  Explain the concrete problem or unresolved question that makes the report
  useful, then what the reader should be able to distinguish, decide, explain,
  or do after reading it. Separate the product's desired outcome from the
  report's contribution to the reader: "improve reliability" alone does not
  explain which failure or choice this document will help them understand.
  Ground both in the supplied task, trigger, scope and priorities; do not invent
  motives, reader deficits or promised results. A task recap such as "the user
  requested a review of X" is insufficient when the reason and intended use are
  known. Keep this brief and natural, without fixed sentence stems or new fields.
  Use the opening examples and meaning checks in
  [editorial review](references/editorial-review.md#make-the-reports-intended-use-concrete).
- Follow that paragraph immediately with the answer, its material implication,
  any conclusion-changing limitation, and the required next action in a distinct
  display area. An answer heading is optional and follows the report's subject.
  Keep the request context brief so urgent findings remain visible early; put navigation,
  detailed evidence, and process history after the answer. Do not repeat the
  request throughout the report or force this structure onto short completion
  notices and progress messages.
- Preserve exact requirements, values, units, conditions, permissions, ordering,
  findings, tests, and sources. Distinguish facts, supported inferences, and
  proposals; never invent outcomes, historical policies, motives, or measurements.
  Repeated observations alone do not establish robustness, general accuracy, or
  causality beyond the conditions actually tested.
- Keep authoritative PRD/ADR schemas and native evidence complete. Apply this
  skill to the human-facing explanation rather than deleting required fields or
  silently changing machine-readable data.

## Build a domain-scoped hierarchy

Use C4's idea of changing resolution: start with a familiar picture of the whole,
then reveal the same subject's responsibilities, internal relationships, rules,
and concrete behavior as needed. Upper levels defer unnecessary detail; lower
levels make the explanation precise. Evidence supports these levels rather than
forming a lower abstraction level of its own. Do not force C4 diagram types,
technical-layer headings, or a fixed number of levels onto every report.

When explaining unfamiliar or complex material, read
[abstraction and analogy](references/abstraction-and-analogy.md) for using known
reader context, mapping a familiar analogy to the actual subject, and checking
that each descent reveals its internals. Collapsing text, switching between peer
cases, or opening a source is not by itself a change in abstraction.

- Only the opening heading is fixed. Choose subsequent headings and organization
  for the report's subject and the reader's questions; do not impose a universal
  outline or add empty sections. Preserve the early answer, domain hierarchy,
  required evidence, and the owning workflow's mandatory content and verdict.
- Name the scope and reader question at each level. Prefer evidenced subdomains
  and bounded contexts; within them, divide by business responsibility or concept.
  Do not substitute file order, technical layers, or work phases for domain scope.
  Do not assume team, system, domain, and bounded-context boundaries coincide.
- Keep at most four immediate child explanation units. When there are five or
  more peer sections, list items, cards, or comparison items, add meaningful
  domain grouping or depth. Do not truncate, hide a giant unstructured dump, or
  use arbitrary numbered batches to satisfy the limit. Supporting sources and
  comprehension questions belong to their explanation and do not consume its
  child-branch allowance; keep sources in an accessible evidence group.
- Make parent-child scope and drill-down paths clear. A brief answer may fit in
  one node; do not add empty levels. If a grouping is editorial rather than an
  established architectural boundary, say so.
- Let readers stop at the depth they need. The opening explains the problem and
  answer; each domain's opening states its relevant outcome or finding and why
  it matters; deeper passages explain behavior, conditions, and evidence. Use
  informative headings and a short reading route only when it helps readers
  choose a branch. Introduce an unfamiliar actor or term before relying on it.
  A parent supplies the point of its children, not a repeated inventory of them.
  Each child adds a reason, mechanism, condition, or worked example the parent
  did not explain. When the conclusion depends on cross-domain relationships,
  introduce those relationships before splitting into domain branches.
  A collapsed branch's title and brief preview should explain what opening it
  will clarify. Simple source lists need no artificial summary or extra depth.
- Keep complete source evidence reachable at the appropriate depth. Use a
  focused excerpt for explanation and a full original artifact when needed.
  The grouping limit must never erase an independent obligation or failure.

## Explain relationships visually

Assess the need for visualization at every explanatory depth, including collapsed
branches and leaf sections. When a newly exposed relationship, condition, state,
sequence, or analogy mapping is easier to understand visually, provide a focused
figure there. An overview diagram does not satisfy a deeper section's different
explanatory need. Use enough views to explain the material without a diagram quota;
simple facts and one-step explanations may remain prose. Apply the detailed
examples in [abstraction and analogy](references/abstraction-and-analogy.md#visualize-the-detail-being-revealed).

- Use Mermaid `sequenceDiagram` when participants, requests, responses, or timing
  are central. Prefer a flowchart for branching flow, a state diagram for state
  transitions, and an entity-relationship diagram for data relationships.
- Keep each figure within its domain and abstraction level. Break a complicated
  picture into an overview and detailed flows rather than making the reader
  reconstruct many independent responsibilities at once. Identify which parent
  element or relationship a detailed figure expands; keep the subject recognizable
  as its internals appear. Map analogy labels to actual terms before relying on
  them. Navigation and visual styling support this explanation, not its depth.
- Place the figure beside its explanation. Briefly state how to read it and what
  it establishes. Draw only supported actors, relationships, order, and failure
  paths; distinguish uncertainty. Do not add a decorative diagram to a trivial fact.
  If evidence does not establish the requested interaction, identify the missing
  information or draw a clearly labeled conceptual view of supported relationships;
  do not invent service calls to fill a requested diagram type.
- Preserve Mermaid source and use the requested format's supported rendering.
  In HTML, provide both the rendered view and accessible source. In Markdown,
  use a Mermaid fence; in static exports, retain source with the supporting
  material. If rendering fails, identify the limitation rather than calling the
  diagram verified or substituting an invented picture.

## Review and deliver

Apply the loaded [editorial review](references/editorial-review.md) and
[format and layout](references/format-and-layout.md) guidance to the latest whole
output, including folded details. Those references own prose, continuity,
quantitative examples, paragraph spacing, wrapping, and the High/Medium/Low
editorial checks; do not repeat their checklists in another report artifact.

Verify hierarchy, complete evidence, links, and actual rendering separately from
semantic review. Fix supported material issues and recheck affected transitions.
Review opened detail sections as well as the overview: check for missing useful
figures, repeated parent diagrams, and pictures that add no explanatory value.
Never weaken findings or invent evidence to pass. Report the changes and checks
actually performed, with unresolved evidence or rendering limits. A self-review
is not an independent review. Do not introduce paid calls or publication solely
to satisfy this workflow without existing authorization.

For HTML or Markdown, use [the report document contract](references/report-document.md)
and `scripts/render-report.mjs` when a structured output helps validate hierarchy
and evidence coverage. It runs with Node.js and no package installation. Other
formats follow the same reading hierarchy using their available authoring tools.

For HTML delivery, follow [format and layout](references/format-and-layout.md#final-delivery)
to verify the final file and open it once, subject to the user's delivery constraints.
Include its absolute path in the final
response. If opening is unavailable or fails, keep the generated HTML and
report the actual reason and path; do not claim that it opened.

If a caller's existing renderer forces a flat legacy layout, keep that output as
an audit source and compose the final human-facing report through this skill.
Do not present the legacy layout as satisfying this contract. Preserve the
caller's complete evidence, test results, and required interactions; group
them under their owning domain instead of discarding them.
