# ADR directory structure and mapping

Collects the folder layout of `docs/adr/`, the category-splitting rules, and the ADR registry (`.mapping.json`) policy. For the authoring rules see [`authoring-rules.md`](./authoring-rules.md); for the concepts and dependency model see [`README.md`](./README.md).

## Directory structure — DDD domain (bounded context) × feature (vertical slice)

The folder tree is organized along **two axes** — both expressed within the existing two-level key, adding no new depth.

- **Top-level folder = a bounded context (a DDD domain unit).** It is a model boundary named in the domain expert's ubiquitous language (`identity/`, `ordering/`, `catalog/`). One context usually **holds several features.**
- **Sub-folder = a feature (vertical slice).** The unit that traces one user action all the way from UI → API → Data (`identity/login/`, `ordering/checkout/`). It maps 1:1 onto an ALPS Section 7 feature.

**When a context has only one feature, omit the sub-folder and keep a flat structure** — a single-segment key means context == feature. Workshop or small projects and existing flat layouts (`auth/`, the workshop Feature ID `f1/`) can stay as they are and need no migration — a flat folder is reinterpreted as "a context with one feature".

```
docs/adr/
├── README.md                    # conceptual index (holds neither an ADR list nor a tree)
├── authoring-rules.md           # authoring rules · decision-log criteria · review checklist
├── structure.md                 # this document — directory layout · mapping policy
├── decision-log.template.md     # the decision-log.md seed (read-only — copied into a category to use)
├── .mapping.json                # ADR registry/index (adrs, dependsOn, subdomainType; stores no code paths and no PRD reference)
├── identity/                       # BOUNDED CONTEXT (core subdomain)
│   ├── 0001-token-rotation.md      # a cross-cutting decision for the whole context (directly under the parent folder)
│   ├── decision-log.md             # (optional) this category's major decision-change history — a convention file, not in the mapping
│   ├── login/                      # feature (vertical slice — includes UI/API/Data)
│   │   └── NNNN-kebab-title.md
│   └── signup/                     # feature
│       └── NNNN-kebab-title.md
├── ordering/                       # BOUNDED CONTEXT (core subdomain)
│   ├── checkout/                   # feature
│   │   └── NNNN-kebab-title.md
│   └── refund/                     # feature
│       └── NNNN-kebab-title.md
├── pricing/                        # BOUNDED CONTEXT (supporting subdomain) — flat when single-feature
│   └── NNNN-kebab-title.md
└── payments/                       # BOUNDED CONTEXT (generic subdomain) — external gateway integration
    └── NNNN-kebab-title.md
```

Rules:

- Create top-level folders **per bounded context (DDD domain)** — the model boundary a domain expert recognizes (`identity/`, `ordering/`, `catalog/`, `billing/`). When one context holds several features, put those features in sub-folders.
- Create sub-folders **per feature (vertical slice) as the user perceives it** (`identity/login/`, `ordering/checkout/`). Within one feature, the UI, API, and data decisions all gather in the same sub-folder (or in the flat folder of a single-feature context) — a single diagram should show the user action → API → store flow end to end.
- **Forbidden (at both layers)**: never use technical layer names such as `frontend/`, `backend/`, `api/`, `ui/`, `db/`, `controllers/`, or `services/` for either a context folder or a feature sub-folder. Scattering one feature's decisions by layer breaks vertical-slice tracing.
- Put a cross-cutting decision spanning a whole context (e.g. the token rotation policy for all of `identity/`) **directly under that context folder** (`identity/0001-token-rotation.md`) — that is the home for a decision belonging to no single feature sub-folder.
- Create a system-wide cross-cutting context (`infra/`, `integration/`, `security/`, `platform/`) only when two or more contexts or features explicitly depend on it (see "cross-cutting contexts — only genuinely shared decisions" below).
- A key is **at most 2 segments** (`<context>` or `<context>/<feature>`). It never goes deeper.
- Filename: `NNNN-kebab-case-title.md`. The number increases sequentially within that folder (directly under a context, or in a feature sub-folder).
- When you add a new context or feature folder, update the category key and the `adrs[]` paths in `.mapping.json`. The tree above is a conceptual example this document holds, so amend it only when it diverges badly from the real layout ([`README.md`](./README.md) keeps only the conceptual index, with neither a tree nor a per-ADR list).

