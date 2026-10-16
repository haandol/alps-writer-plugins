# Native implementation review artifacts

Read when normalizing or writing `findings.json` and `implementation-review.md`,
or repairing their validation errors, after evidence synthesis. This module owns
serialization, not verdict selection. [Evidence synthesis](evidence-synthesis.md)
owns clause coverage and [Review Hiking](review-hiking.md) owns Code evidence
kinds and Hill boundaries. Reuse already loaded owners. The
[worked example](artifact-example.md) is optional, not required reading.

## Compact standard presentation

In `standard`, Context may be `{ "summary": "<intent, preconditions, contract, scope and risk>" }`.
Each Hill needs `id`, a behavior-specific `title`, `claim`, `contractIds` and
nonempty direct `codeEvidence` (the same kind/location/content/explanation/tests
fields used by a Component). A short claim can explain a localized capability;
Container, Components, slice metadata and separate workedExample/counterexample/
assessment fields are optional. Relevant counterexample execution remains part
of contract coverage even when its prose has no separate field.

If detailed fields or Components are supplied, validate and preserve them.
Full mode retains the detailed schema below. Both modes reject missing/duplicate
contract assignments, missing code/test evidence, or PASS with an unproven row.
Changed scope still requires an actual diff. Compact standard may omit comparison
and diagram metadata when unused, without omission records. Selected diagrams
and comparisons keep their reference and evidence checks.

Reuse the narrative anchors and generated markers below; the materializer fills
repeated evidence without requiring extra authored paragraphs. For a compact
standard report without selected diagrams, quizzes or human-decision controls,
`adr-impl-review-article.mjs <findings.json> <report.html>` validates the native
artifacts and creates the final shared-report HTML directly. Broader explanation
hierarchies and selected interactions use the rich composition path; never drop
them merely to use the compact renderer.

## Narrative source and generated sections

The source starts with `# ADR implementation review`. Keep these required
anchors in order: `## At a glance`, `## Review mode`, `## Scope`, `## Context`,
the Hill headings, `## Findings`, `## ADR contract coverage`,
`## Notable implementation choices`, `## Tests`, `## Residual risks`.
`## Comprehension check` follows only when included. Write the selected mode,
complete and change scopes, actual test results and residual risks under their
anchors. Each Hill's heading exactly matches its title and includes its review
question before the generated blocks documented below.

Under `## Findings`, keep `<!-- generated review diagnostics from findings.json -->`
for the materializer, followed by the verified findings (or `None.`). Diagnostics
are required even for a finding-free report; they do not replace findings.

For `FIX_REQUIRED` or `BLOCK`, give findings native level-three anchors such as
`### F1. <finding summary>`. The validator counts headings matching
`^### F\d+\.\s+` across the report and requires at least as many as the number
of entries in `findings`; an ordinary `### <summary>` does not count. The check
does not enforce sequential numbers or correspondence to JSON finding IDs.
These verdicts also require `## Repair guide` and the literal labels
`Files and symbols to change:`, `Scope not to touch:`, `Completion criteria:`,
and `Needs confirmation:`. Load [repair guidance](repair-guide.md) for the
content. This conditional validation does not apply to `PASS` or `INCONCLUSIVE`,
including a repair guide added at the user's request.

Under `At a glance` (displayed as Abstract), `ADR contract coverage`, `Notable implementation
choices`, and (only when included) `Comprehension check`, write only:

```html
<!-- generated from findings.json -->
```

The report is the narrative source. The deterministic materializer writes the
Context, Container, Component, Code, each Hill's contract evidence cards, and
the global coverage summary from `findings.json`.

The human-facing order is prose first, evidence second. Related context and each
implementation section read as connected paragraphs that explain trigger or
starting condition, the important action and branch, the system response or
state change, the observable result, and the verification. The validation
section explains which test case covered which behavior and what was observed.
The results and limitations section discusses contract gaps, test gaps, excess
scope, residual risk, and evidence-backed future work. Structured fields and
coverage rows remain complete in JSON and collapsed evidence.

Always serialize `relatedAdrComparisons` as an array with zero to two entries.
Each entry keeps `adr`, `title`, `similarity`, `difference`, `reviewImpact`, and
`evidence`. Candidates must share the target's architectural question,
requirement contract, state/failure rule, or durable boundary; keyword,
technology, file, function, or internal-call similarity is insufficient. The
human report composes each entry into one short paragraph inside related ADR and
change context—never a table, dashboard card, dependency, ownership claim, or
approval item. When the array is empty, provide a non-empty
`relatedAdrComparisonOmissionReason`.

