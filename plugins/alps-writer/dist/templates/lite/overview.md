# Lite ALPS Template

Every document-specific tool requires `doc_path`, using the document path returned
by init/load. Include it on reads, saves, glossary operations, status and export;
there is no active-document fallback.

Lite ALPS is an eight-section business-requirements document. It refines business
requirements far enough that technical requirements can be derived without another
business question, excludes technical requirements, and makes every requirement
evaluable. It uses the same conversational authoring flow as Full ALPS.

## Sections

1. Business Context - Capture the Target User and Core Problem, then the Intent and Desired Outcome
2. Business Requirements - Propose identified business rules, policies and constraints (`BR-n`)
3. Functional Requirements - Propose identified user-observable behaviors (`FR-n`) and one business-wording `C4Context` Business Context Diagram
4. Non-Functional Requirements - Propose identified, observable quality expectations (`NFR-n`)
5. Edge Cases - Propose identified boundary, failure and abuse situations (`EC-n`)
6. Success Criteria - State release acceptance and propose KPIs (`KPI-n`) with tension metrics (`TM-n`)
7. Out of Scope - Optionally record explicit exclusions in one list
8. Demo Scenario - Work backward to propose one executable scenario that shows every Required FR

> **Authoring order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
> Section 7 is optional and may remain unwritten. Every other Section is required.

## Section References

- Section 2 reviews Section 1.
- Section 3 reviews Sections 1-2; Section 4 reviews Sections 1-3; Section 5 reviews Sections 2-4.
- Section 6 reviews Sections 1-5. Section 7 reviews Sections 1-6 when the user has explicit exclusions.
- Section 8 reviews Sections 1-6, plus Section 7 when it was written.

Call the referenced `alps_section(action: 'read', doc_path, section: N)` tools before working on a dependent Section. If a
required prerequisite is incomplete, complete it first.

## Requirement identifiers

- Define each identifier once in its owning subsection: `BR-n` in 2.1, `FR-n` in 3.1, `NFR-n` in 4.1,
  `EC-n` in 5.1, `KPI-n` and adopted `TM-n` in 6.1. `n` is a positive integer without leading zeros.
- A definition starts a table row's first cell, a list item, or a heading. Every other occurrence is a
  reference. The server rejects a save that defines the same identifier twice in one subsection.
- Keep an approved identifier on the same requirement after rewording or reordering, and never reuse a
  deleted identifier for another meaning.
- Link items by identifier: FR to BR, NFR to its scope (`Global` or FR), EC to FR and BR, KPI to BR and FR,
  TM to the KPI it protects, and each demo step to the FR and EC it shows.
- When an approved item changes or is deleted, show every later item and demo step that references it in
  the same approval digest and save each approved subsection. `alps_document(action: 'status', doc_path)`
  reports undefined references; Lite is complete only when every required Section is written and none remain.

## Evaluable, technology-free requirements

