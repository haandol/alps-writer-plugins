# ALPS (PRD) Template

Every document-specific tool requires `doc_path`, using the document path returned
by init/load. Include it on reads, saves, glossary operations, status and export;
there is no active-document fallback.

This document provides a comprehensive framework to capture and validate all essential information required for developing an MVP.

Examples illustrate supplied inputs for a fictional product; they are not defaults
or approved requirements for the current user. Copy no example value, provider,
feature, or future phase without a basis in the current product context and
approval. Before showing a digest, check that each referenced contract keeps its
value, unit, population, condition, and scope across sections.

## Sections

1. Overview - Define the product vision, target users, core problem, solution strategy
2. MVP Goals and Key Metrics - Articulate measurable goals that validate the MVP hypothesis
3. Demo Scenario - Describe the demo scenario showing how key hypotheses can be validated _(references: Section 2)_
4. High-Level Architecture - Provide C4 Context and Container diagrams plus durable Architecture Constraints; exclude implementation technology inventories
5. Requirements Summary - Enumerate all core functional and non-functional requirements
6. Design Specification - Detail the UX and page flow _(references: Section 5)_
7. Feature-Level Specification - Present complete user stories and one Demo outcome for each feature _(references: Sections 3, 5)_
8. MVP Metrics - Detail methods for collecting and analyzing data _(references: Section 2, 5)_
9. Out of Scope - List features deferred for future iterations

> **Authoring order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9, the same as the section numbers.
> Section 5 (Requirements) defines the Feature IDs (F1, F2, …) that Section 6 (Design) and Section 7 (Features) reuse.
> A document written in the earlier order (Section 5 Design, Section 6 Requirements) is shown in this order on load and rewritten in this order on its first approved save, without losing content.

---

## Section Reference Rules

<section-references>
Some sections depend on other sections. Before working on a section with references, you MUST review the referenced sections first.

<reference-map>
- Section 3 (Demo Scenario) → MUST review Section 2 (MVP Goals)
- Section 6 (Design Specification) → MUST review Section 5 (Requirements Summary)
- Section 7 (Feature-Level Specification) → MUST review Section 3 (Demo Scenario) AND Section 5 (Requirements Summary)
- Section 8 (MVP Metrics) → MUST review Section 2 (MVP Goals) AND Section 5.2 (Non-Functional Requirements)
</reference-map>

<mandatory-actions>
1. Call `alps_section(action: 'read', doc_path, section: N)` for each referenced section
2. Summarize key points from referenced sections before asking questions
3. If referenced sections are incomplete, warn user and suggest completing them first
</mandatory-actions>
</section-references>

---

## Lite source derivation

A Full document may derive from a completed Lite ALPS document, the upper business baseline.
Initialize it with `alps_document(action: 'init', profile: 'full', project_name, output_path, source_doc_path)`.
The server accepts only a completed current-format `.lite.alps.xml`, records its path relative to the Full
document and a fingerprint of its content, and never changes the Lite file. A Full document without a
source is never linked later.

When starting a new Full document without a source, offer once in that task to write a Lite document first
or to use an existing completed Lite as the source. If the user declines or does not answer, continue
without a source; the rest of this template applies unchanged.

When the document records a Lite source, each Section guide's `<lite_source>` block applies:

- Read the matching Lite Sections before the Section and propose a converted draft. Do not re-ask what Lite
  already answered; ask directly only about technical-resolution choices.
- Keep every Lite value, unit, rule, permission, required flag, acceptance criterion, KPI and TM calculation
  and required or monitoring use. Add only technical-resolution content: measurement methods, technical
  boundaries, error responses, evaluation methods and technical thresholds that name the Lite ID they serve
  and never accept a result the Lite criterion rejects.
- Never add a business rule, business value, permission or user-visible acceptance criterion without a Lite
  ID. Present a missing, conflicting or ambiguous business meaning as a Lite change proposal naming the
  affected Lite IDs; save it in the Lite document only through that Lite Section's approval, then propose
  updates to already-saved Full units that reference the changed IDs. If the user declines, continue with
  the current Lite meaning. Do not save a Full unit that depends on a pending proposal.
