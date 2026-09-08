---
name: lite-alps-init
description: Bootstrap or resume a four-section Lite ALPS document using the same conversational authoring flow as Full ALPS.
argument-hint: "[project-name-or-lite-alps-path]"
---

# lite-alps-init

Create or resume a Lite ALPS document that works backward from a desired business impact to a
minimum PoC and its executable demo.

> **Language**: talk to the user and write the document in the language the user uses. The skill,
> templates, and guides are written in English only as agent instructions.

> **Non-invasive harness**: the saved Lite ALPS document owns durable product
> context. Interview sequencing, tool-call planning, approval views, and model
> orchestration remain disposable. Do not request private chain-of-thought or
> create hidden state required to use the document after plugin removal.

Lite ALPS is a smaller template, not a separate authoring method. Follow the same interaction used
by Full ALPS: explain the current Section, ask one focused question or at most two closely related
questions, integrate the user's answer, present a plain-text approval digest, and save only after
explicit approval.

Lite and Full keep separate document files, state, completion, and export. Never read or update a
Full document while authoring Lite, and never present Lite completion as Full completion or
implementation readiness.

1. Confirm whether to create a new Lite ALPS document or resume an existing `.lite.alps.xml`
   document.
2. Call `mcp__alps-writer__init_lite_alps_document` or
   `mcp__alps-writer__load_alps_document`.
3. Call `mcp__alps-writer__get_lite_alps_overview`.
4. Select the confirmation mode:
   - Atomic is the default: discuss, approve, and save one Section at a time.
   - Batch is allowed only when the user explicitly requests it or supplies a complete structured
     source covering several Sections.
   - Batch mode still keeps every Section as a separate approval unit and saves each subsection
     separately.
   - Treat a supplied ticket, incident, PDF, or structured source as ephemeral input. Preserve only
     the target problem, Desired Business Impact, observable experience, exact product rules,
     success conditions, and explicit exclusions. Do not copy source IDs, logs, code paths,
     implementation plans, or code-recoverable technology facts into Lite ALPS.
5. Use the authoring order **1 → 2 → 3 → 4**.
   - Sections 1, 2, and 4 are required.
   - Section 3 is optional and remains unwritten when the user has no explicit exclusions and the
     approved boundary is not materially ambiguous.
   - After loading, use the status included in the `mcp__alps-writer__load_alps_document` result,
     summarize completed required Sections once, and resume at the first incomplete required
     Section.
6. For each Section:
   - Call `mcp__alps-writer__get_lite_alps_section_context(N)` and follow the returned guide and
     template.
   - Read every prerequisite named by the guide with
     `mcp__alps-writer__read_alps_section`.
   - Briefly explain the Section's purpose.
   - Ask one focused question from the guide, or at most two closely related questions, when
     required context is missing. Section 3 may skip this step under its optional rule.
   - Wait for the user's answer and integrate it into the Section.
   - When the Section is complete, present a concise plain-text approval digest.
   - Save each approved subsection separately with
     `mcp__alps-writer__save_alps_section`.
7. Section scope:
   - **Section 1 — Overview**: ask for the target user and core problem, then the final business
     impact that user should gain and why it matters. Keep the result in
     `Target User and Core Problem` and `Desired Business Impact`. Preserve a measurement signal when
     supplied, but do not ask for a solution, screen, starting state, action sequence, or demo flow.
   - **Section 2 — Solution and Essential User Experiences**: work backward from the approved Desired Business
     Impact and propose the minimum Solution Strategy and every product behavior the PoC must
     demonstrate. End the text Solution Strategy with a `Product Context Diagram` containing exactly
     one Mermaid `C4Context`, generated from the approved Overview and complete Section 2 draft.
     Show the target user, PoC system, relevant external systems, and their relationships at
     product-role level. Keep the text independently reviewable. Never generate `C4Container`, lower
     C4 levels, APIs, databases, deployment units, technology stacks, libraries, code structure, or
     implementation layers. Save the product behaviors as `Essential User Experiences`; each
     experience has a distinct name, user-observable result, and contribution to the Desired
     Business Impact. Do not ask the user to design the solution, starting state, sequential actions,
     screen flow, or system architecture. Ask only when a protected product decision about money,
     permissions, law or regulation, privacy or safety, irreversible data meaning, an external
     promise, or the acceptance boundary cannot be safely proposed.
   - **Section 3 — Out of Scope**: record only exclusions the user explicitly confirms. Do not ask
     for exclusions merely to fill the optional Section. When there are no explicit exclusions and
     the approved boundary is not materially ambiguous, skip it without a dedicated question.
   - **Section 4 — Demo Scenario**: work backward from the Desired Business Impact and approved
     Essential User Experiences to propose one `4.1 Demo Scenario` that demonstrates every experience
     at least once. Propose the concrete starting state, representative demo input, sequential user
     actions, and visible expected results instead of asking the user to supply them. Show the
     complete generated scenario, experience coverage, and business-impact connection before approval.
     Each step or execution block names the experience it demonstrates, and the overall result passes
     only when every essential experience is observable. Ask only when the demo exposes a protected product decision. Do not
     present a passing demo as proof of actual business impact or market validity.
8. The approval digest includes the applicable confirmed intent, scope, mandatory information,
   values and rules, expected result, and unresolved questions. Never save a requirement,
   exclusion, or Demo result absent from the digest. Show the full pending content when requested.
9. Do not add architecture questions or content beyond the required product-level `C4Context`.
   Never add `C4Container`, technology stacks, interfaces, storage, deployment, libraries, code
   structure, NFR wizards, Feature IDs, implementation plans, or ADR handoff steps to Lite.
10. When the requested document work is complete, call
    `mcp__alps-writer__export_alps_markdown`.

**Rule**: Lite uses Full ALPS's conversation-led authoring behavior with fewer Sections. Do not
auto-complete a Section before asking for missing context or add persona-selection and
method-specific interview layers. No Section is saved without explicit approval.