Use the already loaded mapping summaries and dependency/Related links to narrow
candidates. Read at most two candidate bodies, starting with the closest match;
include the second only when it explains a distinct difference. No useful match
means an empty list and a concrete omission reason, not another search pass or
a user question.

## Diagram and evidence fields

Always serialize `diagramRequirements` as an array. Each entry has sequential
`id` (`V1..Vn`), `question`, `diagramType`, `section`, `reason`, and `evidence`.
`reason` explains why the chosen view answers the question. `diagramType` names
the selected Mermaid type; the official parser checks its source without a
separate closed type list. `section` is the exact owning Hill heading or `Context`.
Each report fence has one `%% requirement: Vn` marker and a following `Notice:`
sentence; briefly explain how to read the diagram before the fence.

Every Hill has `diagramIds`. Each ID refers to a diagram in that Hill or in
Context. Context diagrams are linked to their assigned Hills in HTML. Every
diagram is assigned to at least one Hill. If `diagramIds` is empty, that Hill
must have a non-empty `diagramOmissionReason` explaining the prose choice,
user exclusion, or evidence/format limit. Omission is allowed for complex Hills
too and needs no separate approval. Omit this reason
when diagrams are assigned. No global boolean or global omission can substitute
for the Hill's assessment. A shared diagram may serve several Hills only when
it answers their actual visual questions.

Syntax validation uses the bundled official parser; HTML uses the bundled official
browser renderer. Syntax success does not prove SVG creation. Selected diagram
metadata must match the actual supplied figures: dangling, duplicate, unassigned,
misplaced or unsupported selections require repair. If a figure is infeasible,
remove its selection and explain the limitation through the prose and local
omission metadata. Figure presence never gates completion. Source fallback and pending figures must
not be called rendered figures. Semantic review checks whether important
relationships are explained; HTML inspection checks supplied output.

Render findings immediately after the narrative, before detailed evidence.
Group them as `fix`, `decide`, `verify`, and `note` tasks; preserve the
reader-facing synthesis order inside each group. Give every finding a
`contractIds` array linking it to the affected coverage rows; use an empty array
only for a genuinely decision-neutral item.

Every finding has two layers. The model must provide non-empty `category`,
`perspective`, `summary`, `confidence`, `code`, `evidence`, `test`, and
`testResult`, and a `contractIds` array. Keep an applicable ADR quote and concrete
fix or route in the core evidence; do not fabricate a test result or conclusion.
`perspective` is `necessity`, `sufficiency`, or `both`; standard mode findings
use only `sufficiency`. `confidence` is `high`, `medium`, or `low`.
`whyItMatters`, `expectedBehavior`, `observedBehavior`, `requestedChange`,
`editTargets`, and `completionCriteria` are optional precision fields; when
absent, the renderer derives concise defaults from core evidence and linked
contract requirements. Supply these precision fields when that evidence cannot
derive a concrete, supported action, edit target, expected behavior, or future
successful verification condition. Do not invent policy or a repair to fill a
field: if the evidence is insufficient, retain the explicit clarification request.
Current `FAIL` or `NOT RUN` results remain evidence, not completion criteria.
Preserve explicit criteria and valid domain states such as `FAILED` exactly.
The technical layer keeps category, confidence, perspective, ADR quote, exact
code fragment, evidence, test command, and current result. Show the action layer
by default and collapse the technical layer.

Keep ADR contract coverage in structured JSON with `Contract ID`, `Requirement`,
`Status`, `ADR basis`, `How the implementation meets it`, `Evidence`, and
`Tests`. Their JSON keys are `contractId`, `requirement`, `status`, `adrBasis`,
`implementation`, `evidence`, and `tests`, all non-empty strings. `status` is
`PROVEN`, `VIOLATED`, `UNVERIFIED`, or `CONTRADICTED`.
Keep the ADR wording recognizable and never merge distinct source
rows. Within a compound source row, preserve each obligation's separate evidence. `reviewHike.hills[].contractIds` assigns every row to exactly one
Hill. The materializer writes the complete requirement, status, implementation,
evidence, and tests together inside that Hill and writes only contract id,
status, Hill, and requirement in the global coverage summary. The remaining
audit fields stay in JSON and the HTML's collapsed technical evidence.

