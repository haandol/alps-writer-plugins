---
name: adr-impl
description: Implement an ADR — check dependencies first, implement prerequisites in topological order, write code, run tests, apply verified low-risk refactors, complete the adversarial implementation review, then auto-promote ADR Status from Proposed to Accepted. Enforces the ADR-first development cycle. Use when the user invokes /adr-impl or asks to implement an ADR / a Proposed feature whose decision is already recorded. Keywords - "/adr-impl", "ADR 구현", "implement ADR", "Proposed ADR 코드 반영".
argument-hint: "[adr-path-or-category]"
---

# adr-impl

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

Read `docs/adr/glossary.md` only when the selected ADRs need a term definition.
Its absence is normal; preserve it as supporting material, not an indexed ADR.
When this workflow permits ADR writing and a definition needs creation or change,
apply `${CLAUDE_PLUGIN_ROOT}/references/glossary.md` under the existing approval
boundary. Review-only work reports unclear or conflicting meanings without editing.

Implements the specified ADR in code. Once implementation, tests, the verified refactor pass, and final implementation review pass, it automatically updates a `Proposed` target to `Accepted`; an existing `Accepted` target whose decision and requirement contract remain unchanged stays `Accepted` throughout. **If no ADR exists, apply the ADR admission gate first.** Write an ADR with `/adr-new <category>` only for a durable requirement or architectural decision; implement replaceable libraries, SDKs, frameworks, credential/auth wiring, and other code-level choices without creating one. If an ALPS Section 7 feature already exists, batch-convert with `/feature-to-adr`.

> Status semantics: `Proposed` means "the ADR has been proposed but is not implemented", `Accepted` means "implementation complete". This command transitions only a `Proposed` target after completion; it never cycles an unchanged `Accepted` target through `Proposed`.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Procedure

> **Read the seeded rule docs the repo actually holds before implementing** — `docs/adr/concepts.md` (the abstraction ladder, the gray zone, the requirement contract, Status and its automatic transitions) and `docs/adr/authoring-rules.md`, falling back to the same files under `${CLAUDE_PLUGIN_ROOT}/templates/adr/`. A project may have hand-edited or pinned its copy, and this command both **enforces requirement values at face value** (step 4) and **transitions a completed `Proposed` target** (step 7), so it must act on the rules that repo holds rather than remembered defaults. In a repo seeded before 0.5.0 there is no `concepts.md` — that material sits inside `README.md`, so read it there.

1. **Identify the target ADR**

   Use the exact path or category in `.mapping.json`. For a missing/ambiguous
   target, no selection, or a requested change to an `Accepted` decision, read
   [target and change](references/target-and-change.md). It owns renamed-path
   recovery, Proposed selection, decision identity and ADR-first changes.
   Behavior-preserving work keeps an unchanged dated `Accepted` Status.
   Admitted contract changes require the owning ADR first; every Status change
   uses `adr-status-transition.mjs` with the exact ADR path and matching index.
   Always complete step 2 before planning, even for one target.

2. **Dependency check before planning**

   Read [dependencies](references/dependencies.md) for every selected target.
   Traverse `dependsOn` transitively. A dangling reference or cycle blocks
   implementation; a `Proposed` prerequisite blocks downstream work until it is
   implemented and `Accepted`. Implement multiple targets in topological order,
   never input order. Distinguish explicit `[]`, undeclared dependencies and
   missing legacy mapping, with the notices that module requires.

3. **Build the plan**

   After the dependency gate, read [planning](references/planning.md). It owns
   vertical Implementation Hills, derived obligations and reversible defaults,
   comprehension-load choices, optional Stacked PR delivery, semantic diff and
   the implementation intent baseline. Publish the plan as a non-blocking update
   when the exact ADR revision is already approved; never request routine plan
   approval again. Resolve protected contract choices before implementation.
   For comprehension load `8/10` or higher, ask the split-review-versus-original
   choice before offering concrete split candidates. Keep plans ephemeral.

