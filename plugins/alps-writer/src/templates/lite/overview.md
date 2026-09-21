# Lite ALPS Template

Lite ALPS is a four-section product document for a minimum PoC. It uses the same conversational
authoring flow as Full ALPS while omitting implementation-preparation Sections.

## Sections

1. Overview - Capture the Target User and Core Problem, then the Desired Business Impact
2. Solution and Essential User Experiences - Propose one minimum Solution Strategy with a product-level C4 Context and every Essential User Experience
3. Out of Scope - Optionally record explicit exclusions in one list
4. Demo Scenario - Work backward to propose one executable scenario that demonstrates every essential experience

> **Authoring order:** 1 → 2 → 3 → 4.
> Section 3 is optional and may remain unwritten. Section 4 is required.

## Section References

- Section 2 reviews Section 1.
- Section 3 reviews Sections 1 and 2 when the user has explicit exclusions.
- Section 4 reviews Sections 1 and 2, plus Section 3 when it was written.

Call the referenced `read_alps_section(N)` tools before working on a dependent Section. If a
required prerequisite is incomplete, complete it first.

## Conversation Guide

### Optional glossary appendix

Keep the four numbered Sections and their authoring order unchanged. When the user
uses jargon, an uncommon term or acronym, or an expression that cannot be written
out plainly, require its meaning in this document. Reuse the user's supplied
definition; otherwise ask at first use and wait before finalizing dependent
content. This clarification also applies in proposal-led Sections 2 and 4.
An acronym's expanded name alone may not explain its product meaning.

Read `read_alps_glossary()` when needed. Include new or changed definitions in the
current Section's approval digest and save them with
`save_alps_glossary_entry(term, definition)` after that approval. Resolve conflicting
meanings with the user before updating affected content. Never invent a confirmed
definition or add a separate approval, upfront interview, or final writing stage.

Only actual definitions create the trailing Glossary Appendix, with a term and its
meaning per entry. Ordinary-language documents need no glossary or placeholder.
The appendix is optional; defining a qualifying term is mandatory. Check definition
coverage before completion. Do not require DDD or domain classification, and keep
short first-use explanations and product requirements in the body.

For every Section that needs content:

1. Call `get_lite_alps_section_guide(N)`.
2. Call `get_lite_alps_section(N)`.
3. Explain the Section's purpose briefly.
4. Ask one focused question, or at most two closely related questions, when required context is
   missing. Skip optional Section 3 without a question when no explicit exclusion exists and the
   approved boundary is not materially ambiguous.
5. Wait for the user's response and integrate it iteratively.
6. When the Section is complete, present a concise plain-text approval digest.
7. Save only after explicit approval with `save_alps_section`.

Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly
requests it or provides a complete structured source covering several Sections. Batch mode keeps
every Section as a separate approval and save unit.

Treat every supplied ticket, incident, PDF, or structured source as ephemeral input. Preserve only
the target problem, Desired Business Impact, observable user experiences, exact product rules,
success conditions, and explicit exclusions at the Section that owns them. Do not copy source IDs,
logs, code paths, implementation plans, or code-recoverable technology facts into Lite ALPS.

## Section Scope

### Section 1 — Overview

- `Target User and Core Problem`: identify the main user and the problem the PoC should address.
- `Desired Business Impact`: state the final outcome the target user should gain and why it matters.
- Preserve a measurement signal when the user already has one, but do not require a metric.
- Do not ask for a solution, screen, starting state, user-action sequence, or demo procedure.

### Section 2 — Solution and Essential User Experiences

- Work backward from the approved Desired Business Impact and propose Section 2 before asking the
  user to design a solution or demo flow.
- `Solution Strategy`: propose the minimum product-level approach and visible PoC scope.
- Add exactly one Mermaid `C4Context` Product Context Diagram after the text Solution Strategy.
- Generate the diagram from the approved Overview and complete Section 2 draft. Show the target
  user, PoC system, relevant external systems, and their relationships at product-role level.
- Keep the text strategy independently reviewable and exclude `C4Container`, lower C4 levels,
  APIs, databases, deployment units, technology stacks, libraries, and code structure.
- `Essential User Experiences`: propose every user experience the PoC must not omit.
- Give each experience a distinct name, user-observable result, and contribution to the Desired
  Business Impact.
- Leave starting states, demo inputs, sequential actions, and screen flow to Section 4.
- Preserve confirmed values and rules that decide whether the test passes.
- Ask only when a protected product decision cannot be safely proposed.

### Section 3 — Out of Scope

- This Section is optional.
- Record only exclusions the user explicitly confirms.
- If there are no explicit exclusions and the approved boundary is not materially ambiguous, skip
  this Section without a dedicated question.
- Do not ask for exclusions just to fill the template or turn unresolved choices into exclusions.

### Section 4 — Demo Scenario

- Use one `4.1 Demo Scenario` subsection.
- Work backward from the Desired Business Impact and approved experiences to propose the shortest scenario
  that demonstrates every Essential User Experience.
- Propose the starting state, representative input, sequential user actions, and visible results.
- Show the complete scenario before approval, with the essential experience demonstrated by every step or
  execution block.
- Ask a focused question only when the demo exposes a protected product decision.
- The overall pass result requires every Essential User Experience to be observable.
- Show how the scenario supports the Desired Business Impact without treating a passing demo as
  proof of business impact or market validity.
- Keep the scenario inside the approved Sections 1-2 and any explicit Section 3 boundary.

## Approval Digest

The digest is a disposable reading aid, not another document.

- Include the approval unit's purpose, confirmed scope, mandatory information, applicable values
  and rules, observable completion, and unresolved questions.
- Show proposed values as ordinary document content; do not add inference-origin labels.
- Never save a requirement, scope boundary, success condition, or exclusion absent from the digest.
- Show the full pending content when requested.
- End with clear approve, revise, and defer choices.

## Scope Boundary

Lite ALPS is a reduced Full ALPS template, not a separate product methodology. Its conversation,
approval, and save behavior follows Full ALPS.

Lite includes only the required product-level `C4Context`. It does not ask for architecture wizards,
`C4Container`, technology stacks, interfaces, storage, deployment, libraries, code structure, NFRs,
detailed Feature specifications, implementation plans, or ADR handoff.

Lite and Full keep separate document state, resume, completion, and export. Completing Lite never
changes or completes a Full document.