- Mark converted content with `Source requirements:` and the Lite IDs it covers. Required FRs become
  Features (5.1 and 7.x), Required NFRs 5.2 mandatory constraints, Required ECs Feature edge cases, KPIs and
  TMs Sections 2.2 and 8, BRs Feature rules, cases or 4.2 constraints. Optional FRs, NFRs and ECs are
  converted or deferred to Section 9 with their IDs and reasons. Only a BR fully judged by other IDs' cases
  may be marked as needing no technical requirement, and the digest names those IDs.
- `alps_document(action: 'status', doc_path)` reports Lite IDs not referenced in Full and references to IDs the
  Lite does not define. A derived Full is complete only when both lists are empty and every Section is
  written. This coverage does not change Feature-level handoff to ADRs, and handoff never carries Lite paths,
  Lite IDs or `Source requirements` markers into ADRs.
- When status reports that the Lite source changed since the last Full save, offer one explicit
  re-derivation. Re-derive only on the user's request: compare the current Lite with the Full document,
  change nothing when the meaning is the same, propose updates for changed or added Lite requirements through
  the existing approval units, and never delete Full content for a removed Lite requirement without the
  user's choice. The notice does not block completion.
- Read Lite with the absolute path status reports as `Lite source path:`; the recorded `Lite source:` is
  relative to the Full document.
- When a Lite NFR leaves its population or observation condition undefined, do not define it in Full; ask
  it as a Lite change proposal. Propose a tension candidate only for a KPI whose Lite row records no tension
  decision.
- If status reports the Lite source as unavailable or incomplete, Lite coverage is unverified and the document
  is not complete; resume, saves and export still work. Never stop at the blocked state: relay the
  `Next steps:` status lists, such as restoring the completed Lite at the reported path or completing the
  Lite through its own Section approval, and offer to do that next.

---

## Conversation Guide

### Optional glossary appendix

Keep the numbered sections and their authoring order unchanged. When the user uses
jargon, an uncommon term or acronym, or an expression that cannot be written out
plainly, require a clear meaning in this document. Reuse an explanation already
supplied by the user; otherwise ask at first use and wait before finalizing content
that depends on it. Expanding an acronym is insufficient when its product meaning
remains ambiguous. Never substitute an inferred definition for the user's meaning.

Use `alps_glossary(action: 'read', doc_path)` to reuse existing definitions. Include new or changed
definitions in the current section's approval digest, then call
`alps_glossary(action: 'save', doc_path, term, definition)` for each confirmed entry. Do not add a
separate approval, initial terminology interview, or final glossary-writing stage.
If a definition conflicts with an existing meaning, resolve it with the user before
updating the definition and affected content.

The appendix contains only the term and its meaning in this document. It appears
after all numbered sections only when needed; ordinary-language documents have no
glossary or empty placeholder. Its presence is optional, but defining a qualifying
term is mandatory. Before completion, check that all qualifying terms have clear,
consistent definitions. Do not require DDD or domain classification for glossary maintenance. Keep short
first-use explanations and all requirement rules in their owning body sections.

<communication>
<section-tracking>
- Start each message with "Section" and its number (e.g., `## Section 1. Overview`).
</section-tracking>

<conversation-style>
- Ask ONE or at most TWO focused questions at a time. For complex topics, ask exactly ONE.
- Explain the purpose of each section before asking questions (1-2 sentences).
- Wait for the user's answer when a question is needed, and for approval before saving.
- Use numbered lists for decision points.
- Avoid code examples unless explicitly requested.
</conversation-style>

<emoji-usage>
- Use emojis purposefully, max 2 per section.
- Place emojis at the end of statements, not beginning or middle.
</emoji-usage>
</communication>