Treat Context, Container, Component, and Code as report zoom levels. Context contains intent,
preconditions, core contracts, and scope/risk. Each Hill is the Container zoom
and contains responsibility, interactions, and outcome. Components contain
detailed implementation and verification. Code evidence is collapsed by default
and contains focused `diff` or `excerpt` content, location, explanation, and
tests. A non-empty change scope requires at least one `diff` evidence item in the
complete report.

Keep Notable implementation choices in structured JSON with `Selected value or
behavior`, `Code evidence`, `Why it fits the ADR intent`, and `Why it matters`.
Their JSON keys are `choice`, `evidence`, `intentFit`, and `whyItMatters`, all
non-empty strings.
The materializer writes the read-only Markdown table. These rows are below ADR
resolution and do not amend the ADR. If a row would alter the ADR contract or
durable boundary, it must be an `Undecided behavior` finding instead.

Concise means the default human view answers what to do next. Preserve all seven
coverage fields in JSON, but do not force them into seven visible columns or
repeat the same detailed evidence outside its Hill.
Never replace the four-column implementation-choice table with prose.

The HTML is one responsive page with a table of contents and section anchors. It
renders Markdown lists, inline code, fenced `<pre>` code blocks, and supported
Mermaid relationships. Unsupported Mermaid syntax keeps an explicit warning and
source fallback. Each Hill leads with its real flow title and aggregate contract
status; C4/Hiking vocabulary remains secondary metadata. A fully `PROVEN` Hill
keeps its Component, Code, and contract evidence collapsed, while a Hill with
`VIOLATED`, `UNVERIFIED`, or `CONTRADICTED` coverage opens that evidence by
default. Individual non-`PROVEN` coverage stays open and `PROVEN` coverage stays
collapsed. Scope, metrics, and Notable implementation choices also stay
collapsed. It uses the report language for the document `lang` and fixed
interface labels. Ruling controls and feedback export appear only for `Decision
changed in code`, admitted `Undecided behavior`, material `Unverified risk`, and
`Contradiction`.

## Required fields and validation

`title` is an optional human-readable headline. When omitted, the renderer uses
the reviewed document's heading or the localized review label. It does not use
the file path as the headline; the path remains in the collapsed review details.
The following top-level fields are mandatory in both modes, including `PASS`
with zero findings or zero choices. Empty arrays are allowed only as stated.

### Required top-level fields

| Field                   | Shape and meaning                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `language`              | Non-empty report-language string.                                                                          |
| `reviewMode`            | `standard` or `full`.                                                                                      |
| `adr`                   | Non-empty path to the reviewed ADR, readable by the validator.                                             |
| `verdict`               | `PASS`, `FIX_REQUIRED`, `INCONCLUSIVE`, or `BLOCK`, as synthesized.                                        |
| `report`                | Path resolving to this artifact directory's `implementation-review.md`; that relative filename is valid.   |
| `scope`                 | Array of non-empty strings identifying the complete implementation scope; non-empty for `PASS`.            |
| `changeScope`           | Array of non-empty strings identifying the separate change scope; empty when no code changed.              |
| `atAGlance`             | Object with non-empty `impact`, `action`, and `risk`; use `None` only for an axis checked and found empty. |
| `relatedAdrComparisons` | Array of zero to two comparisons under the contract above.                                                 |
| `diagramRequirements`   | Array of selected diagram records; empty only with each Hill's local omission metadata.                    |
| `reviewHike`            | Context and non-empty Hills under the nested contract below.                                               |
| `reviewDiagnostics`     | Object with all three diagnostic entries defined below.                                                    |
| `contractCoverage`      | Non-empty array of the seven-field coverage rows; `D0` always represents the ADR Decision.                 |
| `implementationChoices` | Array of four-field choice records; empty when no notable choices were found.                              |
| `findings`              | Array of evidence-complete findings; empty when none were found.                                           |

`relatedAdrComparisonOmissionReason` is conditionally required when comparisons
are empty and must be omitted when comparisons exist. When a quiz is included,
read [quiz artifacts](quiz-artifact.md) for its optional schema and hidden-answer
behavior. An optional example is not needed to construct these required artifacts.

### Required diagnostics

`reviewDiagnostics` contains `contractCompleteness`, `testSufficiency`, and
`necessity`, each an object with `status`, `assessment`, and `evidence`.
`status` is exactly `CLEAR`, `ISSUE`, or `UNVERIFIED`; `assessment` and `evidence`
are non-empty strings. Explain the selected mode's actual assessment and limits;
standard mode must not invent an independent necessity review. These diagnostics
are distinct from contract-row statuses and the implementation verdict.