- Every BR, FR, NFR and EC states Required or Optional and an observable pass/fail criterion: the
  situation, the user-visible or business-verifiable result, and its basis (policy, regulation, contract,
  existing business behavior, or the user's decision).
- Keep values, units, population and conditions exact. Never blur them into "appropriate" or "reasonable",
  and never fix a value the user did not supply or approve.
- Do not save a Section while an acceptance-changing value or policy remains unresolved; show the question
  and offer approve-after-answer or defer.
- Record a business-mandated external system, data location or access channel as the business boundary it
  fixes, with its basis. Keep a product name only when a contract, regulation or organization policy
  mandates it. Never record replaceable technology.
- Release acceptance requires every Required BR, FR, NFR and EC to pass. KPIs and tension metrics observe
  the outcome after release and gate release only when the user confirms them as required with a basis.

## Conversation Guide

### Optional glossary appendix

Keep the eight numbered Sections and their authoring order unchanged. When the user
uses jargon, an uncommon term or acronym, or an expression that cannot be written
out plainly, require its meaning in this document. Reuse the user's supplied
definition; otherwise ask at first use and wait before finalizing dependent
content. This clarification also applies in proposal-led Sections 2-6 and 8.
An acronym's expanded name alone may not explain its product meaning.

Read `alps_glossary(action: 'read', doc_path)` when needed. Include new or changed definitions in the
current Section's approval digest and save them with
`alps_glossary(action: 'save', doc_path, term, definition)` after that approval. Resolve conflicting
meanings with the user before updating affected content. Never invent a confirmed
definition or add a separate approval, upfront interview, or final writing stage.

Only actual definitions create the trailing Glossary Appendix, with a term and its
meaning per entry. Ordinary-language documents need no glossary or placeholder.
The appendix is optional; defining a qualifying term is mandatory. Check definition
coverage before completion. Do not require DDD or domain classification for glossary maintenance, and keep
short first-use explanations and requirement rules in the body.

For every Section that needs content:

1. Call `alps_template(action: 'guide', profile: 'lite', section: N)`.
2. Call `alps_template(action: 'section', profile: 'lite', section: N)`.
3. Explain the Section's purpose briefly.
4. Section 1 asks for missing business context. Sections 2-6 and 8 present an AI proposal first and ask one
   focused question, or at most two closely related questions, only for missing context that cannot be
   proposed, an undefined term, or a choice that would change money, permissions, law or regulation,
   privacy or safety, irreversible data meaning, an external promise, or the acceptance boundary. Skip
   optional Section 7 without a question when no explicit exclusion exists and the approved boundary is not
   materially ambiguous.
5. Wait for the user's response and integrate it iteratively.
6. When the Section is complete, present a concise plain-text approval digest.
7. Save only after explicit approval with `alps_section(action: 'save', doc_path, section, subsection_id, title, content)`.

Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly
requests it or provides a complete structured source covering several Sections. Batch mode keeps
every Section as a separate approval and save unit.

Treat every supplied ticket, incident, PDF, earlier Lite document, or structured source as
ephemeral input. Preserve only the target problem, intent and outcome, business rules, observable
behavior, quality expectations, edge cases, success criteria and explicit exclusions at the Section
that owns them. Do not copy source IDs, logs, code paths, implementation plans, or
code-recoverable technology facts into Lite ALPS.

## Section Scope

### Section 1 — Business Context

- `Target User and Core Problem`: identify the main user and the problem.
- `Intent and Desired Outcome`: state the intended change, the final outcome, why it matters, and any
  supplied priorities or scope boundaries.
- Preserve known measurement signals for Section 6. Do not require a metric or a metrics interview.
- Do not ask for a solution, screen, technology, requirement list, starting state, or demo procedure.

### Section 2 — Business Requirements

- Propose every `BR-n` with values, Required or Optional, pass/fail criterion and basis.
- Record that no rule applies in one sentence instead of inventing one.

### Section 3 — Functional Requirements

- Propose every `FR-n` (at least one) with actor, starting situation, business input, applied rules and
  values with BR IDs, observable result, related failure handling, Required or Optional, and
  Given/When/Then acceptance criteria.
- `Business Context Diagram`: exactly one Mermaid `C4Context` generated from Sections 1-2 and the 3.1 draft,
  written in business-role wording. Exclude `C4Container`, lower C4 levels, APIs, databases, servers, app
  structure, deployment units and technology names. The text requirements stay reviewable without it.

### Section 4 — Non-Functional Requirements

- Propose every `NFR-n` with threshold or yes/no condition, unit, population, observation condition, scope,
  Required or Optional and basis. Never drop security, privacy, regulatory, accessibility or contractual
  conditions; there is no count limit.

### Section 5 — Edge Cases

- Propose the applicable `EC-n` situations with related FR and BR IDs, Required or Optional, and the expected
  business outcome as a pass/fail criterion.

### Section 6 — Success Criteria

- State release acceptance, then propose each `KPI-n` with its business calculation and use.
- Always propose a tension metric for every KPI with its abuse or opposite-failure scenario, and record the
  decision per KPI: adopted `TM-n`, guarding Required IDs, or not adopted. A declined candidate never blocks.
- Do not add sample design, data collection or instrumentation; Full ALPS adds them.

### Section 7 — Out of Scope

- This Section is optional. Record only exclusions the user explicitly confirms.

### Section 8 — Demo Scenario

- Propose the shortest scenario that shows every Required FR, with starting state, input, actions, visible
  results and the FR and EC IDs each step shows.
- The overall pass requires every shown FR and EC criterion to pass. A passing demo is not proof of business
  impact or market validity.

## Approval Digest

The digest is a disposable reading aid, not another document.

- Include the approval unit's purpose, confirmed scope, requirement identifiers with Required or Optional,
  applicable values and rules, pass/fail criteria, affected later items, and unresolved questions.
- Show proposed values as ordinary document content; do not add inference-origin labels.
- Never save a requirement, scope boundary, success condition, or exclusion absent from the digest.
- When an approval unit relies on an external factual claim or figure (a regulation, a market or user figure, an external service limit) that the document and supplied sources do not establish, list it under the digest's unresolved questions as an unverified basis and offer research for that item only. This adds no question step: approve, revise and defer stay available, research starts only on request, an approved basis stays unverified, the offer is not repeated for the same item in the conversation, and the post-completion invitation is unchanged. Make no offer for a chosen goal or policy or an already established fact.
- Show the full pending content when requested.
- End with clear approve, revise, and defer choices.

## Scope Boundary

Lite ALPS records business requirements only. It does not ask for architecture wizards, `C4Container`,
technology stacks, interfaces, storage, deployment, libraries, code structure, Feature IDs,
implementation plans, or ADR handoff.

Lite never reads or updates a Full document, and completing Lite never changes or completes a Full
document. A completed Lite can be the source of a derived Full ALPS
(`alps_document(action: 'init', profile: 'full', project_name, output_path, source_doc_path)`), which converts
each Lite requirement into technical requirements without changing its business meaning. Lite stays the
upper business baseline: business changes are made here and reach a derived Full only through an explicit
re-derivation.

## Optional research after completion

After every required Section is approved and written, check the selected
document with `alps_document(action: 'status', doc_path)`, export it, and ask once whether
the user wants a deep-research review of the ALPS items' evidence and errors.
Unwritten optional Section 7 does not block this invitation. Reuse an explicit
review request or an answered choice in the current conversation. An unanswered
invitation, decline, deferral, or research failure leaves document completion intact.
Start only on request and use the bundled `alps-research` skill: built-in deep
research first, otherwise available web search, with DuckDuckGo MCP when web search
is unavailable or fails. Keep findings read-only until the user approves specific edits.

## Feature organization

Before grouping an existing project, inspect repository organization
(monorepo/multirepo) separately from execution and deployment shape
(monolith/microservices/hybrid); state inaccessible or unknown scope. Organize
requirements by DDD bounded contexts (business meaning and rule ownership), then
vertical user stories from trigger to observable result. Repository/service
boundaries are not automatically business boundaries. Use this grouping by
default; propose grounded candidates and clarify only material ambiguity.
Preserve the profile's existing sections, approval units and diagram levels.
Keep implementation detail and topology inventories outside the product document.