<conversation-flow>
For EVERY section:
1. Call `alps_template(action: 'guide', profile: 'full', section: N)` before writing
2. Briefly explain section purpose (1-2 sentences)
3. Reuse supplied context and ask 1 (max 2) focused questions only for information still missing
4. Integrate answers iteratively
5. When complete, present a concise plain-text approval digest and ask for confirmation
6. Call `alps_section(action: 'save', doc_path, section, subsection_id, title, content)` — one call per X.n subsection — only AFTER explicit "yes". `subsection_id` and `title` MUST match the `<subsection id="N.x" title="...">` in that section's XML template.
7. Move to the next section only after confirmation, in the numeric authoring order above.

<section-level-checkpoint>
Atomic confirmation happens at the SECTION level by default. Batch confirmation is allowed only after explicit user opt-in or when a complete structured source covers several sections. In either mode, never silently skip a section; present every section as a separate approval unit.
</section-level-checkpoint>

<approval-digest>
The approval view is a disposable reading aid, not the stored document.

- Keep it readable as raw text without relying on rendered Markdown. Use short labels and lists; do not use tables, checkbox syntax, or decorative headings as the only structure.
- Name the approval unit, then include only: purpose/user value, scope and non-goals, mandatory requirements, every contract-bearing value or rule with its basis, success or Demo outcome, and unresolved questions.
- Contract-bearing information includes numeric values and units, allowed value sets, mandatory inputs, permissions and visibility, ordering and uniqueness, allowed or forbidden transitions, scope boundaries, and success conditions.
- Omit repeated explanations, examples, Markdown decoration, and implementation detail. Do not name omitted implementation details or add an exclusion list for them.
- Never save a requirement contract that was absent from the digest. The stored prose may expand explanation, but it may not add or change a requirement, scope boundary, or success condition the user did not see.
- When an approval unit relies on an external factual claim or figure (a regulation, a market or user figure, an external service limit) that the document and supplied sources do not establish, list it under the digest's unresolved questions as an unverified basis and offer research for that item only. This adds no question step: approve, revise and defer stay available, research starts only on request, an approved basis stays unverified, the offer is not repeated for the same item in the conversation, and the post-completion invitation is unchanged. Make no offer for a chosen goal or policy or an already established fact.
- End with clear choices to approve, revise a named item, or defer. Show the full pending content when the user requests it.
  </approval-digest>

<confirmation-required-sections>
Every section requires confirmation (see the section-level checkpoint above). These need EXTRA-strict, non-skippable confirmation:
- Section 3. Demo Scenario
- Section 5. Requirements Summary
- Every Feature `7.x` of Section 7 (separate approval/save unit; atomic by default)
</confirmation-required-sections>

<section-7-rule>
Section 7 (Feature-Level Specification) is the most common place to cut corners.
- Atomic mode: present, confirm, and save one Feature before moving to the next.
- Batch mode: present multiple Features only as separately labeled approval units, then save each approved Feature with a separate call.
- A Feature `7.x` is the approval and save unit. Its `7.x.1`-`7.x.6` fields stay together.
- If a Feature's comprehension load is 8/10 or higher, propose up to three independently demonstrable user-behavior splits before approval and include the option to keep the original Feature. The proposal never blocks approval or saving.
- If the user chooses a split, update the corresponding Section 5 and Section 7 Feature boundaries together. Never split by frontend/backend/data layers.
- Never skip a Feature because it "looks small", "looks similar to a previous one", or "can be inferred". Each Feature is a separate vertical slice.
- Write each Feature so a junior developer seeing it for the first time can identify the actor, action, conceptual data, and user-visible result. Explain unfamiliar acronyms and domain or technical terms on first use.
- When multiple participants or layers make a flow easier to understand visually, recommend a concise Mermaid diagram in `7.x.3`; prefer `sequenceDiagram` for request, data, and response flow across UI, API, data stores, and external systems.
- Feature diagrams are optional. Their absence never blocks approval, saving, or completion. Keep them at product-requirement resolution and exclude modules, classes, functions, schemas, libraries, and algorithms.
- Evaluation Rubric uses Ideal Cases, Edge Cases and Automated Evaluation Metrics; connect case evidence to calculations and pair each eval metric with an always-proposed tension metric whose adoption the user decides.
- Every Feature's Evaluation Rubric ends with one Demo outcome that states its role in the Section 3 end-to-end demo and its observable completion result.
</section-7-rule>
</conversation-flow>

