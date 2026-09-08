# Human-facing review reports

Use this guide only when writing the report or chat summary a person will read.
Internal reviewer artifacts keep their evidence-complete formats.

Read `${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely and
apply it with this report-specific guide.

The reader is a junior developer seeing the subject for the first time. Explain it
like a new teammate, not like a child: preserve exact contracts and evidence, but
remove the reconstruction work.

## Choose the report language

Use the language the user explicitly requests or currently uses. If the
conversation does not establish a language, use the target ADR's dominant
language. For a multi-ADR report, use the dominant language across the reviewed
scope.

Apply the selected language to human-facing prose and subject-specific headings.
Keep stable artifact anchors and established technical terms in their original
form when translation would reduce precision. Do not switch languages merely
because the harness prompt is written in English.

## Start with the answer

Lead with `At a glance` before detailed findings or evidence:

- **Verdict** — what the review concluded.
- **Impact** — what a user, operator, or maintainer can observe.
- **Action** — what must happen next, or `None`.
- **Risk** — what remains uncertain or costly, or `None`.

Keep each item to one or two sentences. A reader should understand the outcome
without knowing the rule IDs, file layout, or internal symbol names.

After this summary, preserve the complete evidence required by the owning skill.
Easy wording never permits dropping a requirement value, allowed set, state rule,
permission, mandatory field, ordering rule, unit, finding, unverified axis, test
result, or residual risk.

## Use plain, exact language

- Name the actor and observable behavior: `The checkout API rejects a second
settlement`, not `idempotency is handled`.
- Explain an unavoidable domain or technical term on first use in one short clause.
- Put the user or operational symptom before an internal category or symbol name.
- Use paths, symbols, rule IDs, commands, and quotations in the evidence section,
  not as the first explanation of the result.
- Keep one idea per sentence and one finding per paragraph or list item.

## Visualize relationships the reader would reconstruct

Classify the visual map from the confirmed implementation scope. Mark it
required when any trigger applies:

- three or more participants, processing steps, states, components, or ADRs;
- a system boundary, dependency, or contradiction;
- an asynchronous or cross-system request or event flow;
- a state transition, failure, retry, rollback, or fallback;
- a changed data relationship; or
- a refactor spanning multiple call sites or changing how work moves between them.

Choose the diagram by the review question:

| Question                                                            | Mermaid           |
| ------------------------------------------------------------------- | ----------------- |
| Who calls whom, and in what order?                                  | `sequenceDiagram` |
| Which states and transitions matter?                                | `stateDiagram-v2` |
| Where does the flow branch, fail, retry, or depend on another item? | `flowchart`       |
| Which changed data relationships matter?                            | `erDiagram`       |

Draw only relationships established by the ADR, code, diff, or executed evidence.
Use short behavior labels instead of implementation trivia. After the diagram,
write one sentence beginning with `Notice:` that states the review point.

Record the required/omitted decision and its evidence-based reason in the owning
artifact. When required, the report must include the selected Mermaid type and
one `Notice:` sentence per diagram; omission is a validation failure. Diagrams
may appear in `Visual map` or any subject-specific narrative section, and
multiple diagrams are allowed when they explain different relationships. The prose must remain
independently reviewable when Mermaid does not render. A local one-file PASS or
a single-document PASS may omit a diagram only when the entire relationship is
clear in one or two sentences and the artifact records that reason. Do not add
several diagrams to satisfy a format quota or repeat the same relationship in
several diagram types.

## Remove mechanical writing patterns

Every sentence must contribute a verdict, contract, evidence, impact, action, or
risk. Delete:

- praise, reassurance, and conversational applause;
- scene-setting, throat-clearing, and restating the user's request;
- repeated conclusions, findings, evidence, or diagram narration;
- generic best-practice advice without a project rule, code location, and concrete
  failure or maintenance cost;
- speculative future extensibility and hypothetical work outside the review scope;
- vague instructions such as `improve this`, `handle appropriately`, or `add
necessary tests`;
- empty headings and sections whose only content is `none`, unless the owning
  artifact schema requires the section.

Also rewrite repeated contrast templates, one-off ornamental English labels,
forced numbered symmetry, filler bridges, and visual elements that repeat
adjacent prose. Never invent a user story, project result, measurement, or
causal relationship to make a report feel more narrative.

Prefer the shortest wording that preserves the full contract. Concision is not a
reason to hide evidence or merge independent obligations.

## Review-specific visual emphasis

- **ADR document review** — visualize cross-ADR contradictions, duplication,
  dependencies, or repeated leaks. A single ADR style finding rarely needs a
  diagram.
- **ADR sync** — visualize a changed decision flow, dependency/category movement,
  or unresolved ADR-versus-code branch. Keep semantic diffs in text.
- **Implementation review** — after At a glance and scope, use Context for
  intent, preconditions, contracts, and scope/risk. Then use one
  Container/Hill per vertical user flow, logical capability, or bounded context.
  Inside each Hill, show Component implementation detail and collapsed Code
  evidence containing a focused diff or current excerpt plus tests. These are
  reading zooms. Technical layers, files,
  and review phases never define Hill boundaries. Execution order is optional.
  Put findings after the Hiking route. The standalone HTML keeps `PROVEN` cards, scope, metrics, and
  implementation choices collapsed, opens exceptional cards, links findings to
  the owning Hill and contract IDs, groups them by required human action rather
  than technical category, and preserves importance order inside each group.
  Lead each Hill with the actual flow title and an aggregate status. Keep
  Container/Hiking terminology as secondary metadata. Collapse the Component,
  Code, and contract evidence for a fully proven Hill, and open that evidence
  when any assigned contract needs a fix, verification, or conflict resolution.
  End the report
  with `Comprehension check` containing one to five material free-response
  questions. Keep the check collapsed. Reveal criteria only after answer entry
  and an explicit self-check action, and state that this comparison does not
  make the PR comprehension-ready.

For the default reading path, write prose before structured evidence. Context
and each Hill should read like a concise tutorial or senior review comment:
starting condition → action and branch → system response or state change →
observable result → verification. Do not present Context, Container, or
Component fields as equal-width table-like cards. Keep contract coverage,
implementation choices, and code excerpts available as collapsed evidence after
the reader has the causal model.

- **Implementation refactor** — visualize before/after work flow only when several
  call sites or processing stages are involved. A local rename or extraction does
  not need one.
