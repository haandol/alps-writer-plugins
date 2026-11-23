# Using the alps-writer MCP server in other clients

Inside Codex or Claude Code, installing the alps-writer plugin wires up the MCP server automatically — nothing to configure. To use the same server in another MCP client (Claude Desktop, Cursor, Kiro, …), point it at the bundled `dist/index.js`. Build it once from source:

```bash
git clone https://github.com/haandol/alps-writer-plugins.git
cd alps-writer-plugins
bun install && bun run build      # produces plugins/alps-writer/dist/index.js
```

Then register the absolute path:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "bun",
      "args": ["/path/to/alps-writer-plugins/plugins/alps-writer/dist/index.js"]
    }
  }
}
```

The bundle inlines its dependencies, so it runs with a plain Bun >= 1.4.2 — no package install in the target location.

## Environment variables

| Variable           | Scope           | Description                                                                                                                                                                      | Default                  |
| ------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `ALPS_OUTPUT_DIR`  | alps-writer MCP | Directory for document files (`.alps.xml`, `.lite.alps.xml`, exported markdown); a relative path given to a tool is resolved inside it. `PRD_OUTPUT_DIR` also accepted (legacy). | `<cwd>/prd/`             |
| `ALPS_ADR_MAPPING` | adr-writer hook | Path (relative to project root) to the ADR mapping file read by the ADR-first hook.                                                                                              | `docs/adr/.mapping.json` |

Config example with `ALPS_OUTPUT_DIR`:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "node",
      "args": ["/path/to/alps-writer-plugins/plugins/alps-writer/dist/index.js"],
      "env": {
        "ALPS_OUTPUT_DIR": "~/Documents/alps"
      }
    }
  }
}
```

## MCP tools

The server exposes five tools. Full and Lite share the same tools; select
`profile: "full"` or `"lite"` for templates and new documents. Existing documents
use their own profile. Tool calls use named JSON arguments.

| Tool            | Actions                                            | Required inputs                                                                                                          |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `alps_template` | `overview`, `sections`, `section`, `full`, `guide` | `action`, `profile`; `section` for `section`/`guide`                                                                     |
| `alps_document` | `init`, `load`, `status`                           | `action`; `profile`, `project_name`, `output_path` for init (Full may add `source_doc_path`); `doc_path` for load/status |
| `alps_section`  | `read`, `save`                                     | `action`, `doc_path`, `section`; also `subsection_id`, `title`, `content` for save                                       |
| `alps_glossary` | `read`, `save`                                     | `action`, `doc_path`; also `term`, `definition` for save                                                                 |
| `alps_export`   | Markdown export                                    | `doc_path`; optional `output_path` writes a file                                                                         |

`alps_template` includes examples only when `include_examples: true` is supplied
for `section` or `full`. Section reads can select `subsection_id`; without it,
they return the whole section. Irrelevant action arguments are rejected.

For example, call `alps_template` with:

```json
{ "action": "section", "profile": "lite", "section": 8, "include_examples": true }
```

The previous per-operation tool names are replaced by these five names. Update
external callers with the action and profile above. Document formats and the
section approval boundary remain unchanged. Each plugin stays within five MCP
tools and ten public skills; ADR Writer and Ontology Writer expose no MCP server.

Document writes are guarded:

- Markdown export rejects an output path pointing to the source document, including links and relative aliases, so the XML remains editable.
- Full documents use `.alps.xml`; Lite documents use `.lite.alps.xml` and declare the Lite profile in the root. A failed `init` or `load` leaves no document selected.
- Existing files are never selected implicitly by initialization; resume them explicitly with `alps_document(action: 'load')`.
- Full ALPS resumes in section order `1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9`; Section 5 is Requirements Summary and Section 6 is Design Specification. A Full document in the earlier order (Section 5 Design, 6 Requirements) is read in the current order without changing the file and rewritten in that order on its first approved save. Lite ALPS resumes in `1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`; Section 7 is optional and every other Section is required.
- Static subsection IDs and titles are validated against the active XML templates during load and save. Full Section 7 accepts one dynamic entry per approved Feature.
- Markdown content is XML-escaped on disk and decoded when read or exported. Saves use an atomic replacement so interrupted writes do not leave a partially written document.
- Section status is based on required template subsection coverage, not content length. Lite Section 7 reports optional and may remain unwritten.
- Markdown export omits an unwritten optional Lite Section 7 while preserving every written Section in document order.
- Lite documents must use the current `Business Context → Business Requirements → Functional Requirements → Non-Functional Requirements → Edge Cases → Success Criteria → Out of Scope → Demo Scenario` format. Other shapes, including the former four-section format, are rejected without modification.
- Lite requirement IDs (`BR-n`, `FR-n`, `NFR-n`, `EC-n`, `KPI-n`, `TM-n`) are defined once in their owning subsection; a duplicate definition is rejected and status reports undefined references. Lite Section 3.2 must contain exactly one `C4Context` and no other C4 level.
- Lite templates never request architecture, technology stack, API, database, deployment, library, or code-structure decisions.
- Full `init` with `source_doc_path` accepts only a completed `.lite.alps.xml`, records it relative to the Full document with a content fingerprint, and never writes the Lite file. Full init and status report the source's absolute `Lite source path:`. Full status then reports Lite coverage, references to undefined Lite IDs, a non-blocking notice when the Lite changed after the last Full save, and an unusable source when the Lite is unreadable or no longer complete. Lite `init` rejects `source_doc_path`.
- An incomplete status lists `Next steps:` with one action per reason, and a rejected Lite source names how to fix it or continue without a source. Export never replaces the ALPS document or its Lite source.
- Lite never reads a Full document. Loading, completing, or exporting a Lite document never changes a Full document.
