# Review Hiking

Read this reference after the complete implementation scope is fixed and before
the review mode and perspective execution are planned.

Treat the complete review as **Review Hiking**: one or more low **Hills** whose
contracts, implementation evidence, and targeted test results the reader can
review independently before the final verdict is synthesized.

## Build the route

1. Write a shared **Context** with four non-empty parts: `intent`,
   `preconditions`, `contracts`, and `scopeAndRisk`. This is the widest review
   view and contains no component or code detail.
2. Partition the implementation into vertical Hills. Each Hill is exactly one
   `user-flow`, `logical-capability`, or evidence-grounded `bounded-context`.
   Never split a Hill by frontend/backend/data layer, file, module, reviewer
   role, or review lifecycle phase such as discovery/design/implementation/test.
3. Give every Hill a sequential `H1..Hn` id, a subject-specific title, a
   `sliceType`, a plain-language `sliceName`, and one review question. Present
   each Hill as the **Container** reading level. Its `container` has
   `responsibility`, `interactions`, and `outcome`.
4. Give every Hill one or more **Components**. Each Component has sequential
   `C1..Cn`, a name, responsibility, detailed implementation, verification
   result, and one or more Code evidence items.
5. Give every Code evidence item:
   - `kind` — `diff` for changed code or `excerpt` for unchanged implementation;
   - `location` — file and symbol or line;
   - `content` — the focused unified diff or current code excerpt;
   - `explanation` — why this code supports the Component;
   - `tests` — the relevant command and observed result.
     When change scope is non-empty, include at least one `diff` in the complete
     review. Keep full files and unrelated diff lines out.
6. Treat Context, Container, Component, and Code as reading zoom levels.
   Use plain language a junior developer can follow; explain unavoidable terms
   on first use.
7. Assign every `D0` / `R1..Rn` contract row to exactly one Hill. A Hill has at
   least one contract row. Missing, duplicated, unknown, or unassigned contract
   ids make the artifact invalid.
8. Select targeted tests from each Hill's contracts and the relevant
   counterexample that could break the vertical result. Record status,
   implementation evidence, and test results for every assigned coverage row
   before moving to the next Hill.

A local implementation with one coherent vertical capability may have one low
Hill. Multiple user flows, logical capabilities, or bounded contexts must become
multiple Hills. A state or failure path stays with the Hill whose user-visible
or operational result it changes unless it is itself an independently
reviewable vertical capability.

## Preserve review boundaries

Hill sequencing is not a user approval or lifecycle gate. Keep the route and
intermediate Hill state ephemeral in the artifact directory; never
persist them in the ADR, mapping, code, or another registry.

The necessity and sufficiency perspectives derive conclusions independently
from the original ADR, code, tests, change scope, and baseline, and never read
each other's conclusions.
