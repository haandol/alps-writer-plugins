# Explanation design

Read after selecting a report. These rules govern the human explanation; the
owning workflow retains scope, evidence, verdict and permissions.

## Establish the reader's question

Identify the reader, question or decision, language, format and available evidence.
Use relevant context from the current request, conversation and available user
memory to choose the starting explanation, vocabulary and depth. Current
instructions and the stated audience take precedence over remembered preferences.
A remembered project name alone does not establish knowledge of its internals.
Use the relevant known concept or experience to explain a relationship in the
subject; mentioning the reader's background without changing the explanation is
insufficient. When familiarity is unknown, use a plain account of the problem,
actors and outcome. Do not invent familiarity, repeat a background interview,
require personal-data lookup or create a learner-profile record.

Directly below the title, place two separate sections in this order:
"Purpose", then "Context" ("목표", then "배경" in Korean).
Purpose briefly states what this report should enable the reader to understand,
distinguish, decide, explain or do. Ground that purpose in the supplied task, trigger, scope
and priorities. A task recap or a product aspiration such as "improve reliability"
alone does not explain the report's use.
Context then introduces the confirmed problem or unresolved question, situation
and request trigger, including the relevant subject, scope and priorities.
Do not invent motives or learning results, or repeat the purpose as background.

Immediately follow with the answer, material implication, conclusion-changing
limitations and required next action in a distinct display area. Its heading is
optional. Put navigation and detailed evidence after this early answer; choose
later headings for the subject rather than imposing a universal outline.
Do not force report openings onto short progress or completion messages.

When explaining material autonomous choices, connect the affected user's intent,
choice and basis to the observed consequence. Tests and common conventions do not
by themselves show that a choice serves that purpose. Distinguish reversible
details within the contract and scope from new product policy or scope expansion.
Only material ambiguity needs a decision; unspecified details alone do not.
Do not invent incidents, impact or exclusions to justify a choice after the fact.

## Make the report self-contained

Treat the report as the reader's only document. Read source passages and their
qualifications, then introduce the background, actors, terms, relationships and
rules needed at each point. Preserve exact requirements, values, units, conditions,
permissions, ordering, exceptions, findings and tests. Distinguish quotations,
facts, supported inferences and proposals; repeated observations alone do not
establish general reliability or causality.

Integrate focused explanations, excerpts or adapted figures where they support
a conclusion. Keep citations for attribution and optional verification, but do
not make following them a prerequisite for understanding. The audience cannot
be assumed to know the authoring conversation, companion files or project facts.
A bibliography or pasted passage does not explain its connection to a judgment.
Avoid copying whole documents or repeating background at every level.

If evidence is unavailable or ambiguous, identify the missing premise and its
effect on the claim. Do not invent a bridge or use a source link in place of it.
Keep authoritative PRD/ADR schemas and native evidence complete; presentation
must not silently change machine-readable facts or required fields.

## Build a domain-scoped hierarchy

Use C4's idea of changing resolution: show the whole, then the same subject's
responsibilities, internal relationships, rules and concrete behavior. Upper
levels explain the subject's purpose, boundary, observable result and essential
relationships in terms the reader can already follow. High abstraction means
less internal detail, not vaguer language or a list of broad topic names. Keep
answer-changing limitations visible while deferring unnecessary mechanics.
Evidence supports an explanation; opening a source, collapsing a section or
switching to a peer case is not itself a lower abstraction level. Do not require
literal C4 notation, technical-layer headings or a fixed number of levels.

The domain hierarchy locates responsibilities inside this whole. Establish why
those responsibilities belong together before presenting them as separate
branches. A catalog of domains, review categories or implementation components
can be accurate while leaving the reader to reconstruct their relationships.
For a review or comparison, unfold the behavior or decision being assessed and
attach findings or alternatives where they change its explanation.

- **Name meaningful scopes.** Prefer evidenced subdomains and bounded contexts,
  then business responsibilities or concepts. Process stages can define scopes
  when they preserve inputs, outputs and rule ownership. Do not substitute file
  order or investigation history for the subject's organization, or assume team,
  system, domain and bounded-context boundaries coincide. Label an editorial
  grouping as such rather than inventing an architectural boundary.
- **Keep at most four immediate child explanation units.** Paragraph count is
  unrestricted. Reorganize five or more peer sections, list items, cards or
  comparisons by meaningful scope; do not truncate, hide an unstructured dump,
  use arbitrary numbered groups or add empty levels. Supporting sources and
  quizzes belong to their explanation and do not consume this child allowance.
- **Orient each descent.** Give each domain an answer-first opening and explain
  which question about that answer needs a reason, mechanism, condition or
  worked example. A child opens an identified part of the parent and adds what
  the reader needs to answer that question; it does not restart the topic.
  Introduce cross-domain relationships before splitting into branches. Titles
  and previews should make the next reading choice clear without repeating an
  inventory. A simple source list needs no artificial parent paragraph.
- **Separate explanation from evidence disclosure.** Default all explanatory
  subsections to expanded; readers may collapse them or explicitly request a
  collapsed view. Detailed evidence, logs and code default to collapsed. Expand
  evidence needed to understand a result, limit or action, and keep material
  facts in the body too. Preserve complete source access without turning every
  required evidence ID into an expansion requirement. Disclosure is not depth.

### Open the same process at a lower level

For top-down or drill-down explanations, follow one substantive path from the
whole to a responsibility, its relationships and conditions, then concrete
behavior. At each transition, identify what the reader already understands and
what the next passage adds. A sequence of topic areas or nested headings alone
does not provide that path. Do not impose a fixed number of levels.

The whole view establishes the process boundary, its input and observable result,
and the relationships between its material responsibilities. Each responsibility
continues into a recognizable explanation or a bounded leaf. A child identifies
which parent responsibility it opens and explains how its internal participants,
decisions or state changes produce the parent's result. Keep the connection to
neighboring stages visible.

Open newly exposed responsibilities in the same way when they still need
explanation. At a concrete level, trace an evidenced or clearly illustrative
input through the applicable condition to its result and important exception.
For example, opening a normalization step can explain how trimming two product
identifiers makes them equal, then how the supplied price rule decides whether
to combine or reject those rows. The input, rule and outcome make the parent's
work understandable; another heading or repeated summary does not.

Introduce the roles and connections needed to understand an implementation name
before using that name as evidence. At lower levels, exact functions, fields or
query languages can be useful; they must not replace the missing relationship
explanation. Keep full hashes, reproduction settings and diagnostic history in
supporting evidence, while retaining conditions that change the conclusion in
the main explanation. Preserve exact values rather than deleting detail.

Stop when the intended reader can explain the responsibility's behavior and
limits or apply its rule without guessing hidden steps. If the source does not
support deeper internals, state that boundary. Use the existing prose and figures;
do not add a mandatory depth, mapping registry, or authoring-plan artifact.

When choosing a familiar starting point or connecting it to an unfamiliar part,
use [abstraction and analogy](abstraction-and-analogy.md). For figures, use
[diagrams](diagrams.md) when choosing, drawing or reviewing them. Assess useful
views throughout the explanation; a whole-system or multi-step report normally
benefits from an overview after the background and answer, before component detail.
Honor exclusions and evidence limits; a missing figure alone never blocks delivery.
For HTML, use [interactive explanations](interactive-explanations.md) when the
reader can learn by expanding a responsibility or changing a condition or case.
