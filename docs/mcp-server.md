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

| Tool            | Actions                                            | Required inputs                                                                         |
| --------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `alps_template` | `overview`, `sections`, `section`, `full`, `guide` | `action`, `profile`; `section` for `section`/`guide`                                    |
| `alps_document` | `init`, `load`, `status`                           | `action`; `profile`, `project_name`, `output_path` for init; `doc_path` for load/status |
| `alps_section`  | `read`, `save`                                     | `action`, `doc_path`, `section`; also `subsection_id`, `title`, `content` for save      |
| `alps_glossary` | `read`, `save`                                     | `action`, `doc_path`; also `term`, `definition` for save                                |
| `alps_export`   | Markdown export                                    | `doc_path`; optional `output_path` writes a file                                        |

`alps_template` includes examples only when `include_examples: true` is supplied
for `section` or `full`. Section reads can select `subsection_id`; without it,
they return the whole section. Irrelevant action arguments are rejected.

For example, call `alps_template` with:

```json
{ "action": "section", "profile": "lite", "section": 4, "include_examples": true }
```

The previous per-operation tool names are replaced by these five names. Update
external callers with the action and profile above. Document formats and the
section approval boundary remain unchanged. Each plugin stays within five MCP
tools and ten public skills; ADR Writer and Ontology Writer expose no MCP server.

Document writes are guarded:

- Markdown export rejects an output path pointing to the source document, including links and relative aliases, so the XML remains editable.
- Full documents use `.alps.xml`; Lite documents use `.lite.alps.xml` and declare the Lite profile in the root. A failed `init` or `load` leaves no document selected.
- Existing files are never selected implicitly by initialization; resume them explicitly with `alps_document(action: 'load')`.
- Full ALPS resumes in dependency order `1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9`. Lite ALPS resumes in `1 → 2 → 3 → 4`; Section 3 is optional and Section 4 is required.
- Static subsection IDs and titles are validated against the active XML templates during load and save. Full Section 7 accepts one dynamic entry per approved Feature.
- Markdown content is XML-escaped on disk and decoded when read or exported. Saves use an atomic replacement so interrupted writes do not leave a partially written document.
- Section status is based on required template subsection coverage, not content length. Lite Section 3 reports optional and may remain unwritten; Section 4 requires one `4.1 Demo Scenario`.
- Markdown export omits an unwritten optional Lite Section 3 while preserving every written Section in document order.
- Lite documents must use the current `Overview → Solution and Essential User Experiences → Out of Scope → Demo Scenario` format. Other four-section shapes and former eight-section documents are rejected without modification.
- Lite Section 1 records `Desired Business Impact`; Section 2 proposes the minimum solution and Essential User Experiences; Section 4 proposes the concrete starting state, input, actions, and visible results.
- Lite templates never request architecture, technology stack, API, database, deployment, library, or code-structure decisions.
- Lite and Full ALPS have separate authoring and management state. Loading, completing, or exporting one never reads or changes the other.