> **Terminology**: in this document "category" is the neutral term for a single entry key in `.mapping.json` — `identity` for a single-feature context, `identity/login` for a multi-feature one; they differ only in segment count and both are one category entry. "Bounded context" refers to the top-level folder (the domain boundary), and "feature (vertical slice)" to the leaf (one user action).

### When a context grows — splitting into feature sub-folders

As ADRs accumulate, decisions pile up in one context (or feature folder) until the number alone no longer tells you what an ADR covers. While preserving the principle that a context holds several features, you may **unfold a flat (single-feature) context into feature sub-folders**, keeping just one level of sub-folder. This is the normal path by which a flat key (`pricing`) grows into a two-segment key (`identity/login`).

**Split threshold**: propose a split when **15 or more** ADRs have piled up flat in one feature sub-folder or directly under a context. If a context is already divided into several feature sub-folders and each holds fewer than 15, do not split — even when the context's total is large (a context holding several features is normal). Keeping the flat structure is the default — splitting too early carves one feature into fragments and weakens vertical-slice tracing.

**Split rules**:

- **At most one level deep**: only as far as `docs/adr/<context>/<feature>/NNNN-...md`. Never create a second level (`identity/login/social/...` is forbidden).
- **A sub-folder is a feature (vertical slice)**: cut along the unit the user perceives, mapping 1:1 onto an ALPS Section 7 feature — groupings that correspond to one user action, such as `identity/login/`, `identity/signup/`, `identity/password-reset/`, `ordering/checkout/`, `ordering/refund/`. The UI/API/Data decisions must all be contained within the sub-folder.
- **Forbidden sub-folders**: **technical layer splits** such as `identity/api/`, `identity/db/`, `identity/components/`, `identity/services/` — as with the anti-pattern category rule, they break the vertical slice. Even after a split, UI → API → Data must gather within one sub-folder.
- **Numbering policy**: start `NNNN` fresh inside the sub-folder. Do not rearrange existing ADR numbers when splitting — keep the gaps, track them through git history, and simply move the bodies as-is. (For the overall renumber policy see [`authoring-rules.md`](./authoring-rules.md) "Conventions" — renumbering is a step exclusive to `adr-rollup`.)
- **A feature sub-folder vs a sibling context (`identity-sso/`)**: if two features are genuinely independent model boundaries and share almost no cross-cutting decisions, sibling contexts (`identity/`, `identity-sso/`) are cleaner. Use feature sub-folders only when a shared decision (e.g. `identity/0001-token-rotation.md`) must remain in the parent folder inside one context.
- **The `.mapping.json` index**: when sub-folders appear, register `identity/login` and `identity/signup` as separate category keys, and update the `adrs[]` paths of the moved ADRs to the new sub-folder paths. A cross-cutting ADR left directly under the context (e.g. `identity/0001-token-rotation.md`) stays in the parent context key's `adrs[]`.
- **Key policy**: register feature sub-folders as separate category entries too — keeping the slash, as in `identity/login`. When a category key matches the feature directory name it makes a good first candidate for "Finding the related code", so keep the key format consistent. `subdomainType` (core/supporting/generic) lives on the context-level entry (see "The ADR registry (.mapping.json)" below).

```
docs/adr/
├── README.md
├── .mapping.json
├── identity/                    # bounded context (the parent)
│   ├── 0001-token-rotation.md   # a cross-cutting decision spanning all of identity (stays in the parent)
│   ├── login/                   # feature (vertical slice)
│   │   ├── 0001-password-policy.md
│   │   ├── 0002-rate-limit.md
│   │   └── decision-log.md      # (optional) the login feature's major decision-change history
│   └── signup/
│       └── 0001-email-verification.md
└── ordering/
    └── 0001-...md               # below the threshold (15), do not split (a single-feature context, flat)
```

**When not to create sub-folders**:

- Fewer than 15 ADRs — keep the flat structure (leave it as a single-feature context).
- Many ADRs that are all the same feature — that is more likely an evolution chain for `/adr-rollup` to handle. Compress with a rollup first, and split only if it is still bloated afterward.
- Do not split when the vertical-slice boundary is ambiguous — cutting it wrong scatters one decision across two folders.

