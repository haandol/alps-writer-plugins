---
name: adr-new
description: Author a new ADR directly (no ALPS PRD required). Drafts a Proposed ADR and records it in the docs/adr/.mapping.json index (path + Status + Key Decision summary). Use when the user invokes /adr-new or asks to write an ADR for a fresh decision (refactor, infra choice, new feature direction). Keywords - "/adr-new", "ADR 새로 작성", "ADR 만들어줘", "draft an ADR", "write a new ADR".
argument-hint: "<category> [title?]"
---

# adr-new

Before classifying features, read
`${CLAUDE_PLUGIN_ROOT}/references/feature-boundaries.md`: inspect existing project
topology, then use bounded contexts and vertical user stories by default.

> **Reports**: Before human-facing reports, apply [report-writer](../report-writer/SKILL.md).

Author an ADR directly. Works without an ALPS PRD — this is the plugin's canonical ADR authoring path, while `/feature-to-adr` is "the helper that auto-converts an ALPS Section 7 feature when one already exists."

When qualifying jargon or an unclear acronym appears, read
`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. Require a clear user meaning,
reuse supplied definitions, and create or update `docs/adr/glossary.md` only when
needed under the current ADR approval. Keep the decision and requirement contract
self-contained in the ADR; glossary work adds no separate classification interview.

> When to use: whenever a decision passes the **ADR admission gate** and must be recorded before changing code — a requirement contract, external boundary, data/key design, security trust boundary, adopted algorithm, fallback policy, or durable trade-off. A replaceable implementation means does not enter this skill. The ADR you write can go straight into `/adr-impl`.
>
> **Refactoring is out of scope** — a structural change that does not alter behavior is left to the coding agent's planning step rather than turned into an ADR (`concepts.md` "What an ADR is not"). If the user tries to record a refactor as an ADR, ask once: "Does this change alter behavior or a decision (the adopted alternative, a state transition, the key design)? If it is pure structural cleanup, planning without an ADR is the better path." If a decision does change, it is not a refactor, so proceed.

> **Apply the ADR admission gate before eliciting or drafting.** Ask whether the choice changes a requirement contract, system/data/security boundary, external provider/model or fallback, adopted algorithm, consistency model, or another durable cross-implementation trade-off. Then use the implementation substitution test: if a library, SDK, framework, middleware, module layout, credential provider chain, signer, or adapter can be replaced while preserving those contracts and boundaries, do not create an ADR. Tell the user it belongs in the implementation plan, code, tests, dependency metadata, or project conventions. "GPT-5.6 through Amazon Bedrock" can pass because it fixes an external model/provider boundary; the Bedrock SDK or credential/auth adapter does not pass by itself. **After admission, run the decision identity check before creating anything**: update the ADR that already owns the architectural question and boundary; create a new ADR only when no owner exists or the topic truly forks.

> **Language**: this skill and every other harness prompt are written in English, but **talk to the user and write the ADR body in the language the user writes in** (`authoring-rules.md` "Conventions"). The prompts below are phrasing guides, not literal strings to paste.

Before eliciting or drafting, read
`${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely. Apply it
to the ADR body and the Decision Digest without weakening any contract.

For acceptance and improvement criteria, apply
`${CLAUDE_PLUGIN_ROOT}/references/outcome-evaluation.md`: propose useful optional
tension signals and preserve monitoring versus required meaning.

Before interpreting delegated choices, read
`${CLAUDE_PLUGIN_ROOT}/references/requirement-delegation.md` completely.

## Authoritative working model

Read the target repository's `docs/adr/concepts.md` and
`docs/adr/authoring-rules.md`, falling back to the plugin templates. Reuse
unchanged guidance already loaded in this context. They own the abstraction
ladder, single-level read test, and regeneration test: the ADR must explain the
decision and complete requirement contract independently, while replaceable
implementation detail stays in code. Apply the requirement gate before the
code-readthrough and litmus tests. The procedure below supplies this skill's
authoring, approval, and persistence boundaries.

Prepare and verify ADR bodies and mapping changes in a disposable draft space;
do not create or modify the repository's ADR bodies or `.mapping.json` before
approval. Steps 3–6 prepare candidates, and step 7 applies only approved changes.
Writing the live files and then reverting them is still a pre-approval write.
Step 1's initial rule-document seeding and separately approved refresh retain
their existing permissions; neither authorizes an ADR body or mapping change.

Reuse caller answers and approvals; ask only about new gaps.

## Procedure

### 1. Interpret the arguments

- **`<category>`** (required) — a kebab-case category key. Accept all of these forms (see `structure.md` "Directory structure"):
  - **A single-segment context / flat key** (`identity`, `auth`) — a single-feature context (flat), or a cross-cutting decision directly under a context. Derive the key from the feature name. Only for workshop or number-based PRDs where no feature name yields a meaningful kebab do you fall back to an ALPS Feature ID such as `f1` or `f-auth-01` — and even then the ID is not preserved as a separate field; it merely derives this category key.
  - **A two-segment `<context>/<feature>` key** (`identity/login`, `ordering/checkout`) — one feature (vertical slice) inside a bounded context. Use it when a context holds several features.

  For the category rules (top level = bounded context, sub-folder = feature, forbidden categories, cross-cutting and subdomain conditions), see `structure.md` "Directory structure" / "Anti-pattern categories". If the user supplies an anti-pattern category (`frontend`, `backend`, `api`, `db`, and the like — whether as the context folder or the feature sub-folder), ask once: "Does this decision belong to one feature (e.g. `identity/login`, `ordering/checkout`)? If two or more share it, a system-wide cross-cutting context (`infra`, `data`, `integration`, `security`, `platform`) is the better fit."

- **`[title]`** (optional) — use the supplied title or derive it from the established decision. Ask which decision to record only when the request leaves that unclear.

Apply `authoring-rules.md` "ADR admission gate" **before any filesystem write or mapping initialization**:

- If the requested decision fails the gate, stop this skill without creating `docs/adr/`, `.mapping.json`, a category, or an ADR. Return one line naming the replaceable implementation means and where it belongs instead.
- If the choice is ambiguous because it may establish a trust boundary or externally supported contract, ask only for that boundary/contract. Never use "it is a technology choice" as sufficient evidence.
- An old low-level ADR does not justify adding another low-level ADR beside it.

After the request passes admission, apply `authoring-rules.md` **"Decision identity check — update before create" before any filesystem write, category creation, or ADR number allocation**:

1. If `docs/adr/.mapping.json` exists, read every summary. Inspect the requested category first, then plausible matches elsewhere so a renamed or miscategorized owner is not missed.
2. Read the full body of each plausible match. Compare the architectural question and the requirement/system/data/security/external boundary it owns, not the current product name, provider, adopted alternative, or direction of change.
3. If one existing ADR can express the requested result as a single current-state record, **stop the new-ADR path**. Do not create a category, allocate `NNNN`, or append an `adrs[]` record.
   - When code has not changed yet, route to `/adr-impl <existing-category>` so it rewrites that exact ADR in place, records a major transition when required, returns an implemented `Accepted` ADR to `Proposed`, and then implements.
   - When code already embodies the intended decision and the ADR is catching up, route to `/adr-sync <existing-category>`.
   - A provider replacement, an adopted-alternative replacement, an inverted Decision Driver, and a return to a formerly used provider are all edit-in-place when the same ADR still owns the topic. For example, GPT-5.6 via Amazon Bedrock → GPT-5.6 via the OpenAI API → Amazon Bedrock again keeps one provider-boundary ADR and one path.
4. Continue creating a new ADR only when no existing ADR owns the topic, or when the topic forks and multiple decisions must remain independently current and separately referenceable. When uncertain, the default is edit-in-place plus a decision-log entry.

After admission and decision identity checks select the new-ADR path, read
[repository setup](references/repository-setup.md) for rule-document seeding,
layout or version refresh, missing mapping and category growth. Initial seeding
never authorizes ADR body or mapping writes; preserve hand edits and obtain the
existing refresh/move approvals.

### 2. Elicit the decision's motivation

Establish the following from the request, supplied sources, and existing context. Ask only for missing decision information; group closely related gaps when useful. The items are coverage requirements, not a mandatory interview script:

1. **What problem or need is driving this decision?** (Purpose)
2. **Which pressures, constraints, or requirements discriminate between the options?** (Decision Drivers — usually 3-5, but keep only real discriminators. Not generic quality attributes like "scalability" or "maintainability".) If the decision is tightly constrained, record why fewer drivers are sufficient.
3. **What choice are you making? One core line.** (Decision)
   - **Collect the values and contracts the result must honor as well** (the requirement contract — `authoring-rules.md` "Concrete numbers" + "Non-numeric requirements"). Even if the user says "that can just go in the code," record it in the ADR too — the value is enforced in code, but **only the ADR records that it is a contract**, which is what later justifies changing the ADR first (`authoring-rules.md` "Requirements live in the code and in the ADR"). **When required values or rules remain unclear, ask:** "Are there values or rules a developer must not decide on their own here? For example a maximum count or number of turns, a usage quota, a retention period, a size cap, a response-time target — and also **the list of allowed states or values, whether an input is mandatory, who may see what, whether duplicates are allowed, and the unit of money or time.**" **Requirements do not arrive only as numbers, so do not stop at probing for numbers.** Carry each answer into the ADR **with its number and basis (policy, contract, regulation) verbatim.** The deciding question is "if a developer changed this value, would that violate a requirement?" — YES makes it a requirement value that must be recorded; NO makes it an implementation tuning value that must not. Apply the shared requirement-delegation guidance to delegated choices and reuse already established values. **Never invent a number and record it as though it were an approved requirement.**
   - **Collect observable evidence for each contract row** — ask what implementation-independent result would show that the obligation is met or violated. Keep one obligation per row so later implementation review can assign one coverage status. Record outcomes such as "the sixth upload is rejected and the count remains 5", not test commands, file names, functions, libraries, fixtures, or internal representations.
   - **Expose only decision-changing assumptions.** When the alternatives comparison depends on an unstated fact, ask: "What assumption is this choice relying on, and what decision would we reconsider if it were false?" Route the answer before writing it. A value or rule the result must honor goes in the requirement contract. An assumption that changes which architectural alternative is preferred becomes one short line in Purpose or the relevant Decision Driver: `<assumption> — reconsider <decision> if false`. A replaceable library, SDK, adapter, internal structure, timeout, pool size, retry count, or other implementation default stays out of the ADR and is surfaced later by implementation review. If an unverified assumption changes the contract or a durable architecture boundary, resolve it before approval rather than recording it as accepted fact. Do not add a separate assumptions section, confidence taxonomy, or fixed table.

4. **Were other options considered and rejected? Collect the realistic alternatives that actually existed.** Two or more are useful when available. If policy, regulation, or an external boundary left only one valid path, record that constraint instead of inventing a strawman.
5. **Is there another category that must be implemented before this one (a prerequisite)?** (Upstream dependency — e.g. "checkout needs the cart working first".) If so, collect that **prerequisite category key** (otherwise "none"). This answer is stored as `dependsOn` in `.mapping.json` in step 4 and read by `/adr-impl`'s prerequisite gate — the "Prerequisites" line on step 7's confirmation screen comes from here too. In a project that also has an ALPS PRD, `/feature-to-adr` carries dependencies over from Section 6.3, so you need not ask again.
6. Identify the bounded context from the shared feature-boundary model and reuse
   confirmed grouping. Ask only about materially unclear business ownership.
   **Optional:** `subdomainType` (core/supporting/generic) remains advisory; skip
   that metadata question when unknown, without skipping the context itself.

If the user answers everything at once, take it as given; if they answer briefly, break it into one or two rounds. If they say they do not know, do not guess — agree on "shall we leave this blank, save as Proposed, and fill it in during /adr-impl?"

### 3–5. Draft the ADR and index

Read [draft and index](references/draft-and-index.md) before drafting. Use an
independent disposable candidate tree, keep the full requirement contract and
observable evidence, and run the regeneration test. The draft describes the
current decision, intent, valid Drivers and realistic alternatives; remove
mechanical writing patterns without losing contracts. Start new ADRs as
`Proposed`, and prepare the mapping without modifying official files.

### 6. Verify before saving

Read [candidate verification](references/candidate-verification.md). Run the
structure checks against the draft tree, perform the R1–R20 semantic review, and
repair candidate defects before requesting approval. Preserve the written
regeneration checklist for step 7.

### 7. Confirm and save

Read [approval and save](references/approval-and-save.md) when the candidate is
ready. Present the Decision Digest, exact contracts, prerequisites and written
regeneration checklist. Reuse unchanged approval; otherwise confirm the baseline
once. Apply only the approved files after checking source/destination freshness,
then verify official structure. Silence or a draft check is not approval.

### 8. Point to the next step

After saving, offer the next step in one line:

- "Continue straight into implementation with `/adr-impl <category>`?" — the common flow.
- "If there are more ADRs to write alongside this decision, call `/adr-new <category>` again for the same category."
- Offer `/adr-review <category>` only when the user asks for a second opinion, or when step 6(b) left an axis you could not settle — it is the path for an ADR nobody has an authoring context for, which is what a hand-edited ADR becomes. Do not run it automatically here; the draft was just judged against the same rules.

> **Note**: if an ALPS Section 7 feature already exists and you want to bulk-convert it into ADRs, use `/feature-to-adr`. `/adr-new` is the path for authoring a single decision directly, as it comes up.
