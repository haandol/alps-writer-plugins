# Implementation review remediation routing

Read this reference completely only when the review produced a finding or when
`/adr-impl` needs the final routing result. `/adr-impl-review` remains
report-only.

Return findings to `/adr-impl` in two groups:

- **Auto-remediate in the caller**: `Unnecessary change`, `Simpler alternative`,
  `Refactor`, `Spec violation`, `Best practice` weighted `now`, `Test gap`, and
  confirmed `Impl-fact mismatch`, when the fix is evidence-backed, remains
  within the approved scope, and does not change the ADR contract. `/adr-impl`
  applies them, records what changed, reruns affected tests, and reruns the same
  review mode.
- **Escalate**: a changed/new ADR decision, contradictory premises, a material
  `Unverified risk`, destructive migration, or a broad repair outside the
  approved scope.

Detailed routes:

- `Unnecessary change` → remove the code and re-run related tests.
- `Simpler alternative` / `Refactor` → simplify only when the ADR decision and
  observable behavior remain unchanged.
- `Spec violation` / `Best practice` → fix the code; minor `next-cycle` advice
  may remain advisory when it does not affect PASS.
- `Decision changed in code` → the user decides between updating the ADR and
  reverting the code. If they choose to update the ADR, the edit is not the
  whole job: a decision change of this kind is **major** by definition
  (replacing the adopted alternative, inverting a Driver, changing a
  requirement value), so it also takes one line in the category's
  `decision-log.md`. Route the edit to the owning command: `/adr-impl <category>`
  when the code is being reworked in the same cycle, `/adr-sync <category>` when
  the code already stands and only the ADR must catch up, or `/adr-new` only
  when the decision topic itself forked and the old decision must stay
  separately referenceable.
- `Undecided behavior` → first confirm the behavior passes the ADR admission
  gate. If it is replaceable implementation discretion, resolve the finding with
  no ADR change. Otherwise the user decides whether to add the admitted decision
  to the ADR or remove it from the code. Adding it goes through the same owners:
  `/adr-impl` or `/adr-sync` for an in-place addition, `/adr-new` when it is a
  separate durable decision.
- A blocking ADR-completeness gap → return one consolidated Decision request
  with recommendation, basis, realistic alternatives, impact, and exact
  contract wording; the caller updates the ADR revision after the user's answer.
- `Impl-fact mismatch` → use `/adr-sync <category>` to remove the stale
  implementation detail, or correct it only when it is an admitted
  public/architectural contract.
- `Test gap` → add a test that detects the failure first, then fix the code.
- `Unverified risk` → reproduce or verify the concrete failure hypothesis or
  externally checkable premise first, or explicitly accept the risk. State
  which contract or safety property could fail if the premise is false. Do not
  fix it straight away.
- `Contradiction` → do not fix anything before a human decides which of the two
  premises holds.

Once automatic fixes are done, run `/adr-impl-review` again to complete the selected
review path. Full mode completes both necessity and sufficiency passes; standard
mode completes its sufficiency pass. On `PASS`, the caller completes the Status
transition and reports the fixes; no routine post-implementation approval
remains. The comprehension check is not an approval, but it still governs
whether the human should open or send the PR.