**The inspect-and-propose procedure** (called in common by `/adr-new` and `/adr-sync` whenever they touch a category):

1. Count the `*.md` files in the target folder (a feature sub-folder or directly under a context) — based on the actual files, not the mapping's `adrs[]`.
2. **Below 15, proceed as-is.** Do not even propose a split.
3. **At 15 or more, propose once.** If the user declines, do not ask again in the same session and continue — the split is never forced.
4. When proposing, show the feature candidates too. Skim the existing ADR titles and one-line Decision summaries, group them into units the user perceives (one action such as login, signup, or password reset), and map them directly onto ALPS Section 7 features if those exist. Leave cross-cutting ADRs spanning the whole context directly under the parent folder, and never offer a technical layer split (see "Anti-pattern categories" below) as a candidate.
5. Once the split is agreed, move the folders per the split rules above (one level deep, `.mapping.json` index and keys).
6. If you see an evolution chain for the same logical decision, recommend `/adr-rollup` before splitting — scattering a chain by splitting makes it harder to trace.

> `/adr-rollup` focuses solely on compressing evolution chains and never proposes a split — mixing the two would leave the user carrying too many decisions in one cycle.

## Implementation references

- ALPS PRD: `prd/<doc>.alps.xml` (planning source before handoff; after complete transfer it remains a legacy planning document and normal ADR implementation does not read it. Explicit re-import may read it as a change proposal, but the mapping never references this path)
- Mapping: `docs/adr/.mapping.json` (the ADR registry/index. **It stores no code paths and no PRD reference** — the related code is found by reading the ADR each time)

> **Recommended**: state your project's **feature entry points** below this section. In a vertical-slice structure, one feature's UI/API/Data code gathers in the same folder tree, so the feature (leaf) → entry point mapping is naturally 1:1. A context usually holds several features, so context → code may be 1:many.
>
> Examples:
>
> - `identity/login/` ADRs → `src/features/login/` (UI components, handlers, and the token policy all included)
> - `identity/signup/` ADRs → `src/features/signup/`
> - `ordering/checkout/` ADRs → `src/features/checkout/`
> - Cross-cutting ADRs directly under `identity/` → context-wide code (`src/features/identity/shared/`, etc.)
> - `infra/` ADRs (system-wide cross-cutting) → `src/shared/infra/`, `infra/`
>
> Since an ADR body references only down to folder granularity, recording the entry-point mapping in this section lets a reviewer find the code quickly. If one feature's decisions scatter across several entry points, that is itself a signal of a vertical-slice violation.

## Common contexts and subdomains

The bounded context (domain) folder is the default, and the features inside it own the UI → API → Data slice. The DDD subdomain classification (core/supporting/generic) is **optional metadata** expressed as `subdomainType` in `.mapping.json` — it is a field on the entry rather than a folder level, and it is never enforced.

### Core / supporting subdomain contexts — the default

The core domains the product's competitiveness rests on (core) and the domains that support them without being differentiators (supporting). Each context holds one or more features (vertical slices), and each feature covers everything from UI through API to data.

