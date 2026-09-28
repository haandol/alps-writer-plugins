# Reader-first writing

Use this guide for ADR bodies, decision digests, and human-facing review reports.
It changes presentation, never the underlying contract or evidence.
For human-facing reports, first apply `${CLAUDE_PLUGIN_ROOT}/skills/report-writer/SKILL.md`;
its domain hierarchy and editorial checks own final delivery. ADR source documents
retain their required schema.

## Start from the reader's question

Before drafting, identify:

- the reader and the decision they need to make;
- the intent or problem the artifact must explain;
- the evidence level of each statement: observed fact, supported inference, or proposal.

Connect the concrete problem and intended outcome to the answer before supporting
detail. Keep an urgent finding visible immediately; supply only the context the
reader needs to interpret it. Put prerequisites where they first matter.

For ADRs, apply `authoring-rules.md` "Reading order — intent before detail"
(from the repository's ADR rules, falling back to the plugin templates). Purpose
orients the reader to the problem and direction; the adjacent Decision Drivers
state all currently applicable selection criteria; Decision states the choice,
why it fits, and its exact contract. Keep current rationale in the body even
when it also explains a transition in `decision-log.md`. Keep the required schema.
The Decision Digest follows the same intent-to-choice order before classification
or scoring.

Intent is needed because agents must choose details the document cannot fully
specify. Explain the user's original problem and intended outcome, and preserve
supplied scope and priorities so those choices remain directed toward that
purpose. For ADRs, Purpose and the exact contract bound autonomy. For reports,
explain how a material autonomous choice serves that intent and what evidence
supports the result. A familiar framework or tidy heading order is not evidence
that this judgment context exists.

For example, a **hypothetical** ADR about repeated payments could open Purpose
with: "A customer may retry a payment after losing the response. The same payment
must not be charged twice, so repeated requests need one identifiable result.
The proposed decision associates retries with one payment identity." Decision
then specifies the actual guarantee, its conditions, and failure behavior. This
opening illustrates the purpose; it does not supply an approved contract or
assert that duplicate charges occurred.

## Prefer a causal path to a catalog

When the evidence establishes a user, operator, or system flow, explain:

`starting condition or trigger -> action -> system response -> observable result`

Order the report by importance to the reader. Chronological execution, file
order, and implementation order are optional tools, not the default structure.

If no coherent story exists, lead with the most consequential behavior or
decision, explain why it matters, then supply the mechanism and supporting
detail. Use a list only when independent items are genuinely easier to scan than
a causal explanation.

Never invent an anecdote, project outcome, measurement, causal relationship, or
user reaction. A story must come from the user, ADR, code, tests, configuration,
or another supplied source.

## Review Hiking

For implementation reviews, organize a broad subject as one **Review Hiking**
route with one or more low **Hills**. Use reading zooms: Context for
intent/contracts/scope, Container/Hill for one vertical capability, Component
for detailed implementation, and Code for focused diff or excerpt evidence.

- Use one Hill for one coherent vertical capability.
- Use several Hills when the reader would otherwise hold several user flows,
  logical capabilities, or bounded contexts at once.
- Never name a technical layer, file group, module boundary, or review phase a
  Hill.
- Put the requirement, status, implementation, evidence, and tests next to the
  owning Container/Hill instead of making the reader shuttle between distant
  sections.
- Keep Container language at user, operator, or system-behavior resolution.
  Put detailed mechanisms in Component and actual changed lines or current
  excerpts in collapsed Code evidence.

Use the tree-structured table of contents to navigate Context, Container/Hill,
Component, and Code. Place each required Mermaid in Context or the owning Hill, beside the
request, state, failure, or data relationship it explains. The implementation
review artifact contract defines the trigger and placement checks.

## Remove mechanical writing patterns

Treat these as rewrite signals, not automatic forbidden words:

- repeated contrast templates such as `not A but B`, `A is not X; it is Y`, or
  `more than X`;
- ornamental title-cased English labels used once to make an ordinary idea sound
  like a framework;
- forced `first / second / third` symmetry when a concrete causal flow explains
  the point more naturally;
- generic bridge phrases such as `the key is`, `what matters is`, `from this
perspective`, `ultimately`, or `the direction is clear`;
- a table, diagram, blockquote, heading, or bold sentence that repeats adjacent
  prose without adding a relationship or decision;
- conclusions that sound more certain than the evidence;
- scene-setting, meta-commentary, praise, and repeated summaries that do not
  change the reader's understanding or next action.

Keep established technical terms when they improve precision. Prefer ordinary
language over a new label that appears only once.

## Preserve useful texture

- Use short paragraphs and one main idea per paragraph.
- Keep concrete actors, conditions, values, failures, and trade-offs.
- Explain one verified example far enough for the reader to follow the causal
  link.
- Keep uncertainty when it names a specific unverified premise or limitation.
- Use bold emphasis only for the few claims the reader must retain.

Do not shorten by removing requirement values, permissions, states, failure
guarantees, evidence, or risk. Reader-first writing reduces reconstruction work;
it does not reduce the contract.

## Final pass

Read the artifact once in the reader's order and ask:

1. Can the title and opening alone explain the problem, intended outcome, and answer or proposed direction, with any qualification that changes the claim?
2. Does the most important behavior or decision appear before implementation trivia?
3. Do section openings let the reader choose a narrower question to inspect, and could a causal flow replace a forced list?
4. Does every table or diagram add a relationship rather than repeat prose?
5. Did any statement become more certain, personal, or dramatic than its evidence?
6. Can any repeated contrast, bridge phrase, label, or summary be removed without losing meaning?
