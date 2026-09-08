---
name: alps-init
description: Bootstrap an ALPS (PRD) document via the alps-writer MCP server. Use when the user invokes /alps-init or asks to start a new ALPS/PRD document or resume an existing .alps.xml. Keywords - "/alps-init", "ALPS 시작", "PRD 작성 시작", "start a new PRD".
disable-model-invocation: true
---

# alps-init

Start authoring an ALPS (PRD).

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the document content in the language the user writes in. Any user-facing phrasing below is a guide, not a literal string.

> **Non-invasive harness**: the saved ALPS document owns durable product
> context. Interview sequencing, tool-call planning, approval views, and model
> orchestration are disposable execution details. Do not request private
> chain-of-thought or persist hidden state that would make the document unusable
> after this plugin is removed.

1. Confirm with the user whether to create a new document or continue an existing `.alps.xml`.
2. Call `mcp__alps-writer__init_alps_document` or `mcp__alps-writer__load_alps_document`.
3. Call `mcp__alps-writer__get_alps_overview` to fetch the authoring guide for all nine sections.
4. Select the confirmation mode:
   - **Atomic is the default**: discuss, present, confirm, and save one section at a time.
   - **Batch is opt-in**: use it only when the user explicitly requests batch authoring or has supplied a complete structured source that covers several sections. State the proposed batch scope once and get approval before drafting it.
   - In batch mode, keep every section or Feature as a separately labeled draft and save each one with its own `save_alps_section` call only after the user approves the batch. The user may approve, reject, or revise individual items.
5. Use the dependency-respecting authoring order **1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9**.
   - For a new document, start at Section 1.
   - After loading an existing document, use the status included in the `load_alps_document` result, summarize the completed sections once, and resume at the first section in that order that is not `✅ Written`.
   - Do not reopen or re-confirm a completed unchanged section unless the user requests a full review or an edited prerequisite requires that section to be revisited.
6. From the selected starting point:
   - `get_alps_section_context(N)` → follow the returned guide and template → ask the user 1-2 questions → show a concise plain-text approval digest and confirm → call `save_alps_section(N, ...)` once per approved `X.n` subsection → move to the next section only once confirmed
   - In batch mode, repeat the Section context step for every included section before drafting, present the sections as separate approval units, and save them separately after approval.
   - Never skip an incomplete section at your own discretion. Even one that looks trivial must be seen and approved by the user before moving on.
   - The digest must remain readable as raw text. Label the approval unit, then show only its purpose/user value, scope and non-goals, mandatory requirements, contract-bearing values and rules with their basis, success or demo outcome, and unresolved questions. End with clear approve, revise, and defer choices.
   - Omit repeated explanations, examples, Markdown-dependent decoration, and implementation detail. Do not name omitted implementation details or add an exclusion list for them. Never save a requirement value, permission, allowed state, transition, ordering, uniqueness, unit, scope boundary, or success condition that was absent from the digest. Show the full pending content when the user requests it.
   - When a ticket, incident, PDF, or other reference is supplied, use it as ephemeral input. Persist only product intent, observable behavior, exact contracts, durable boundaries, success conditions, and explicit non-goals. Do not copy ticket IDs, logs, code paths, implementation plans, or code-recoverable technology facts unless they establish a requirement or durable boundary.
   - **Section 4.1 requires two diagrams:** one Mermaid `C4Context` and one Mermaid `C4Container`. Treat both as required even for a simple system. These are the only C4 levels ALPS permits: never generate Component, Dynamic, Deployment, or Code-level C4 diagrams, and never place modules, classes, functions, files, or methods in the Container diagram.
   - **Section 4.2 stores Architecture Constraints, not a technology inventory:** preserve scale assumptions and mandated platform, provider, data, security, or deployment boundaries that a regenerated implementation must honor. Leave replaceable frameworks, SDKs, ORMs, internal database products, credential plumbing, module layouts, CI tools, and tuning values to code.
7. **Section 7 (Feature-Level Specification)** needs particular care. Review Section 3 and Section 6 first. Write each Feature for a junior developer seeing it for the first time: use plain language, explain unfamiliar acronyms and domain or technical terms on first use, and make the actor, action, conceptual data, and user-visible result clear without requiring code knowledge. When multiple participants or layers make a flow easier to understand visually, recommend a concise Mermaid diagram in `7.x.3`; prefer `sequenceDiagram` for request, data, and response flow across UI, API, data stores, and external systems. The diagram is optional and its absence never blocks approval, saving, or completion. Keep diagrams at product-requirement resolution and out of modules, classes, functions, schemas, libraries, and algorithms. Every Feature's Acceptance Criteria must end with one Demo checkpoint that states the Feature's role in the end-to-end demo and its observable completion result. Do not add a separate demo subsection or repeat the User Flow, edge cases, errors, or acceptance rules. Each Feature `7.x` is one approval and save unit; its internal `7.x.1`-`7.x.6` fields stay together. In atomic mode, confirm and save each incomplete Feature one at a time. In batch mode, one batch approval may cover several separately labeled Features, but never merge their content or persist them with one call. If a Feature's comprehension load is `8/10` or higher, propose up to three independently demonstrable user-behavior splits before approval and always offer keeping the original Feature. The proposal is advisory and never blocks approval or saving. If the user chooses a split, update the matching Section 6 and Section 7 Feature boundaries together; never split by frontend/backend/data layers.
8. Once Section 7 is written, ask the user whether to transfer implementation ownership to ADRs with `/feature-to-adr` (requires the adr-writer plugin). Explain that successful handoff makes the ADR set the implementation authority and leaves the ALPS PRD as a legacy planning document; normal implementation will no longer read it. If they want to write just one decision directly, also point them to `/adr-new <category>`. Both paths presume the adr-writer plugin is installed; if it is not, give the instruction matching the current client — `codex plugin add adr-writer@alps-writer` for Codex, `/plugin install adr-writer@alps-writer` for Claude Code.

**Rule**: atomic confirmation is the default. Batch confirmation requires explicit opt-in or a complete structured source and still preserves separate section/Feature drafts and save calls. Never skip an incomplete unit or save without user confirmation.