| Context (subdomain)       | The features (vertical slices) it holds and the decisions it covers                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity/` (core)        | `login/`, `signup/`, `sso/` — form UX, token policy, the users table key pattern (with cross-cutting items such as token rotation directly under the context) |
| `catalog/` (core)         | `listing/`, `search/`, `filter/` — list UI, search API, index structure                                                                                       |
| `ordering/` (core)        | `checkout/`, `cancel/`, `status/` — checkout UI, order API, the order state machine                                                                           |
| `billing/` (supporting)   | `plan/`, `payment/`, `refund/` — payment UI, the payment gateway, transaction records                                                                         |
| `messaging/` (supporting) | `chat/`, `thread/`, `notification/` — chat UI, WebSocket connections, message storage                                                                         |

### Generic subdomains and system-wide cross-cutting contexts — only genuinely shared decisions

Domains that are not differentiators and can be replaced by off-the-shelf products (generic), or cross-cutting concerns that two or more contexts and features depend on for the same decision. A DB or infrastructure decision belonging to one feature alone stays in that feature's folder (or directly under its context).

| Context (subdomain)      | The decisions it covers                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `data/` (generic)        | The single-table design several features share, global key conventions, migration strategy                   |
| `infra/` (generic)       | Deployment topology, monitoring and alerting, CDN, cost optimization — affects the whole system              |
| `integration/` (generic) | Integration policy for external services several features depend on together (LLM, payments, mail, push)     |
| `security/` (generic)    | Secret management, the token rotation policy, audit logs — system-wide policy                                |
| `platform/` (generic)    | Routing conventions, the design system, shared state management — the conventions every feature's UI follows |

### Anti-pattern categories (forbidden for both context folders and feature sub-folders)

Never use these names for either a context folder or a feature sub-folder — they scatter one feature's decisions and break the vertical slice.

- `frontend/`, `backend/`, `mobile/`, `web/` — technical layer or platform units
- `api/`, `ui/`, `db/`, `cache/` — system layer units
- `controllers/`, `services/`, `repositories/` — code structure units
- `bugfix/`, `refactor/` — work-type units (not ADR material to begin with)

> **A DDD caution**: a bounded context is a **model boundary**, not a technical layer. `identity/` (a domain) is fine, but `identity/api/` (a layer) is forbidden — the subdomain classification (core/supporting/generic) is merely metadata indicating which domain is core to competitiveness, not an instruction to carve folders into layers.

## The ADR registry (.mapping.json)

`docs/adr/.mapping.json` is this project's **single ADR index** — it records category (key) → `adrs` (each adr = `{path, status, summary}`) plus the `dependsOn` between categories. **It stores neither code paths nor a PRD reference** (adr-writer is standalone and does not reference ALPS). The location of the code an ADR governs is found by reading the ADR's Decision and searching the repo each time (see "Finding the related code" below). Even when a refactor changes the code structure, the mapping needs no edit — if the decision did not change, neither the ADR nor the mapping changes.

```json
{
  "$schema": "https://raw.githubusercontent.com/haandol/alps-writer-plugins/main/plugins/adr-writer/templates/adr/mapping.schema.json",
  "categories": {
    "identity": {
      "feature": "Identity & Access",
      "subdomainType": "core",
      "adrs": [
        {
          "path": "docs/adr/identity/0001-token-rotation.md",
          "status": "Accepted (2026-02-14)",
          "summary": "refresh tokens rotate with a 7-day expiry, and the family is revoked on reuse detection"
        }
      ]
    },
    "identity/login": {
      "feature": "Login",
      "adrs": [
        {
          "path": "docs/adr/identity/login/0001-password-policy.md",
          "status": "Accepted (2026-03-02)",
          "summary": "fixes the minimum length and complexity rules and the argon2id hashing policy"
        }
      ],
      "tableDocs": ["docs/tables/users.md"]
    },
    "catalog/search": {
      "feature": "Catalog Search",
      "subdomainType": "core",
      "adrs": [
        {
          "path": "docs/adr/catalog/search/0001-listing-search.md",
          "status": "Proposed",
          "summary": "listing search runs on an inverted index plus prefix filters, with the sort key separated"
        }
      ],
      "dependsOn": ["identity/login"],
      "tableDocs": ["docs/tables/listings.md"]
    }
  }
}
```

The mapping file is created and updated by `/adr-new` (creating the empty skeleton and writing the entry) and `/feature-to-adr` (bulk-converting ALPS Section 7). Category keys are derived canonically from the feature name (`login`, `identity/login`), and the Feature ID is **stored nowhere** — `/adr-impl` resolves targets by category key alone, so there is no need to preserve the ID separately. Only for workshop or number-based PRDs, where no feature name yields a meaningful kebab, are `f1` and `f2` used as fallback keys — and then `f1` is an ordinary literal category key, so `/adr-impl f1` matches it normally (key matching, not Feature ID matching).

- `adrs` — the array of ADR records belonging to this category. Each item is a `{ path, status, summary }` object: `path` is the repo-relative ADR path, `status` mirrors the ADR body's `## Status` line verbatim (`Proposed` | `Accepted (YYYY-MM-DD)` | `Deprecated (YYYY-MM-DD)` | `Superseded by [ADR ...](...)`), and `summary` is the one-line Key Decision summary. **This array is the ADR index** — the README keeps no separate list, and admitted work reads these records on demand before code changes. Update `status` and `summary` whenever the body changes (`/adr-impl` and `/adr-sync` keep `status` in lockstep with the body's `## Status`).
- `subdomainType` — the context's DDD subdomain classification (`core`/`supporting`/`generic`). It is **optional, advisory metadata**: never enforced, never asked about by `/adr-new` every time, and when present it is displayed by `/adr-sync` or used during on-demand mapping inspection. Put it on the context-level entry (the top segment, or a single-feature flat entry) — a feature sub-folder entry conceptually inherits the parent context's classification, so it may be omitted. Omit it when unknown (the mapping is valid without it).
- `dependsOn` — the array of prerequisite category keys this category depends on. `/adr-impl`'s prerequisite gate reads it to order the prerequisite ADRs first. When an ALPS exists, `/feature-to-adr` carries it over from Section 6.3; when authored directly with `/adr-new` and no ALPS, it records the prerequisites the author named. **Reference only existing category keys and keep it acyclic (no self-edge)** — step 6 of `/adr-sync` checks for dangling references and cycles. An edge **may cross a context boundary** (e.g. `catalog/search` depending on `identity/login` — the normal case of a relationship between DDD contexts showing up as an ADR dependency).

