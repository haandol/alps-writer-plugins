# Explanation design

Read after selecting a report. These rules govern the human explanation, while
the owning workflow retains its scope, evidence, verdict and permissions.

## Establish the reader's question

Preserve intent as the basis for judgment when the request leaves details open.
Explain the user's problem, intended outcome, and supplied scope or priorities;
connect material autonomous choices and evidence to that purpose. Follow
[editorial review](editorial-review.md) for this meaning check. Keep
the early answer, domain hierarchy, native schema, and exact evidence.

- Identify the reader, the question or decision, the requested language and
  format, and the evidence available. Follow the user's current preferences.
  Actively use relevant user context already available to choose a familiar
  starting point, analogy, vocabulary, and depth; the specified audience takes
  precedence. Do not repeat a background interview or invent familiarity.
- Directly below the title, show the standalone heading "Background and goals",
  localized in the report's language (see `report-document.md`).
  Explain the concrete problem or unresolved question that makes the report
  useful, then what the reader should be able to distinguish, decide, explain,
  or do after reading it. Separate the product's desired outcome from the
  report's contribution to the reader: "improve reliability" alone does not
  explain which failure or choice this document will help them understand.
  Ground both in the supplied task, trigger, scope and priorities; do not invent
  motives, reader deficits or promised results. A task recap such as "the user
  requested a review of X" is insufficient when the reason and intended use are
  known. Keep this brief and natural, without fixed sentence stems or new fields.
  Review the opening and body together using
  [editorial review](editorial-review.md#check-the-openings-intended-use).
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

## Make the report self-contained

Treat the report as the reader's only document. Use the stated audience's general
knowledge to choose depth, without assuming familiarity with project-specific
material merely because it was available to the author.

- Read the relevant source passages and their qualifications before using them.
  If a needed source is unavailable or ambiguous, state the specific evidence gap
  and its effect on the conclusion. Do not invent missing context or send the
  reader to the source as a substitute for explaining the limitation.
- Introduce the necessary background, actors, terms, relationships, and rules
  where the explanation first needs them. Bring in the source facts and reasoning
  that support the report's findings or actions, preserving exact values, units,
  conditions, exceptions, and uncertainty. Distinguish quotations from paraphrases.
- Integrate focused summaries, excerpts, or adapted figures into the relevant
  explanation. Explain how they support its judgment; a pasted passage or a
  bibliography alone does not supply that connection. Keep the early answer
  concise and put supporting depth in this report's own sections or appendix,
  without copying entire documents or repeating background at every level.
- Retain precise citations for attribution and optional verification. A source
  title, file path, link, or "see the design document" cannot replace content
  needed to understand this report. Optional further reading may remain external;
  material premises, definitions, and conclusion-changing evidence must be
  explained within the report, including those used in tables and figures.

For example, "Retries follow ADR-7" leaves the behavior unexplained. If the source
says that a timeout can follow a successful charge, explain that possibility and
the resulting rule to check the provider's original outcome before charging
again, then cite ADR-7. The reader can understand the rule and its reason without
opening the ADR.

## Build a domain-scoped hierarchy

Use C4's idea of changing resolution: start with a familiar picture of the whole,
then reveal the same subject's responsibilities, internal relationships, rules,
and concrete behavior as needed. Upper levels defer unnecessary detail; lower
levels make the explanation precise. Evidence supports these levels rather than
forming a lower abstraction level of its own. Do not force C4 diagram types,
technical-layer headings, or a fixed number of levels onto every report.

Default to a fully expanded document for reading, printing, and handouts: all
explanatory subsections are initially visible at every depth. Detailed evidence,
logs, and code excerpts default to collapsed. Explain conclusion-changing facts
in the body, and expand an evidence item when understanding the result, limitation,
or required action needs it. Preserve all source access and required evidence;
requiredEvidenceIds is a coverage obligation, not a demand to expand every source.
Readers may collapse sections, and explicit requests for a collapsed view take
precedence. Abstraction controls what each level explains, not whether its
children must be hidden. Apply the print layout and disclosure rules in
[format and layout](format-and-layout.md#print-and-handout-layout).

When explaining unfamiliar or complex material, read
[abstraction and analogy](abstraction-and-analogy.md) for using known
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
- Keep at most four immediate child explanation units. Paragraph count is
  unrestricted; split prose by meaning rather than creating new scopes to fit a
  numeric limit. When there are five or
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
  If a reader collapses a branch, its title and brief preview should still explain
  what it adds. Simple source lists need no artificial summary or extra depth.
- Keep complete source evidence reachable at the appropriate depth. Use a
  focused excerpt for explanation and a full original artifact when needed.
  The grouping limit must never erase an independent obligation or failure.

## Explain relationships visually

Include useful figures whenever the source evidence and delivery format support
them. For whole-system or multi-step process explanations, prefer an overview
Mermaid figure before component detail, after the brief background and answer.
Show purpose, boundaries and essential relationships; defer internal mechanics.
The first top-level explanation node is a useful place for that overview in the
shared document renderer.

Figures are never a delivery gate, including for explicit top-down, C4-like or
drill-down requests. Honor diagram exclusions and format constraints. When a
figure is not feasible, explain the supported relationships in prose and state
limitations that affect interpretation. Do not request permission to omit it or
reject a report solely because it has no figure.

Expand each material overview responsibility in a recognizable branch: identify
the parent element, use consistent terms, and explain newly visible internal
relationships, rules or behavior. A heading tree, peer cases, or raw sources
alone do not establish meaningful descent. Keep meaningful domain scope;
do not turn the document into a file listing or force a fixed level count.

Assess the need for visualization at every explanatory depth, including collapsed
branches and leaf sections. When a newly exposed relationship, condition, state,
sequence, or analogy mapping is easier to understand visually, provide a focused
figure there. An overview diagram does not satisfy a deeper section's different
explanatory need. Use enough views to explain the material without a diagram quota;
simple facts and one-step explanations may remain prose. Apply the detailed
examples in [abstraction and analogy](abstraction-and-analogy.md#visualize-the-detail-being-revealed).

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
  C4-like resolution does not require literal C4 diagram declarations. When syntax
  is unsupported, use an equivalent supported view preserving the evidenced
  relationships. If evidence or format prevents that, explain the relationship
  in prose and retain the material limitation without blocking delivery.
  In HTML, provide both the rendered view and accessible source. In Markdown,
  use a Mermaid fence; in static exports, retain source with the supporting
  material. If rendering fails, identify the limitation rather than calling the
  diagram verified or substituting an invented picture.
