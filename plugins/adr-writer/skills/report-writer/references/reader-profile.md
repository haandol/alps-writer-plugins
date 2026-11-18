# Reader profile

A reader profile records, per business area of one project, how far the user
understands it: an explanation level, what they already know (starting points
for analogies) and what they do not (terms to unpack). Reports read it to set
their starting level and use the overall role, focus and explanation order
to tailor the presentation. Use
`scripts/reader-profile.mjs` for every step that touches sessions or the file.

## Use it when writing a report

1. Run `bun <skill-directory>/scripts/reader-profile.mjs status` from the project.
2. If `action` is `use`, read the profile and pick the section whose identifier
   is the area the report's topic belongs to (the BC `id` when the topic comes
   from the ontology), falling back to `Overall`. When a report spans
   areas, explain each part at its own area's level.
3. If `action` is `ask-to-create`, briefly describe the levels below and ask
   once whether to build the profile. Continue independent work while waiting.
   If they agree, follow [build or refresh](#build-or-refresh). If they decline
   or do not answer, use `beginner` and do not ask again
   in this session. Never read sessions without that answer.

Use `beginner` when neither the request nor the profile supplies a level.

| Level          | How to explain                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| `beginner`     | Explain the background and unpack project terms and acronyms at first use.           |
| `intermediate` | Unpack the terms listed under `unfamiliar`; connect new parts to what `knows` lists. |
| `expert`       | Skip known basics and explain exact conditions and exceptions.                       |

Start analogies from what `knows` lists for that area, and explain what
`unfamiliar` lists where it first appears. The current request's stated audience
and preferences override the profile. Do not apply the user's profile to a
report written for someone else. Never quote the profile or mention the reader's
level in the report.

## Overall reporting preferences

Use these three axes alongside the topic's explanation level. An absent or
`unknown` axis leaves the choice to the current request and its evidence.

| Field               | Values                                                                          | How it shapes the report                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`              | `pm`, `po`, `backend`, `frontend`, `full-stack`, `designer`, `other`, `unknown` | Choose examples relevant to the inferred work. A role alone supplies neither expertise nor preference.                                              |
| `focus`             | `product-outcomes`, `architecture`, `code-behavior`, `unknown`                  | Give the preferred subject prominence in the explanation.                                                                                           |
| `explanation-order` | `examples-first`, `structure-first`, `unknown`                                  | Start the explanation with a concrete case or observation, or with the system's structure and principles. Keep the report's required opening order. |

Infer the main role first from evidence of the work the user does. Judge focus
and explanation order independently from repeated requests or stated
preferences. Use `unknown` when evidence is thin.

## Update from a report revision

Use an existing profile regardless of its age. During a revision for the user,
save a change only when the current request or conversation shows a preference
that should carry over to future reports. Update only supported fields and the
date through `reader-profile.mjs save`. Preserve the other fields and area
basis. Do not scan past sessions, infer a lasting preference from a one-off
edit, or apply someone else's audience requirements to the user's profile.
Create or fully refresh a profile only through the explicit workflow below.

## Build or refresh

Run only after the user asked for it or agreed to the question above.

1. **Choose the area basis.** If the project has a business ontology and
   ontology-writer is available, use the bounded contexts from its
   `query --overview` and set `area-basis: bounded-context`. If the project has
   no business ontology but ontology-writer is available, first ask the user
   once whether to build the ontology now so the profile records bounded
   contexts, or to build the profile now by feature areas. On "ontology first",
   build it through ontology-writer's own workflow and approvals, then continue
   here with its bounded contexts; never infer bounded contexts without it.
   Reuse the answer for this session, and on no answer read no sessions. Otherwise run
   `reader-profile.mjs areas`: ADR categories give `adr-category`. Without
   either, name the project's evident areas (top-level packages or features) as
   `project-area`. Head each area section with its identifier, then `—` and
   its display name: the BC `id` and `label` (`## memory — 사용자 기억`) or the
   ADR category key and feature. The identifier is the link, so a renamed area
   stays the same section; use only these identifiers and names, not model content.
2. **Read the digest.** Run `reader-profile.mjs digest`. It holds only the
   user's own typed messages from this project's Claude Code and Codex sessions,
   with emails, URLs, paths, IPs, tokens, phone numbers, handles, long
   identifiers and code replaced by markers. To stay small it drops short
   operational commands and near-duplicates, lists the terms the user writes
   (a signal for `knows`), keeps questions and explanation requests first (the
   strongest signal for `unfamiliar`), then a sample of directions, all within
   a character budget (`--budget`, default 6000). For a refresh, pass
   `--since <updated>` from the existing profile and merge the new judgment into
   it. Use `extract` only when the digest is not enough to judge an area. Keep
   either output in context only; never write it to a file.

   Only the save result needs to reach the user; do not echo the digest back.
   How to run these steps (in the current conversation or otherwise) is the
   agent's choice and does not depend on a particular client or model.

3. **Judge the overall axes and each area.** First set the three overall axes.
   Then assess each area. From the questions and requests, infer what the user
   already reasons about fluently (`knows`), what they asked to have explained
   or got wrong (`unfamiliar`), and a `level`. Base a level on several messages,
   not one. Skip areas without evidence rather than guessing.
4. **Write and save.** Compose the profile in the user's language and pipe it to
   `reader-profile.mjs save`, which checks it and writes it outside the
   repository only when the check passes. Fix every finding and save again.

Keep each area to its level, known concepts and unfamiliar concepts. Add the
three reporting axes in `Overall` when building or explicitly refreshing a
profile. Older profiles with missing axes can still be used. Record no
names of people, organizations or customers, contact details, accounts or
identifiers, secrets, internal hosts or addresses, business figures, incident
details, quotations of the user's messages, judgments of personality or
ability, or the messages that led to a judgment. The check catches patterns but
not names, so these rules still apply to every line you write.

```markdown
---
project: example-service
updated: 2026-11-12
area-basis: adr-category
---

# Reader profile

## Overall

- role: backend
- focus: architecture
- explanation-order: examples-first
- level: intermediate
- knows: REST APIs, relational databases, code review workflow
- unfamiliar: event sourcing, idempotency keys

## billing/settlement — Settlement

- level: beginner
- knows: what an invoice and a refund are as a customer
- unfamiliar: settlement batches, ledger reconciliation, provider webhooks
```

## Show, change or delete

The profile belongs to the user. Show it on request by reading the `profilePath`
from `status`. Apply requested corrections through `save`, and remove it with
`reader-profile.mjs delete`. It never lives inside the repository and is never
committed.
