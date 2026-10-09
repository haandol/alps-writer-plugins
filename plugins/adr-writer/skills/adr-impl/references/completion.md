# Implementation completion

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

6. **Final implementation review (completion gate)**
   - After the final tests, verify the ADR / mapping structure with the deterministic harness:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <implemented category key>
     ```

     This check mechanically catches malformed ADR/index state, broken dependencies, and new ADR back-references before the adversarial review spends model work on an invalid baseline. If an `error` comes out, fix it before continuing.

   - Select the completion-review mode from the final diff. Use `full` when requirement values or rules, public API/wire form, schema/persistence, state/transitions, permissions/visibility, security, external fallback, concurrency, transactions, resource lifetime, error semantics, bounded contexts, or broad modules changed; use `standard` only for localized implementation that changes none of those surfaces. If classification is unclear, use `full`.
   - Run `/adr-impl-review <category> --mode <standard|full>` on the refactored final code while preserving the target's lifecycle state: a new or contract-changed target remains `Proposed`, while an unchanged behavior-preserving reinforcement of an existing `Accepted` target remains `Accepted` (report only — the review does not modify code or ADRs). This invocation is the selected completion review, not a partial-review request. Pass the approved implementation intent baseline. Do not pass it the refactor review or result artifacts. The review derives the complete implementation scope from every ADR decision and contract row; the final diff remains separate change context and never limits sufficiency coverage. Standard mode checks the decision ledger with a sufficiency perspective and targeted tests; full mode adds separately grounded necessity and sufficiency perspectives plus detailed evidence artifacts. Both modes must return a validated, non-empty `adr-impl-review-report.html`. The review skill chooses the available agent or main-session orchestration. Neither mode repeats the routine intent/spec-fitness confirmation after implementation.
   - Give the completion review the Implementation Hill boundaries as disposable context and reuse them for Review Hiking when they still match the shipping user flows, logical capabilities, or bounded contexts. The reviewer may adjust a boundary when final evidence shows a different vertical capability, but it must never fall back to technical layers or lifecycle phases.
   - `PASS` proceeds to step 7.
   - On `FIX_REQUIRED`, preserve the current lifecycle state (`Proposed` for a new or contract-changed ADR, `Accepted` for an unchanged reinforcement) and automatically apply evidence-backed changes that do not alter the approved ADR contract: code fixes for `Spec violation`, tests for `Test gap`, `Best practice` items weighted `now`, high-confidence local `Unnecessary change` / `Simpler alternative` / `Refactor` items, and `/adr-sync <category>` for a confirmed `Impl-fact mismatch`. Record every applied item, rerun the affected tests, then rerun the same review mode. Do not ask the user to approve each repair.
   - Ask the user only when a finding requires a new or changed ADR decision, presents contradictory premises, leaves a material risk or a contract/safety-affecting implementation premise unverified, or requires a destructive/broad change outside the approved scope. `BLOCK` and unresolved `INCONCLUSIVE` preserve the current lifecycle state; they do not demote an unchanged `Accepted` ADR.
   - An already-`Accepted` ADR reviewed for a behavior-preserving reinforcement keeps its existing Status throughout the cycle. If the decision or requirement contract changed, step 1 already returned it to `Proposed`.

7. **Automatic Status transition when needed and wrap up**

   For the detailed policy see `concepts.md` "Automatic transition rules". Only after the step 6 review returns `PASS`:
   - If the target is `Proposed`, without asking the user run the deterministic transition command:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs <target-adr-path> "Accepted (YYYY-MM-DD)" --summary "<current one-line decision summary>"
     ```

   - The script updates the Status line in the target ADR body and the `status` of the exact matching `adrs[]` record in `.mapping.json` together. It fails instead of guessing when the path is absent, duplicated, or already inconsistent.
   - If the target entered the cycle as `Accepted` and its decision and requirement contract remained unchanged, do not run the transition script. Keep the existing dated `Accepted` Status and verify body/index lockstep with `adr-structure-lint`.
   - If several ADRs in one category were implemented together, transition only the `Proposed` targets and only after each one's completion review passes; retain unchanged `Accepted` targets as-is.
   - Run `adr-structure-lint` once more after any transition, or after an unchanged-`Accepted` completion, to verify the dated Status format and body/index lockstep.
   - Tell the user the work is complete. Surface the final verdict, key impact/action/risk, tests run, findings automatically fixed, deferred advisory items, the HTML Evidence Package path and open result, and either the ADR's `Accepted` transition or its unchanged `Accepted` Status. Do not copy comprehension questions, grading criteria, or an answer request into the ordinary completion response; the questions remain in the HTML report and become interactive only when the user explicitly requests the comprehension check. Do not ask for another approval when no unresolved decision or material risk remains.
