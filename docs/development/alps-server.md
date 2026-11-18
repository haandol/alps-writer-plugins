# ALPS server development

The server paths under `src/` are relative to `plugins/alps-writer/`.

## Architecture

**MCP Server** (`src/index.ts`) — Entry point. Creates `McpServer` instance, registers all tools with Zod schemas, connects via `StdioServerTransport`. Tool handlers are thin wrappers that delegate to controllers.

**Controller/Service pattern** — Separates domain-specific controllers (MCP interface) from services (business logic):

- `src/tools/templates/` — Read-only access to ALPS templates and conversation guides
- `src/tools/documents/` — Document CRUD (init, load, save, read, export) with state management

**Document profiles** (`src/profiles.ts`) — Full ALPS and four-section Lite ALPS metadata: section titles, dependency graph, authoring order, optional Sections, file suffix, template/guide paths, and dynamic Feature sections where applicable. Section ranges are derived from each profile. Lite reuses Full's approval and persistence behavior while keeping independent document state and completion. Lite uses `Overview → Solution and Essential User Experiences → Out of Scope → Demo Scenario`; Section 3 is optional and omitted from Markdown when unwritten. Section 1 captures `Desired Business Impact`, Section 2 has AI propose the minimum Solution Strategy with one product-level `C4Context` and the Essential User Experiences, and Section 4 has AI propose the concrete starting state, input, user actions, and visible results that demonstrate every experience.

**Conversation-led authoring** — Full ALPS retains its pre-Lite section-by-section conversation: explain the section, ask one focused question or at most two closely related questions when context is missing, integrate the answer, present a contract-complete approval digest, and save only after confirmation. Lite ALPS keeps the same approval boundary but uses a working-backwards interaction: the user supplies the target problem and Desired Business Impact, while AI proposes Section 2 and the executable Section 4 flow. Lite asks only when a protected product decision cannot be safely proposed. Optional Section 3 skips the question when no explicit exclusion exists and the approved boundary is not materially ambiguous. Shared Lite support must not rewrite Full skills, guides, examples, or wizards.

**XML helpers** (`src/xml.ts`) — `attribute`, `decodeXml`, `escapeXmlAttribute`, `escapeXmlText`, shared by the document and template layers (this project parses XML with regex by design — see the [repository rules](../../AGENTS.md#do-not-rules)). `attribute()` always returns the **decoded** value: an attribute's value is its decoded text, and both callers compare it against plain text.

**Static assets** (read from filesystem at runtime):

- `src/templates/chapters/01-09.xml` — XML section templates
- `src/templates/overview.md` — ALPS overview
- `src/guides/01-09.md` — Per-section conversation guides
- `src/templates/lite/chapters/01-04.xml` — Current Lite ALPS XML templates
- `src/templates/lite/overview.md` — Current Lite ALPS overview
- `src/guides/lite/01-04.md` — Current Lite ALPS conversation guides

**Document format** — Full documents use `.alps.xml`; Lite documents use `.lite.alps.xml` and a `profile="lite"` root attribute. Lite documents must contain the current four Sections and exact titles in order. Both use `<alps-document>`, `<section>`, and `<subsection>` tags and are parsed via regex (no XML parser library). Output directory is controlled by `ALPS_OUTPUT_DIR` (`PRD_OUTPUT_DIR` is also supported for backward compatibility).

**Document selection** — Initialization requires `output_path`. Every request for an existing document requires `doc_path`. The controller creates a request-scoped DocumentService, sharing only template metadata; the service validates that path before the operation. Prior init/load calls never select a default for another request. Existing documents can be read or changed on a fresh connection without an earlier load. Missing/invalid targets and document validation errors return MCP `isError: true`.

**Evidence research** — After Full's nine Sections or Lite's required Sections
1, 2, and 4 are approved and written, offer one optional deep-research review of
the selected document's evidence and errors. Reuse an explicit research request
or answered choice in the current conversation. Unwritten optional Lite Section 3,
a decline, deferral, unanswered invitation, or research failure does not change
completion. `alps-research` prefers an available built-in deep-research capability,
then uses the agent's web search and source reading, falling back to connected
DuckDuckGo MCP when search is unavailable or fails. Discover actual capabilities;
do not configure providers or install a server. Review real document items,
distinguish factual errors and evidence gaps from goals/policies, and connect
findings to verified sources and proposed corrections. Research is read-only;
selected edits use existing approval units and explicit document targets. Keep
research artifacts disposable and retain the existing post-handoff boundary.

**Optional glossary** — Both profiles keep their numbered Sections unchanged and
append a glossary only when qualifying jargon, uncommon terms/acronyms, or
expressions that cannot be written out plainly need confirmed definitions. Ask
for unclear meanings at first use; reuse supplied meanings and the current
Section approval. `alps_glossary(action: 'read', doc_path)` and `alps_glossary(action: 'save', doc_path, term, definition)` operate on the
explicitly selected document. The optional XML glossary follows all Sections, survives later
saves and reloads, and exports last. Never pre-seed a dictionary or add a separate DDD exercise for glossary maintenance.

`/feature-to-adr` transfers needed definitions to `docs/adr/glossary.md` unless a
current reference level such as the business ontology owns the term, in
which case it routes a change proposal to that level; ADR authoring creates or
updates the glossary under the existing approval when needed.
Equivalent meanings are no-ops, unrelated entries are preserved, and conflicting
meanings are resolved before replacement. This file is supporting material at the
ADR level, without Status or mapping registration; contract rules remain in the
owning ADR body. Consumers read it selectively.
