# ALPS server development

The server paths under `src/` are relative to `plugins/alps-writer/`.

## Architecture

**MCP Server** (`src/index.ts`) — Entry point. Creates `McpServer` instance, registers all tools with Zod schemas, connects via `StdioServerTransport`. Tool handlers are thin wrappers that delegate to controllers.

**Controller/Service pattern** — Separates domain-specific controllers (MCP interface) from services (business logic):

- `src/tools/templates/` — Read-only access to ALPS templates and conversation guides
- `src/tools/documents/` — Document CRUD (init, load, save, read, export) with state management

**Document profiles** (`src/profiles.ts`) — Full ALPS and eight-section Lite ALPS metadata: section titles, dependency graph, authoring order, optional Sections, file suffix, template/guide paths, dynamic Feature sections, and the Lite subsections that own requirement identifiers. Section ranges are derived from each profile. Lite reuses Full's approval and persistence behavior while keeping independent document state and completion. Lite uses `Business Context → Business Requirements → Functional Requirements → Non-Functional Requirements → Edge Cases → Success Criteria → Out of Scope → Demo Scenario`; Section 7 is optional and omitted from Markdown when unwritten. Section 3.2 holds exactly one business-wording `C4Context` Business Context Diagram, validated on save.

**Requirement identifiers** (`src/tools/documents/requirement-ids.ts`) — Lite defines `BR-n` in 2.1, `FR-n` in 3.1, `NFR-n` in 4.1, `EC-n` in 5.1 and `KPI-n`/`TM-n` in 6.1. A definition starts a table row's first cell, a list item or a heading in its owning subsection, or is a bold heading line (`**FR-1: Title** (Required)`, `**FR-1**: Title`); a bold ID that opens a sentence and every other complete token is a reference (`FR-1` never matches inside `FR-10` or `NFR-1`). Saving a duplicate definition in one owning subsection is rejected unchanged. Lite status lists defined IDs, duplicates and undefined references, and reports `Completion: ✅ Complete` only when every required Section is written and none remain; otherwise it lists `Next steps:` with one action per reason.

**Lite source derivation** — `alps_document(action: 'init', profile: 'full', …, source_doc_path)` accepts only a completed current-format Lite document, creates nothing otherwise, and records `source` (path relative to the Full document) and `source-fingerprint` (SHA-256 of the Lite file) on the Full root. Lite init with a source is rejected. Every Full section or glossary save preserves the source and refreshes the fingerprint when the source is usable. Full init and status report the recorded relative `Lite source:` and the resolved absolute `Lite source path:`. Full status then reports Lite IDs not referenced anywhere in the Full numbered Sections, references to IDs the Lite does not define, a non-blocking notice when the Lite changed after the last Full save, or a source that is unreadable, not current-format Lite, or no longer complete (coverage unverified, document incomplete, fingerprint kept, saves and export still work). A derived Full is complete only when every Section is written and both ID lists are empty; every incomplete status and every rejected source names the next action. Export adds a `> Lite source:` line under the title and refuses an output path that is the ALPS document or its Lite source. Full documents without a source report no Lite results. Lite operations never read Full, and Full operations never write Lite.

**Conversation-led authoring** — Full ALPS retains its pre-Lite section-by-section conversation: explain the section, ask one focused question or at most two closely related questions when context is missing, integrate the answer, present a contract-complete approval digest, and save only after confirmation. With a Lite source, each Full guide's `<lite_source>` block has the author convert the matching Lite Sections without re-asking business questions, keep every Lite value, rule, required flag and KPI/TM definition, and route business-meaning gaps to a Lite change proposal approved in the Lite document. Lite ALPS keeps the same approval boundary but uses a working-backwards interaction: the user supplies the business context, while AI proposes Sections 2-6 and 8 and asks only for missing context, undefined terms or protected decisions. Optional Section 7 skips the question when no explicit exclusion exists and the approved boundary is not materially ambiguous.

**XML helpers** (`src/xml.ts`) — `attribute`, `decodeXml`, `escapeXmlAttribute`, `escapeXmlText`, shared by the document and template layers (this project parses XML with regex by design — see the [repository rules](../../AGENTS.md#do-not-rules)). `attribute()` always returns the **decoded** value: an attribute's value is its decoded text, and both callers compare it against plain text.

**Static assets** (read from filesystem at runtime):

- `src/templates/chapters/01-09.xml` — XML section templates
- `src/templates/overview.md` — ALPS overview
- `src/guides/01-09.md` — Per-section conversation guides
- `src/templates/lite/chapters/01-08.xml` — Current Lite ALPS XML templates
- `src/templates/lite/overview.md` — Current Lite ALPS overview
- `src/guides/lite/01-08.md` — Current Lite ALPS conversation guides

**Document format** — Full documents use `.alps.xml`; Lite documents use `.lite.alps.xml` and a `profile="lite"` root attribute. Lite documents must contain the current eight Sections and exact titles in order. A derived Full root also carries `source` and `source-fingerprint`. Full Section 5 is Requirements Summary and Section 6 is Design Specification; a Full document stored in the earlier order (Section 5 `Design Specification`, Section 6 `Requirements Summary`) is converted in memory on every read, status and export without touching the file, and the next approved section or glossary save rewrites it in the current order. Only that exact title pair converts, and unrecognized content in either section blocks the rewrite. Both use `<alps-document>`, `<section>`, and `<subsection>` tags and are parsed via regex (no XML parser library). Output directory is controlled by `ALPS_OUTPUT_DIR` (`PRD_OUTPUT_DIR` is also supported for backward compatibility).

**Document selection** — Initialization requires `output_path`. Every request for an existing document requires `doc_path`. The controller creates a request-scoped DocumentService, sharing only template metadata; the service validates that path before the operation. Prior init/load calls never select a default for another request. Existing documents can be read or changed on a fresh connection without an earlier load. Missing/invalid targets and document validation errors return MCP `isError: true`.

**Evidence research** — After Full's nine Sections or every required Lite Section
is approved and written, offer one optional deep-research review of
the selected document's evidence and errors. Reuse an explicit research request
or answered choice in the current conversation. Unwritten optional Lite Section 7,
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
