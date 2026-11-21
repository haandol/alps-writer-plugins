## 2. Compliance contracts and contradictions

Start with the plan's `reviewAdrs` and match each `compliance` entry to its
features and affected obligations. Read a shared ADR once and reuse its sourced
clauses across the matching entries. Record the result for each relation:

- a **hand-off** needs a compliance contract in the ADRs of both the emitting
  step and the reacting step;
- a **policy** needs one in the ADR of each step it starts;
- a **business rule** needs one in the ADR of each system step it reaches.

A compliance contract states, at feature resolution, the inputs the feature
accepts and the events it emits for that relation, rejection and failure
behavior, values and conditions. Then check that no realizing ADR contract —
including context-level ADRs the features follow — contradicts the model's flow,
hand-offs, policies, rules or actor responsibilities: a different event promised
on either side, a contract breaking a rule, a permission that stops the model's
performer from performing its step. Report each gap or contradiction with the
ADR and the model element. Any of them fails the review.

## 3. Execution evidence

Create a run directory under `.adr-review/` following
[review artifact storage](../../report-writer/references/review-artifacts.md).
For every criterion, **write the execution scope into the evidence before
running**: the system steps from its start condition to its business result,
the steps of other processes that emit or react to the events it passes through
(only when that process is `Accepted` or verified together), and each step's real
entry point. Before running anything, read `${CLAUDE_PLUGIN_ROOT}/references/execution-boundary.md`
completely: real entry points run in the repository's local or test environment,
and a criterion only a live environment could show stays unverified.

- Create the start condition, run every in-scope system step through its
  realizing feature's real entry point, and observe the business result.
- Use a double only for an outside organization or system you declare in the
  evidence. A realizing feature replaced by a double, an undeclared double, a
  skipped in-scope step or its result fabricated as data leaves the criterion
  unverified, and so does evidence that executes no realizing feature at all.
  At the test boundary, distinguish the feature handling the business event
  from its external provider. For example, run the actual payment feature; an
  external card provider may supply declared test input. Declaring a stub for
  the payment feature itself still leaves its contract and hand-off unverified.
- An outside-system step may be replaced by giving its result as input; record
  the input.
- For each hand-off with a current counterpart, execute one criterion passing
  through it with both sides. A hand-off whose counterpart is still `Proposed` is
  deferred; it runs in the review that makes that counterpart current.
