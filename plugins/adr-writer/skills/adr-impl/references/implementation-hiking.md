# Implementation Hiking

Read this reference after the ADR implementation scope is known and before
editing code.

Treat implementation as one or more low vertical **Hills**. A Hill is a
temporary work boundary, not a new approval, lifecycle state, ADR, or registry
entry.

## Build the implementation route

1. Partition the ADR behavior into the smallest coherent vertical units:
   `user-flow`, `logical-capability`, or an evidence-grounded
   `bounded-context`.
2. Never use frontend/backend/data layers, files, modules, or lifecycle phases
   such as planning/coding/testing as Hill boundaries.
3. For each Hill, state:
   - **Preconditions and surrounding context** — starting state, prerequisites,
     neighboring systems, durable boundaries, and the executable validation path,
     data/dependencies/access needed for each required observation;
   - **Core design and contracts** — the ADR decision, requirement rows,
     derived obligations, invariants, and failure guarantees owned by this Hill,
     plus the recorded intent that bounds any unspecified implementation choice;
   - **Implementation** — every UI, API, data, and external-system change needed
     to make the vertical result work;
   - **Verification** — the targeted ideal case, relevant counterexample,
     command, and actual entry-point result required to count the Hill as verified.
     Preserve the given input, evidence and decision rule for each obligation;
     classify missing/failed execution separately from an observed product violation.
     Read the assertions that distinguish compliance from a violation. Connect
     relevant boundary/interaction cases and justified edge exclusions to the
     same obligation. Keep code-inspected and test-verified coverage separate;
     a green test that omits a required assertion leaves this Hill incomplete.
4. Choose order, parallelism or batching from actual dependencies and shared-resource
   conflicts. An independent Hill may become the primary work unit while another
   verifies. A failing or unexecuted core path remains unverified and cannot be
   counted as complete; it does not block unrelated authorized work.
5. After every Hill has implementation evidence and passing targeted tests, run the full project verification and the
   risk-selected implementation review. Reuse the same Hill boundaries in
   Review Hiking when they still reflect the shipping behavior.

A single coherent capability may use one Hill. Use multiple Hills when a reader
or implementer would otherwise need to keep multiple user flows, logical
capabilities, or bounded contexts active at once. Keep a failure or state branch
inside the Hill whose vertical result it changes unless that branch is itself an
independently testable capability.

## Keep the route disposable

Implementation Hill names, order, progress, and intermediate summaries are
ephemeral. Do not persist them in the ADR, `.mapping.json`, code, comments,
Status, or a separate tracker. The lasting evidence remains in the ADR
contract, code, tests, and final implementation review.
