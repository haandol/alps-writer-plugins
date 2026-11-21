# Detailed sufficiency handoff

Use for full review or an explicitly detailed presentation. Use the shared contract rows and evidence classifications from the sufficiency role.

For each Hill (expand the zooms only when supplied or required by full mode):

1. Restate its one review question.
2. Verify the Container responsibility, interactions, and outcome; then verify
   every Component's detailed implementation, verification result, and focused
   Code evidence.
3. Select the relevant counterexample that could break the vertical result.
4. Execute the linked targeted tests or a non-destructive reproduction within
   `${CLAUDE_PLUGIN_ROOT}/references/execution-boundary.md`; read it completely before the first execution.
5. Account for every contract id assigned to the Hill before the final verdict.

```
## ADR Impl Review: <ADR path>

### Verdict
PASS | FIX_REQUIRED | INCONCLUSIVE | BLOCK

### Scope
- ADR: <path> (Status: <Proposed|Accepted ...>)
- Code scope reviewed: <folder/file list>
- Project conventions: <documents referenced, or "none">
- Decision ledger: <N obligations — M implementation-supported / K unresolved; code-inspected and test-verified counts separately> — confirmed missing/different behavior is `[Spec violation]`; unconfirmed scope or execution is `UNVERIFIED`, never an observed violation. PASS requires 0 unresolved

### Findings
- [Spec violation] <short diagnosis> (confidence: high|medium|low) — ADR decision: "<one-line quote>" ↔ code: <file:line + the real code fragment (or "no such code")>
  Evidence: <comparison or reproduction basis>
  Test: <command run, or proposed>
  Test result: <PASS|FAIL|NOT RUN + what was observed>
  Fix: <one line — what to do to the code>
- [Decision changed in code] <diagnosis> — ADR: "<...>" ↔ code: <file:line + fragment>
  Branch: update the ADR vs revert the code — user decision needed. An ADR update here is major, so it also takes one decision-log line; the edit itself belongs to `/adr-impl` or `/adr-sync` (supersede via `/adr-new` only if the topic forked)
- [Undecided behavior] <diagnosis — what ADR-worthy behavior the code adds without a decision, and why it passes the admission gate> — code: <file:line + fragment>
  Branch: add the decision to the ADR (in place via `/adr-impl`/`/adr-sync`, or a new ADR via `/adr-new`) vs remove it from the code — user decision needed
- [Impl-fact mismatch] <diagnosis> — ADR table/enum ↔ what exists in code: <file:line>
  Route: /adr-sync <category> (remove stale code-level detail; correct only an admitted public/architectural contract)
- [Best practice] <diagnosis> — basis: <AGENTS.md item or sibling-code practice> — code: <file:line> (weight: now|next-cycle)
  Fix: <one line>
- [Refactor] <diagnosis — which code hurts and why> (weight: now|next-cycle · impact: low-effort/high-payoff etc.)
- [Test gap] <which decision is unverified> (weight: now|next-cycle · impact: ...)
- [Unverified risk] <concrete failure hypothesis or externally checkable premise> (confidence: low|medium)
  Impact if false: <ADR contract row or safety property that could fail>
  Evidence missing: <why it could not be verified and what verification is needed>

### Notable implementation choices

Check material choices for unstated details against the recorded Purpose as well
as the explicit contract. A conventional or well-tested choice can still defeat
the user's intended outcome. Explain that mismatch with an observable effect;
do not demand approval merely because several suitable implementations exist.
Intent cannot justify a new protected policy or expanded scope. If the purpose
does not resolve a material product choice, report the actual ambiguity.

| Selected value or behavior | Code evidence | Why it fits the ADR intent | Why it matters |
| -------------------------- | ------------- | -------------------------- | -------------- |

Include only choices that remain below ADR resolution after applying the admission gate. Write `none found` when no material implementation choice exists.

### Contract coverage

| Requirement | Status | ADR basis | How the implementation meets it | Evidence | Tests |
| ----------- | ------ | --------- | ------------------------------- | -------- | ----- |

Use exactly `PROVEN`, `VIOLATED`, `UNVERIFIED`, or `CONTRADICTED`. Include every independent decision-ledger row. PASS requires every row to be `PROVEN`.

Preserve parent IDs when a source row contains several clauses. Show each
clause's proof obligation, enforcing path, actual test assertions/results and
related edge coverage within the parent's evidence. Reconcile obligations from
the rest of the ADR with the ledger; source-row counts alone are insufficient.

### Review Hiking

- Context
  - intent: `<ADR intent and adopted direction>`
  - preconditions: `<shared conditions and surrounding systems>`
  - contracts: `<core contract baseline>`
  - scopeAndRisk: `<review scope and material uncertainty>`
- H1 `<title>` — Container slice: `<type / name>` — question: `<one review question>` — contracts: `<D0, R1...>`
  - responsibility/interactions/outcome: `<Container-level behavior>`
  - Components: `<C1..Cn detailed implementation and verification>`
  - Code: `<focused diff or excerpt, location, explanation, tests>`

### Tests executed
- `<command>` → PASS|FAIL|NOT RUN — <key result>

### Notes
- Derived obligations: <parent contract → implication and basis; omit if none>
- Auto-resolved domain defaults: <choice → project/domain basis; omit if none>
- Decision request: <gap; recommendation + basis; 2-3 alternatives; impact; exact ADR wording; omit if none>
```

Verdict criteria:

- `PASS`: **every contract-coverage row is `PROVEN`**, the required targeted tests ran and passed, and there is no evidence-backed must-fix. This is not proof of sufficiency — it is a finding that no counterexample was found.
- `FIX_REQUIRED`: at least one item needs follow-up. The verdict is single but the character splits three ways, distinguished in Findings — **code fixes** (`[Spec violation]`, `[Undecided behavior]`, `[Best practice]` with weight `now`), **ADR corrections** (`[Impl-fact mismatch]` → sync), and **human decisions** (`[Decision changed in code]`, `[Undecided behavior]`). If only `[Best practice]` items with weight `next-cycle` remain and there is no other must-fix, treat them as advisory and return PASS (so minor convention violations do not inflate the verdict).
- `INCONCLUSIVE`: an important decision row or failure path could not be accounted for or executed because of environment constraints. Never convert unverified into PASS.
- `BLOCK`: the vertical slice the ADR specified is fragmented by layer in the code so the decision cannot be traced (re-categorization or restructuring needed), the category itself is an anti-pattern, or a `[Decision changed in code]` **forks the decision topic itself** (the old and new decisions must coexist as separate "current state" records) so the code cannot be justified without a new superseding ADR — notify the main session of the needed restructuring. By contrast, a merely reversed decision direction (replacing the adopted alternative, inverting a driver, where the old decision is no longer valid) is not a BLOCK — it is absorbed by editing the ADR body in place to current state and logging one line in the decision log when major (see `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede").
