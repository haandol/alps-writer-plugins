# Current reference level

Read this module only when step 1 found a current reference level: an upper
level that stays current after handoff and that ADRs follow. ADR Writer's
business ontology in `docs/ontology/` is one. The PRD being transferred is
never a current reference level.

That level owns business-term definitions and the relationships between
features, so the same fact never has two current owners.

- Do not transfer a term it owns into the glossary. Reuse a meaning it already
  holds. Never delete or overwrite an existing glossary entry for such a term;
  that cleanup belongs to the level's own approval path.
- Send only new definitions, changed meanings and the feature relationships the
  handoff confirms to that level as change proposals, written in business
  language and shown in the same handoff approval summary as the ADR contracts.
- Transfer the feature-resolution values, conditions and compliance contracts
  that keep those relationships to the owning ADRs. A value never moves into a
  proposal.
- A repeated handoff with the same meaning creates no proposal.
- A proposal is approved only through that level's own approval path — for the
  business ontology, ontology-writer's `/ontology-edit` — never by approving the ADR
  contracts shown beside it.
- A proposal awaiting this handoff's approval summary does not block drafting.
  Until it is approved, or after it is rejected, the items that depend on its
  meaning stay Unresolved, so that Feature is not reported as transferred.
  Features that do not depend on it continue.
- Tell `/adr-new` which contract rows depend on an unapproved proposal; its
  glossary rules keep those rows pending and the ADR `Proposed`.
- For the business ontology, `/adr-new` queries each owner's
  business context and judges a Feature that realizes no step. Pass it the
  proposals already routed so it does not ask again.
- After approval the owning ADR body keeps the short explanation its contract
  needs.

Add this block to the compact preflight result:

```text
Current reference level proposals:
- <term or relationship> — <reused | proposed | approved | rejected>
```
