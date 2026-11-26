---
name: lite-alps-init
description: Bootstrap or resume an eight-section Lite ALPS business-requirements document — evaluable business, functional, non-functional and edge-case requirements with KPIs and tension metrics, no technical requirements — using the same conversational authoring flow as Full ALPS.
argument-hint: "[project-name-or-lite-alps-path]"
---

# lite-alps-init

Every call on an existing document requires `doc_path`: use the document path returned by
init/load for reads, saves, glossary operations, status and export. Pass it even
after loading; no other call selects a default document.

Before grouping requirements, read
`${CLAUDE_PLUGIN_ROOT}/references/feature-boundaries.md`: inspect existing project
topology, then use bounded contexts and vertical user stories by default.

Create or resume a Lite ALPS document that refines business requirements until a technical
author can derive technical requirements without another business question, keeps technology
out, and gives every requirement an observable pass/fail criterion.

Intent bounds the details AI proposes: preserve whose problem is being solved,
the intended outcome, and supplied priorities or scope so plausible proposals
do not drift toward a different purpose. Use the existing Business Context and
optional exclusions; do not add an intent section or invent exclusions. Read the
plugin-local `references/requirement-delegation.md` for missing or delegated
choices and retain the existing Section approval boundary.

Use the Lite overview’s optional glossary rules, including in proposal-led
Sections 2-6 and 8. Resolve unclear terms before approving dependent content,
save their definitions under the current Section approval, and check for missing
definitions before completion.

> **Language**: talk to the user and write the document in the language the user uses. The skill,
> templates, and guides are written in English only as agent instructions.

> **Non-invasive harness**: the saved Lite ALPS document owns durable product
> context. Resume from that document and current sources if working notes are
> missing. Working notes belong only to this task. Interview sequencing,
> tool-call planning, approval views, and model
> orchestration remain disposable. Do not request private chain-of-thought or
> create hidden state required to use the document after plugin removal.

Lite shares Full ALPS's approval and saving boundary. Explain the current Section, reuse supplied
context, present a plain-text approval digest, and save only after explicit approval. Section 1
collects missing business context; Sections 2-6 and 8 start with AI proposals and ask only under
step 7's question rules.

Lite never reads or updates a Full document. Never present Lite completion as Full completion,
implementation readiness, or ADR handoff.

1. Use the user's request to choose a new Lite ALPS document or resume an existing
   `.lite.alps.xml`; ask only when that choice is unclear.
2. Call `alps_document(action: 'init', profile: 'lite', project_name, output_path)` or
   `alps_document(action: 'load', doc_path)`.
   On resume, use the profile detected from the file. For a Full document,
   continue with [alps-init](../alps-init/SKILL.md) if it is the intended target.
   Resolve a conflicting target before saving. A Lite document in another section format is
   rejected unchanged; offer to author a new Lite document using it as reference input.
3. Call `alps_template(action: 'overview', profile: 'lite')`.
4. Select the confirmation mode:
   - Atomic is the default: discuss, approve, and save one Section at a time.
   - Batch is allowed only when the user explicitly requests it or supplies a complete structured
     source covering several Sections.
   - Batch mode still keeps every Section as a separate approval unit and saves each subsection
     separately.
   - Treat a supplied ticket, incident, PDF, earlier Lite document, or structured source as
     ephemeral input. Preserve only the target problem, intent and outcome, business rules,
     observable behavior, quality expectations, edge cases, success criteria, and explicit
     exclusions. Do not copy source IDs, logs, code paths, implementation plans, or
     code-recoverable technology facts into Lite ALPS.
5. Use the authoring order **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**:
   Business Context, Business Requirements, Functional Requirements,
   Non-Functional Requirements, Edge Cases, Success Criteria, Out of Scope, and Demo Scenario.
   - Every Section except Section 7 is required.
   - Section 7 is optional and remains unwritten when the user has no explicit exclusions and the
     approved boundary is not materially ambiguous.
   - After loading, call `alps_document(action: 'status', doc_path)`, summarize completed required
     Sections once, and resume at the first incomplete required Section.
6. For each Section:
   - Call `alps_template(action: 'guide', profile: 'lite', section: N)`.
   - Call `alps_template(action: 'section', profile: 'lite', section: N)`.
   - Read every prerequisite named by the guide with
     `alps_section(action: 'read', doc_path, section: N)`.
   - Briefly explain the Section's purpose.
   - Follow step 7's question and proposal rules. When a question is needed, ask one focused
     question or at most two closely related questions, wait for the answer, and integrate it.
     Otherwise continue with the proposal or optional skip.
   - When the Section is complete, present a concise plain-text approval digest.
   - Save each approved subsection separately with
     `alps_section(action: 'save', doc_path, section, subsection_id, title, content)`.