### Contract source and nested evidence

For contract IDs, enumerate top-level bullets and table data rows under the
canonical Requirement contract in source order as `R1..Rn`. Set `D0.adrBasis`
to the literal `Decision`. Preserve a bullet verbatim in
`adrBasis`; for a table row, join trimmed source cells with the literal separator `" | "`
(one space on each side of the pipe), excluding the header and separator. Retain both the obligation and its observable evidence.

Apply evidence-synthesis.md's proof coverage within these existing fields.
Source rows and semantic obligations are different counts: preserve every
clause and guarantee, including those outside the extracted requirement list,
under its parent or `D0`. Keep actual code paths, test inputs/assertions/results,
edge applicability and verification limits in the row's evidence and tests.
The human explanation reports code-inspected and test-verified obligations
against the full inventory and names the gaps. Neither a nonempty string nor
schema validation establishes that an assertion detects the contract violation;
that judgment belongs to the evidence review before materialization.

Each `diagramRequirements` entry has a sequential `V1..Vn` id, one review
question, a supported Mermaid type, an owning section, selection reason, and
grounded evidence. An empty list is valid only when every Hill has empty
`diagramIds` and its own concrete `diagramOmissionReason`.

`explanation` is optional. When present it points to a temporary
`explanation.md` whose structure the validator checks; the final
`implementation-review.md` remains responsible for the complete human-facing
narrative.

`reviewHike.context` contains non-empty `intent`, `preconditions`, `contracts`,
and `scopeAndRisk` fields. `reviewHike.hills` is non-empty.
Hill ids are sequential `H1..Hn`; titles are unique and match the corresponding
Markdown `##` headings exactly. Every Hill has one allowed `sliceType`
(`user-flow`, `logical-capability`, or `bounded-context`), one non-empty
`sliceName`, one non-empty `reviewQuestion`, and non-empty `claim`,
`workedExample`, `counterexample`, and `assessment`. Every Hill also has a
`container` with non-empty `responsibility`, `interactions`, and `outcome`,
one or more sequential Components, and one or more contract ids.
Every Component has `id`, non-empty `name`, `responsibility`, `implementation`,
`verification`, and a non-empty `codeEvidence` array. Component ids are sequential
`C1..Cn`, restarting within each Hill. Every Code evidence item
has non-empty `kind`, `location`, `content`, `explanation`, and `tests`;
`content` contains actual code without fenced-code delimiters. A `diff` contains
at least one added or removed line.
Code evidence kinds are `diff` or `excerpt`; a non-empty change scope requires
at least one `diff`. Across all Hills, every `contractCoverage.contractId` appears
exactly once. Technical layers, file groups, modules, and review lifecycle
phases do not define Hill boundaries. `Context` contains
`<!-- generated review context from findings.json -->` and any assigned overall component diagram; each Hill contains
`<!-- generated container zoom from findings.json -->`,
`<!-- generated component zoom from findings.json -->`, and
`<!-- generated hill evidence from findings.json -->` before materialization.

`metrics` and expanded action wording are optional derived views. When supplied,
the validator checks them; when absent, deterministic tooling and coverage/test
evidence provide the display values.

The artifact validator reads the ADR, derives `D0/R1..Rn`, rejects missing or
duplicate IDs, validates an optional explanation artifact when supplied, rejects
missing or reordered report/check sections, rejects
a missing or inconsistent Hill assignment, rejects invalid question counts or exposed answer criteria,
and rejects `PASS` when tests were not executed, a coverage row is not `PROVEN`,
an unverified risk remains, or a blocking finding remains. Count the raw findings each independent
perspective produced before deduplication, count `Unverified risk` entries after
synthesis, and count distinct test or reproduction commands actually executed.
In standard mode the necessity count is zero by definition.

Allowed categories:

- Necessity: `Unnecessary change`, `Simpler alternative`
- Sufficiency: `Spec violation`, `Decision changed in code`, `Undecided behavior`, `Impl-fact mismatch`, `Test gap`
- Shared quality: `Best practice`, `Refactor`
- Verification state: `Unverified risk`, `Contradiction`

The validator checks serialization and declared coverage/diagnostic states. PASS requires CLEAR contract-completeness and test-sufficiency diagnostics. It does not infer test failure, praise or behavioral meaning from words inside prose. The reviewer must establish those states from actual code/assertions/execution evidence and judge feedback meaning before assigning a verdict; a structurally valid self-declaration is not evidence.
