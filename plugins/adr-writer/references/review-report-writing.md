# Human-facing review reports

Use this bridge only when composing a selected report or its chat summary.
Read `${CLAUDE_PLUGIN_ROOT}/skills/report-writer/SKILL.md` and the common or
conditional references it selects. Reuse guidance already loaded; do not also
load the ADR-body writing guide merely to repeat its general writing rules.
The common skill owns the opening, domain hierarchy, maximum four peer units,
plain language, mechanical writing patterns, diagrams, layout and delivery.

The owning review controls scope, verdicts, evidence, edit permission and native
schemas. A flat audit export is supporting input, not the final human report.
Keep source artifacts complete while explaining the result as a concise tutorial
or senior review comment for a junior developer seeing the subject for the
first time. Use continuous essay paragraphs before detailed evidence.

## Review-specific context and language

Use the language the user explicitly requests or currently uses. Otherwise use
the target ADR's dominant language, or the dominant language across a multi-ADR
report. Preserve stable anchors and technical terms when translation loses
precision. English harness instructions do not determine the report language.

Lead with the verdict, observable impact, next action and residual risk in the
common report opening. These are required facts, not four mandatory headings.
Keep the most important finding visible. Never lose exact values, allowed
states, permissions, ordering, units, test results, or an unverified axis when
summarizing. Review-only work stays review-only.

## Select the owning explanation contract

- **Document review and sync:** explain the decision, contract, rationale and
  missing or conflicting evidence. Keep document-only limits explicit; sync
  retains its semantic diff and repository/local-execution boundary. Use the
  common diagram guidance when relationships need explanation.
- **Rollup:** clear chains may use contract tables and summaries. Expand into
  candidate-local views only when ownership, partial replacement, cycles or
  reference changes need them. Do not add whole-system discovery for a report.
- **Implementation review:** use
  `${CLAUDE_PLUGIN_ROOT}/skills/adr-impl-review/references/review-hiking.md` for
  Context and the vertical causal flow, and
  `${CLAUDE_PLUGIN_ROOT}/skills/adr-impl-review/references/visualization.md` for
  its native diagram metadata. The implementation artifact contract owns
  serialization and validation; it does not change common report presentation.
  Keep contract proof, findings, limits and any included Comprehension check
  with their owning domain. Never start interactive checks or impose a
  publishing gate without the explicit request/selection that workflow requires.
- **Implementation refactor:** explain the verified before/after behavior and
  the scope of safe changes. Several interacting call sites may benefit from
  a flow diagram; a local rename need not have one.

Related-ADR comparisons belong to workflows that require them. Select at most
two by shared architectural question, contract, state/failure rule or durable
boundary. Explain similarity, difference and review impact; preserve the
structured omission reason when none helps. Similar filenames or technologies
are not a basis for comparison.

General diagram selection, source fidelity, print styling, quiz disclosure and
requested-versus-default verification live in the common report modules. Only
the implementation-review native format requires `Notice:` and its associated
diagram IDs; do not impose that adapter syntax on every kind of report.