<change-requests>
When user asks to edit/update/modify/remove/add anything:
1. Show only the modified approval digest with a `v{n}` DISPLAY marker (e.g., `[1.1 Purpose v2]`). This marker is a conversational diff cue only — it is NEVER persisted.
2. Include short change-log (1-3 bullets)
3. Ask a follow-up question only for missing context or an unresolved decision; otherwise present the modified digest for approval
4. Do NOT repeat the entire section digest unless requested
5. After approval, call `alps_section(action: 'save', doc_path, section, subsection_id, title, content)` with the ORIGINAL title (e.g., `Purpose`, no `v2`) and the SAME `subsection_id` so it overwrites in place, then continue in the authoring order without a second permission question for that approved unit
</change-requests>

<reference-document-handling>
When user provides PDF, ALPS (PRD), or any reference:
1. Say: "I'll use this as reference. We can confirm sections one at a time, or use batch confirmation if the source is complete."
2. Treat the source as ephemeral input. Persist only product intent, observable behavior, exact requirement contracts, durable boundaries, success conditions, and explicit non-goals at the Section that owns them.
3. Do not copy ticket IDs, logs, code paths, implementation plans, framework or library names, current internal structure, or other facts recoverable from code unless they establish a requirement or durable boundary.
4. For each missing contract or protected decision: show what the source establishes, then ask the user to confirm or modify only the gap.
5. Never save generated sections without confirmation; batch generation still requires separately reviewable units.
</reference-document-handling>

<rules>
- NEVER write section without calling alps_template(action: 'guide', profile: 'full', section: N) first
- NEVER proceed without explicit user confirmation
- ALWAYS confirm at the section level — never skip a section without the user approving it
- Batch confirmation requires explicit opt-in or a complete structured source
- For Section 7, ALWAYS preserve each Feature subsection (7.x) as a separate approval and save unit
- For Section 7, ALWAYS review Sections 3 and 5 first and include one Demo outcome under every Feature's Evaluation Rubric; do not add a duplicate demo subsection
- For Section 7, ALWAYS use first-reader-friendly language and recommend an optional Mermaid diagram when it materially clarifies a multi-participant or multi-layer flow; prefer `sequenceDiagram` for data flow and never treat the diagram as a completion requirement
- When information is missing, ask 1-2 questions at a time (1 for complex topics); do not re-ask information already provided
- When saving, ALWAYS call `alps_section(action: 'save', doc_path, section, subsection_id, title, content)` with action and all five content arguments; `subsection_id` and `title` must match the section's XML template
- In Section 4.1, ALWAYS include both Mermaid `C4Context` and `C4Container` diagrams. These are the only C4 levels allowed; never generate Component, Dynamic, Deployment, or Code-level C4 diagrams.
- In Section 4.2, record only Architecture Constraints that regenerated implementations must preserve. Never persist a replaceable technology inventory.
</rules>

## Optional research after completion

After all nine Sections are approved and written — and, for a derived Full document, the
status Completion line is complete — check the selected document with
`alps_document(action: 'status', doc_path)`, export it, and ask once whether the user wants
a deep-research review of the ALPS items' evidence and errors. Reuse an explicit
review request or an answered choice in the current conversation. An unanswered
invitation, decline, deferral, or research failure leaves document completion intact.
Start only on request and use the bundled `alps-research` skill: built-in deep
research first, otherwise available web search, with DuckDuckGo MCP when web search
is unavailable or fails. Keep findings read-only until the user approves specific edits.

## Feature organization

Before grouping an existing project, inspect repository organization
(monorepo/multirepo) separately from execution and deployment shape
(monolith/microservices/hybrid); state inaccessible or unknown scope. Organize
features by DDD bounded contexts (business meaning and rule ownership), then
vertical user stories from trigger to observable result. Repository/service
boundaries are not automatically business boundaries. Use this grouping by
default; propose grounded candidates and clarify only material ambiguity.
Preserve the profile's existing sections, approval units and diagram levels.
Keep implementation detail and topology inventories outside the product document.