### Decision log (decision-log.md) — a convention file not registered in the mapping

Each category folder (`docs/adr/<category>/`) may optionally hold one `decision-log.md` — a file holding that category's **major decision-change history** (replacing the adopted alternative, changing the core algorithm or architecture, inverting a Driver, retirement) in reverse order. Since an ADR body describes only the current state, this log preserves the timeline of "what changed and why". For the recording criteria see `authoring-rules.md` "What to log — minor vs major".

- **Create it by copying the seed** — on the first major transition, copy `docs/adr/decision-log.template.md` (or `${CLAUDE_PLUGIN_ROOT}/templates/adr/decision-log.template.md` if absent) to `docs/adr/<category>/decision-log.md` and fill in `<category>` and the entry. Never rewrite the format from memory. **Do not create it before there is a transition to record** — never pre-place an empty log.
- **Do not register it in `.mapping.json`** — the log is a convention file, not an ADR. The mapping schema has no field such as `decisionLog` (entries are `additionalProperties:false`), and the skills only check whether it exists in the category folder.
- **It is not checked as an ADR** — `adr-structure-lint` enumerates only files starting with `NNNN-` as ADRs, so `decision-log.md` is caught by none of the per-ADR checks, index consistency, or orphan detection. `/adr-sync`'s full disk enumeration of ADRs excludes this file too. **But the harness does verify that the log's ADR pointer resolves** (`decision-log-link-broken`) — after a rollup renumber, an unfixed pointer leaves the log pointing at a vanished path, which neither the stale-citation finder (which looks for `<cat>/NNNN` tokens) nor R10 (which reads only `NNNN-*.md` bodies) would catch. (The `decision-log.template.md` seed at the root is scaffolding and is excluded.)
- **The reference direction is one-way, log → ADR** — the log holds only the `current ADR` link and never references code or the PRD. An ADR body (Related included) never links back to the log.
- Who creates and updates it: `/adr-impl` and `/adr-sync` (append or harvest on a major decision change), and `/adr-rollup` (harvesting a chain's major transitions). For the detailed flow see each skill.

### Finding the related code

When `/adr-sync`, `/adr-impl`, `/adr-rollup`, and others verify an ADR's code alignment, they narrow down the code that ADR governs on every run as follows (the reason paths are not stored in the mapping: to keep a code-structure change from dragging along the stable layers, the mapping and the ADR):

1. Extract domain keywords (entity names, actions, API paths, state values) from the ADR's Decision, Mermaid diagrams, and title.
2. Find the code those keywords live in with `Glob`/`Grep` — in a vertical-slice project this is usually `src/features/<feature>/`, while in a layered monorepo it is scattered across several layer folders (`packages/web/...`, `services/...`). The category key (`auth`, `orders`) often matches a directory name, so take that as the first candidate.
3. Cross-check that the scope you found matches the ADR's Decision, then verify within that scope. Reuse a scope once found only for the duration of that command, and never persist it in the mapping.

**No guessing**: never assert a scope without having looked at the codebase — always confirm the real structure with `Glob`/`Grep` before verifying.

<!-- adr-writer:rules-version 0.8.23 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