7. Section scope:
   - **Section 1 — Business Context**: ask for the target user and core problem, then the intent,
     the final outcome, why it matters, and any priorities or scope boundaries. Keep the result in
     `Target User and Core Problem` and `Intent and Desired Outcome`. Preserve a supplied
     measurement signal for Section 6. Never ask here for a solution, screen, technology,
     requirement list, starting state, or demo flow.
   - **Sections 2-6 — requirements**: work backward from the approved Business Context and propose
     the content first. Ask only for missing context that cannot be proposed, an undefined term, or
     a choice that would change money, permissions, law or regulation, privacy or safety,
     irreversible data meaning, an external promise, or the acceptance boundary.
     - Define each identifier once in its owning subsection at the start of a table row, list item,
       or heading: `BR-n` (2.1), `FR-n` (3.1, at least one), `NFR-n` (4.1), `EC-n` (5.1), `KPI-n`
       and adopted `TM-n` (6.1). Keep approved IDs stable; never reuse a deleted ID.
     - Every BR, FR, NFR and EC is Required or Optional and has an observable pass/fail criterion
       with its basis, in user-visible or business-verifiable terms. Every FR has an actor,
       starting situation, business input, applied rules and values with BR IDs, observable result,
       related failure handling, and Given/When/Then acceptance criteria.
     - Record a business-mandated external system, data location or channel as a BR or NFR
       business boundary with its basis; never record replaceable technology.
     - Section 3.2 is exactly one Mermaid `C4Context` Business Context Diagram in business-role
       wording, generated from Sections 1-2 and the 3.1 draft, with no `C4Container`, APIs,
       databases, servers, deployment units, or technology names.
     - Section 6 states release acceptance (every Required BR, FR, NFR and EC passes) and defines
       KPIs by business calculation only. When defining these results, read
       `${CLAUDE_PLUGIN_ROOT}/references/outcome-evaluation.md` and keep its application at Lite
       resolution. Users rarely think of tension metrics, so always propose one for every KPI with
       the abuse or opposite-failure scenario it exposes, and record the decision per KPI: adopted
       `TM-n`, guarding Required IDs, or not adopted. A declined candidate is never a completion
       gate; KPIs and TMs are monitoring unless confirmed as required. Do not add sample design,
       data collection, or instrumentation.
     - When an approved item changes or is deleted, show every later item and demo step that
       references it in the same approval digest.
     - Do not save a Section while an acceptance-changing value or policy remains unresolved; show
       the question and offer to defer.
   - **Section 7 — Out of Scope**: record only exclusions the user explicitly confirms. Do not ask
     for exclusions merely to fill the optional Section. When there are no explicit exclusions and
     the approved boundary is not materially ambiguous, skip it without a dedicated question.
   - **Section 8 — Demo Scenario**: work backward from the approved Sections to propose one
     `8.1 Demo Scenario` that shows every Required FR at least once, with the concrete starting
     state, representative input, sequential user actions, visible expected results, and the FR and
     EC IDs each step shows, including relevant EC counterexamples. Show the complete scenario and
     its FR coverage before approval. The overall result passes only when every shown FR and EC
     criterion passes. Do not present a passing demo as proof of business impact or market validity.
8. The approval digest includes the applicable confirmed intent, scope, requirement IDs with
   Required or Optional, values and rules, pass/fail criteria, affected later items, and unresolved
   questions. Never save a requirement, exclusion, or Demo result absent from the digest. Show the
   full pending content when requested.
   When a proposal or answer relies on an external factual claim or figure — a regulation, a market
   or user figure, or an external service limit — that the document and supplied sources do not
   establish, list it under unresolved questions as an unverified basis and offer to research only
   that item with [alps-research](../alps-research/SKILL.md). It adds no question step: approval
   choices stay available, research starts only on request, an approved basis remains unverified,
   and the completion invitation in step 11 is unchanged. Do not repeat the offer for the same item
   in this conversation, and never make it for a chosen goal or policy or an established fact.
9. Do not add architecture questions or content beyond the required business-wording `C4Context`.
   Never add `C4Container`, technology stacks, interfaces, storage, deployment, libraries, code
   structure, Feature IDs, implementation plans, or ADR handoff steps to Lite.
10. When the requested document work is complete, call `alps_export(doc_path)`.
11. Lite is complete when `alps_document(action: 'status', doc_path)` reports `Completion: ✅ Complete`
    (every required Section written, no duplicate definitions or undefined references). While it
    reports incomplete, relay the `Next steps:` it lists and offer to do the next one. Once it
    reports complete, ask once whether the user wants an optional deep-research review of its
    evidence and errors, and mention once that a completed Lite can be the source of a derived Full ALPS
    (`/alps-init` with this Lite as source) when implementation preparation is needed. Unwritten
    optional Section 7 does not block this. Reuse a review request or an answered choice already
    in the current conversation; an unanswered invitation, decline, or deferral does not start
    research or change completion. If requested, follow [alps-research](../alps-research/SKILL.md)
    for source selection and fallbacks. Apply any resulting edits through the existing Section
    approval boundary.

**Rule**: Lite uses Full ALPS's conversation-led authoring behavior. Do not auto-complete a Section
before asking for missing context or add persona-selection and method-specific interview layers.
No Section is saved without explicit approval.
