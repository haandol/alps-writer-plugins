# Reader profile

A reader profile records, per business area of one project, how far the user
understands it: an explanation level, what they already know (starting points
for analogies) and what they do not (terms to unpack). Reports read it to set
their starting level; explicit profile requests build and maintain it. Use
`scripts/reader-profile.mjs` for every step that touches sessions or the file.

## Use it when writing a report

1. Run `bun <skill-directory>/scripts/reader-profile.mjs status` from the project.
2. If `action` is `use`, read the profile and pick the section whose identifier
   is the area the report's topic belongs to (the BC `id` when the topic comes
   from the ontology), falling back to `Overall`. When a report spans
   areas, explain each part at its own area's level.
3. If `action` is `ask-to-create` or `ask-to-refresh` (missing, or last updated
   more than three months ago), ask the user once whether to build or refresh it
   now. Treat a profile whose `areaBasis` is not `bounded-context` as
   `ask-to-refresh` when the project now has a business ontology, so its areas
   move to the bounded contexts. Continue independent work while waiting. If they agree, follow
   [build or refresh](#build-or-refresh) and then write the report. If they
   decline or do not answer, write at a plain general level and do not ask again
   in this session. Never read sessions without that answer.

Apply the level to the explanation, not to the facts:

| Level          | How to explain                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `beginner`     | Unpack every project term and acronym at first use, add the missing background, lean on analogies. |
| `intermediate` | Unpack the terms listed under `unfamiliar`; connect new parts to what `knows` lists.               |
| `expert`       | Skip known basics; spend depth on the unfamiliar boundary and exact conditions.                    |

Start analogies from what `knows` lists for that area, and explain what
`unfamiliar` lists where it first appears. The current request's stated audience
and preferences override the profile. Do not apply the user's profile to a
report written for someone else. Never quote the profile or mention the reader's
level in the report.

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

3. **Judge each area.** From the questions and requests, infer what the user
   already reasons about fluently (`knows`), what they asked to have explained
   or got wrong (`unfamiliar`), and a `level`. Base a level on several messages,
   not one. Skip areas without evidence rather than guessing.
4. **Write and save.** Compose the profile in the user's language and pipe it to
   `reader-profile.mjs save`, which checks it and writes it outside the
   repository only when the check passes. Fix every finding and save again.

Keep each area to the three lines below, a few short phrases each. Record no
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
