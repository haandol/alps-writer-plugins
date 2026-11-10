# Propose and review business candidates

Read before building a new or extended candidate graph and its report. Establish
the requested sources and whole-scope EventStorming map first; preserve the
source and scope rules from the entry skill. This stage does not save the model.

## Candidates and provenance

Construct ontology knowledge in layers. Read
`${CLAUDE_PLUGIN_ROOT}/references/knowledge-layers.md`: first author BC-only
responsibility, core logic and collaboration knowledge, then the heavier
internal workflows connected to each BC. The upper layer must stay small enough
to read as a whole; internal knowledge is retrieved selectively. Preserve the
existing evidence and approval boundaries for both layers.

Work in a disposable run directory under `.adr-review/` following
[review artifact storage](../../report-writer/references/review-artifacts.md).
Record the candidates in one `<run>/candidates.json` and generate the draft,
board, index draft, question file and review summary from it with
[candidate artifacts](candidates.md); do not write project-specific
scripts for them.

- Candidates are the facts the model owns: flows, event hand-offs and policies,
  actor responsibilities, rules across steps, business concepts and terms,
  bounded contexts, observation criteria. Reaction conditions and rules keep
  their meaning only.
- State machines, transition conditions, exact values, decision details and
  anything the vocabulary cannot express are **not held in the model**: list
  them with their sources. Ask whether ADR-level items should go to ADR
  authoring; a transferred item becomes an update candidate for the realizing
  ADR of its step, a realizing candidate for a system step without one, or a
  context-level ADR candidate for a state machine or value several features
  decide together.
- Give every candidate element and relation its source location (or the fact
  that none was found) and a **source verdict**: stated (a document says it
  directly), inferred (derived from several statements or context), conflicting
  (documents disagree) or unconfirmed (no supporting statement). An input's own
  inferred or unconfirmed mark stays so; its confirmed mark never replaces the
  user's confirmation; an input that names its original source gives that
  location.
- Name each new candidate from its business meaning, never from a sequence
  number or the order documents list it in: a step or concept by what it is
  (`<context>.<meaning>`), a policy by its trigger and reaction
  (`<context>.on-<event>-<action>`), a rule by what it constrains and requires.
  Reorganized or added documents then keep the same ids, and an element that
  already exists keeps its id.
- Mark candidates that come from planned rather than current business; the user
  chooses which to adopt.
- For each rule and policy, propose a basis kind (`regulation`, `contract`,
  `operating-policy`, `user-decision`) and a short basis sentence; a candidate
  without a found basis is marked and gets a basis question.
- When a candidate concept or context term is already defined in
  `docs/adr/glossary.md`, show that definition; a different meaning becomes a
  question.

## Sufficiency and unresolved questions

Apply `${CLAUDE_PLUGIN_ROOT}/references/workflow-readiness.md` to the proposed
scope. Separate business-model sufficiency, ADR contract readiness and execution
evidence; this build does not establish execution success.

- Judge four axes — start, end and normal flow; performers and rules;
  exceptions, rejections and hand-offs; evidence conflicts — as sufficient,
  insufficient or unconfirmed, with reasons. The first three are the coverage a
  process's open scope records: an insufficient or unconfirmed one becomes a
  question or an open-scope candidate. Evidence conflicts are judged for the
  report only: each becomes a question, never open scope.
- Check the candidate graph against the model's required attributes,
  memberships and minimum connections: criteria, performers, reaction
  conditions, a policy's trigger and started step, a rule's target and its reach
  of two or more steps, rule and policy bases, and that a rule relying on another
  feature's state reaches the step changing it. Turn what documents cannot fill
  into candidates or questions in the same report, so a confirmed scope never
  fails validation for a missing item.
- Run the construction layer check through `impact --require-layers`, scoped
  with `--layer-context <id>` for a partial extension. Resolve missing upper
  knowledge as candidates or questions; do not report the requested knowledge
  layers complete while those gaps remain. Pass the same scope to `apply`.
- Absence from the documents is never absence from the business; it stays a
  question or open scope.
- After drafting the questions, try to answer each one again from the
  repository before asking: documents, ADRs and their decision logs, and the
  harness (agent instructions, skills, hooks, contracts, tests and evaluations).
  A question is resolved only when a current authority states the answer — a
  newer or `Accepted` decision, or one that explicitly replaces the earlier
  statement. Show a resolved question as resolved, with its sources, instead of
  asking it; the user can still answer it, and that answer wins. Ask only what no
  source answers, what sources of equal authority still contradict, and what
  needs a choice of business intent. Code alone shows observed behavior and never
  resolves a question. A resolved answer is evidence, not the user's confirmation
  of the candidate it settles.

## One report

When a model exists, prepare its semantic diff in a draft
(`bun ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs impact --draft <draft> --json`).
Start the draft from a copy of every current model document — copies, never
links (`cp -RL`, or write the text) — then add the candidates; never compare or save a draft holding only candidates, because every
current element it lacks would count as removed. Never propose deleting a
current element the documents do not cover; a deletion candidate arises only
when a document states the retirement or change. When ADRs exist, prepare
feature-to-step link candidates with reasons, including features with an empty
`realizes` record. After finishing everything that can be prepared
independently, present one report grouped by bounded context: candidates with
sources and verdicts, the four axes' verdicts with their reasons, conflicts,
not-held content, the diff, link candidates and questions, each with an
identifier the user can answer by. Open that report with the whole-scope event
map and its evidence limits, then boundary and subdomain candidates with reasons,
before the context-level model details. Render the event map with
`${CLAUDE_PLUGIN_ROOT}/references/eventstorming-board.md`: show entity changes
as EventStorming cards, with sources and unknown before/after conditions, and
link that disposable board from the report. A Mermaid diagram does not replace
the EventStorming result.