4. **Implement**
   - Edit/Write in small units.
   - Implement one vertical Hill at a time using `references/implementation-hiking.md`. Finish the Hill's necessary cross-layer behavior and targeted ideal/edge verification before making the next Hill the primary implementation unit. Hill progress is ephemeral and creates no approval or lifecycle gate.
   - Follow the behavior rules, state transitions, and integration methods stated in the ADR exactly. To implement something differently from the ADR, change the ADR first.
   - **Enforce the requirement values the ADR records, at face value** — do not arbitrarily change or "roughly approximate" limits, quotas, intervals, retention periods, ceilings, or targets; actually put in the code that enforces those values (ceiling checks, counters, expiry handling). **Non-numeric requirements are the same** — enforce exactly the allowed value sets, transition rules, mandatory-ness, permissions, visibility, ordering, uniqueness, and units that the ADR fixed (do not add a state that is not allowed, do not open a forbidden transition, and do not turn a required input into an optional one). Enum identifier names are at your discretion, but **the set and the transition rules are the contract**. If a reason arises to change a value, do not fix the code first — update the ADR first (a requirement value change is at minimum major, so also leave a one-line entry in `decision-log.md` — `authoring-rules.md` "What to log — minor vs major").
   - **Unspecified values below ADR resolution are implementation discretion** — after applying the requirement gate, choose connection pool size, backoff, cache TTL, worker count, and similar replaceable means to serve the recorded intent. Absence from the ADR alone does not make a product rule discretionary. Keep implementation values out of the ADR.
   - **Replaceable implementation means are implementation discretion too** — libraries, SDK clients, frameworks, middleware, module structure, credential provider chains, signers, and adapters remain in code when the same requirement contract, system/security boundaries, and trade-offs still hold. Choosing or replacing them does not create a new ADR and does not amend this one.
   - Material implementation choices are derived once from the final code by the sufficiency review and are never written into the ADR.
   - Apply the admission gate to each choice before classifying it. A choice that changes a requirement contract or durable system/data/security boundary is not implementation discretion: stop and update the ADR first. A replaceable choice remains in the ephemeral ledger.
   - Inspect only the **externally checkable premises** the implementation relies on — provider guarantees, input provenance, ordering, uniqueness, trust boundaries, platform behavior, and similar facts. Do not reconstruct or request private chain-of-thought. Confirm a premise from code, tests, configuration, or an authoritative external contract. If the premise is unverified and its falsehood could violate the ADR contract or safety, stop automatic completion and carry it to review as an `Unverified risk`; do not silently treat it as implementation discretion.
   - Apply the same gap-resolution order during implementation. Automatically satisfy derived obligations and established low-risk domain defaults. If new evidence exposes a real product-policy gap with multiple valid outcomes, stop once, present the consolidated Decision request, update the ADR after the answer, and then continue.
   - Before creating or materially changing handwritten functions, read `${CLAUDE_PLUGIN_ROOT}/references/implementation-evidence.md` completely and apply its documentation, inline-comment, and executable-evidence contract.
   - If, mid-implementation, you judge that a gray-zone decision in the ADR (adoption rationale, domain rules, state transitions, fallback) needs to change, re-run the ADR admission gate first. If only a replaceable implementation means changes, continue in code without touching the ADR. If an admitted decision changes, do not fix the code first — stop and branch with the user on "is this an intended decision change, or is honoring the ADR the right call?" — if it is a decision change, update the ADR to the current decision first (edit-in-place; if the decision topic branches, supersede with a new ADR) and put it in the same commit; otherwise implement per the ADR. If that change is **major** (`authoring-rules.md` "What to log — minor vs major"), also leave a one-line entry in the category's `decision-log.md` — the log entry is added **at the moment you change the decision** (which is separate from the automatic Status transition in step 6 — the log records the decision, Status records the fact of implementation). If code silently drags a gray-zone decision along, the one-way PRD → ADR → code flow breaks (the same framing as `adr-sync` "Scope of the source of truth").

