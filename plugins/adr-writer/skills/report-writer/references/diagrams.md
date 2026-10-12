# Diagrams

Use when choosing, drawing or reviewing figures. Explanation scope and descent
follow [explanation design](explanation-design.md); this module owns figure
selection, source fidelity and rendering guidance.

## Choose views that explain the subject

Include useful figures whenever evidence and delivery format support them.
For a whole-system or multi-step process, prefer an overview after the background
and answer, before component detail. Show purpose, boundaries and essential
relationships; the first top-level node is a useful location in the shared renderer.

Assess visualization at every depth, including leaf sections. A detailed view
should expose the new relationships, conditions, state changes or interactions
of its parent responsibility. An overview elsewhere cannot cover a hidden
mechanism. Keep the outside relationship visible enough to orient the reader,
and connect analogy labels to actual terms before relying on them.

There is no figure quota or requirement for every leaf. Simple facts and one-step
instructions may be clearer in prose. Honor exclusions and format or evidence
limits; explain supported relationships and material limitations in prose when
a figure is not feasible. Never invent participants or calls to fill a diagram.
Missing figures alone never block delivery, including top-down or C4-like requests.

Choose any Mermaid type supported by the bundled engine that answers the question
and honors requested notation: sequence for interaction order, class for
inheritance/composition, state for lifecycle, ER for cardinality, or another
suitable view. Examples are not an allowlist or fixed preference order. Do not
default to boxes, change types merely to satisfy a narrower parser, or require
special justification for a valid notation. Preserve its relationship semantics.

Keep each view beside its explanation, identify which parent element it expands,
and briefly explain what it establishes. Split complex pictures into meaningful
views without fixed depth, empty image-holder sections or file-based organization.
For a worked descent, consult the [request-tracking example](examples/explanation-depth.md).

## Check diagram paths against the source

Read the completed figure on its own before reconciling it with the prose.
For each material action or promised result, compare the paths that can reach it
with the source's conditions, ordering, permissions and failure guarantees.
Sharing an error node also shares its stated outcomes; do not extend diagnostics
or recovery guarantees from one failure condition to another without evidence.
Check both branches of a decision:
the failure of "P and Q" includes different cases. If the source permits an
action only for one of them, a shared failure arrow must not grant it to all.

For example, when a source permits one citation-format repair, a diagram must
not send both invalid JSON and an unsupported citation through one error node
into that repair. Separating the errors in prose does not remove the diagram's
extra path. Split the conditions or narrow the path to the evidenced action,
then check the revised figure and surrounding explanation together.

Also check logical strength: "when P, Q is available" does not establish
"Q is available only when P" without further evidence. Keep report-subject
claims separate from observations about the author's tools or test environment.
Use the actual relevant context to resolve disagreements rather than accepting
or rejecting a passage solely because an automated judge labels it PASS or FAIL.

Repair confirmed in-scope mismatches and repeat the applicable checks on the
latest output. Preserve genuine source gaps; do not complete an unknown path
with an invented action or remove a finding to get a passing result.

## Render and inspect

Keep Mermaid source available. Check syntax with the bundled official parser.
HTML provides a rendered view and inspectable source; Markdown uses a Mermaid
fence; static exports retain source with supporting material. If the engine
cannot express requested notation, use a supported equivalent only when meaning
is preserved and disclose the limitation; otherwise explain in prose.

Review the figure alone, then with its prose. Confirm labels, arrows, reading
order and relationship semantics. For an overview, trace its responsibilities
to the explanations that expand them; for a detail view, confirm it exposes the
new mechanism rather than repeats the overview. Recommend feasible missing views
without failing delivery solely for their absence. A prose caveat cannot repair
an unsupported arrow, and a renderer or LLM PASS cannot overrule that mismatch.

Follow [verification levels](format-and-layout.md#verification-levels) for the
actual checks permitted. A syntax pass or HTML write does not prove rendered
appearance; report failures honestly rather than claiming verification.
For HTML sizing and print behavior, use [HTML layout](html-layout.md).

## Structured renderer

`diagram` has `source` (Mermaid), `explanation`, and optional `required`.
Every node, including a nested leaf, can carry a diagram. Its optional shape is
not a reason to omit a figure that materially helps explain that node. The
one-diagram field is not a figure budget for its domain or the whole report;
when several focused views need different explanations, use meaningfully scoped
child nodes with their own figures, not empty image-holder sections. Preserve the
four-child explanation limit and do not force a figure into a simple node.
The renderer validates syntax with the bundled official Mermaid parser, without
an additional type allowlist. It accepts class, sequence, state, ER, C4 and other
syntax supported by that version. No package installation or network is needed.
`required` controls invalid syntax, not whether a diagram must exist: the default
rejects invalid syntax before writing output; `required: false` retains the full
source and a visible warning. Markdown preserves valid source unchanged.

HTML embeds the official Mermaid engine and renders each diagram in the reader's
browser. Until SVG creation succeeds, the figure is visibly pending with its
source available; failures retain that source and an error. `data-rendered` only
becomes `true` after actual SVG creation. A syntax check or HTML write is not proof
of rendered appearance. Keep actual rendering and semantic review distinct.
Source remains inspectable after success, and authored scripts/callbacks are
inert. Choose syntax for the explanation, not to work around a local subset.