5. **Test**
   - Before moving to the next Implementation Hill, run its targeted ideal case and relevant counterexample and record the command and observed result. After every Hill has verified results, run the project's full test command.
   - Find the project's test command in `AGENTS.md` or `package.json`; the full run above satisfies this check.
   - Apply the ideal-case, relevant-edge, test-naming, and missing-test-path rules from `${CLAUDE_PLUGIN_ROOT}/references/implementation-evidence.md`.
   - If tests fail, do not move on to step 6 — if it is an implementation bug go back to step 4; if the ADR made the wrong decision, fix the ADR first and then go back to step 4.
   - Once the initial implementation tests pass, assess whether a separate `/adr-impl-refactor <category>` pass is warranted. Run it for multi-call-site changes, concrete duplication or unnecessary work, broad diffs, or non-trivial efficiency/complexity risk. For a local change whose final sufficiency review can cover the same axis, skip the separate pass and record that basis. When selected, its model-chosen strategy applies only high-confidence, local, behavior-preserving candidates with before/after tests.
   - A critical refactor finding does not bypass that safety gate. Changes to public contracts, schemas, dependencies, state or transition rules, permissions, validation, concurrency, transactions, fallback, resource lifetime, or error semantics are never automatic refactors.
   - If `/adr-impl-refactor` applied any code change, rerun the **full project test command** on the resulting code. Targeted before/after tests establish that each patch is locally safe; the full rerun establishes that the implementation as a whole is still complete. If it fails, do not move to step 6 — undo or correct only the refactor introduced in this pass, then rerun the tests.
   - Keep `/adr-impl-refactor`'s proposal-only items in the wrap-up. They are advice, not incomplete implementation, unless one exposes an ADR violation or a concrete functional defect that belongs back in step 4.

6. **Final implementation review (completion gate)**

   After final tests and any selected refactor pass, read
   [completion](references/completion.md). Validate ADR/index structure, choose
   standard/full from risk, and run `/adr-impl-review` against the complete
   implementation scope. Automatically repair evidence-backed defects within
   the approved contract and rerun the necessary tests and review. A new decision,
   contradictory premise, unverified material risk or out-of-scope destructive
   repair needs user judgment. Preserve the target's lifecycle state throughout.

7. **Automatic Status transition when needed and wrap up**

   Follow the same completion module only after review `PASS`. Transition only
   `Proposed` targets using the deterministic status script; retain unchanged
   dated `Accepted` targets. Verify body/index lockstep and report tests,
   fixes, deferred advice and the validated HTML evidence path without a routine
   reconfirmation or an unsolicited interactive quiz.

**Forbidden**:

- Do not jump straight to planning/implementation without the dependency check (step 2) — even a single ADR must pass the prerequisite gate first.
- Do not start with a downstream ADR while a prerequisite ADR is unimplemented (`Proposed`).
- Do not implement multiple ADRs in input order — always implement in `dependsOn` topological order (prerequisites first).
- Do not implement a new requirement or architectural decision that passes the ADR admission gate without an ADR. Replaceable implementation means are exempt.
- Do not request routine implementation-plan approval when the exact approved ADR revision is unchanged. Publish the plan as a progress update and proceed.
- Do not demote an unchanged `Accepted` ADR to `Proposed` for behavior-preserving implementation or review work.
- Do not ask the user to decide a gap that the explicit contract logically resolves or that an established, reversible project/domain default resolves below ADR resolution.
- Do not silently invent product policy. Monetary rules, permissions, retention, legal/compliance behavior, irreversible data semantics, public contracts, and durable fallback choices with multiple valid outcomes require a consolidated Decision request and an ADR update.
- Reflect any decision change discovered during implementation in the ADR before modifying the code.
- Do not promote an ADR to `Accepted` when tests have not passed — Status is a fact about code behavior, not a declaration of intent.
- Do not promote an ADR before the refactor need is assessed, any selected refactor pass and required test rerun complete, and final implementation review passes.
- Do not edit ADR Status fields or mapping statuses manually. Always use `adr-status-transition.mjs` with the exact target ADR path.
