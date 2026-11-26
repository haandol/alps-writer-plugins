import { alpsSkillText, seedRuleDocs, seedMapping, write, TAIL_SPEC } from "../lib/harness.mjs";

const ADR_PATH = "docs/adr/workspace/export/0001-export-retention-and-archive.md";

const ADR = `# ADR 0001: Export retention and archive

Date: 2026-08-17

## Status

Accepted (2026-08-17)

## Context

Workspace exports contain personal data and require bounded retention.

## Decision Drivers

- Privacy policy requires bounded retention.
- Legal archive storage must remain available during provider outages.
- The contract must survive implementation replacement.

## Decision

Completed workspace exports are deleted after 30 days. ArchiveCo is the external
archive boundary. During an ArchiveCo outage, the system retains an export
locally for at most 24 hours and retransmits it when the provider recovers.

### Requirement contract

- A completed export is deleted after 30 days (privacy policy).
- ArchiveCo is the authoritative long-term archive (legal approval).
- During an ArchiveCo outage, local fallback lasts at most 24 hours before retransmission.

### Alternatives

#### Keep exports indefinitely

Simpler, but violates privacy policy.

#### Use ArchiveCo with bounded local fallback

Preserves legal archive and recovery.

## Consequences

### Positive

- Retention and recovery remain explicit.

### Negative

- Provider outages require bounded local storage.

### Risks

- Missing fallback enforcement could exceed 24 hours.

## Related

- 없음
`;

const CHANGED_PRD = `
The user explicitly requested re-import of this changed PRD.

Feature: Workspace export
- Finished exports are retained for one month, exactly 30 days, then erased
  (same privacy policy).
- Long-term records continue to be held by ArchiveCo under the same legal approval.
- The previous sentence about the 24-hour local outage fallback is absent.

Compare this input with the current authoritative ADR. Do not write files.
Return the semantic comparison only.
`;

export default {
  name: "feature-handoff-idempotent-reimport",
  description:
    "/feature-to-adr explicit re-import must leave equivalent contracts untouched and must not delete an ADR obligation merely because the changed PRD omitted it.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, ADR_PATH, ADR);
    seedMapping(dir, {
      categories: {
        "workspace/export": {
          feature: "Workspace export",
          adrs: [
            {
              path: ADR_PATH,
              status: "Accepted (2026-08-17)",
              summary: "Exports use 30-day retention and ArchiveCo with a 24-hour local fallback",
            },
          ],
          dependsOn: [],
        },
      },
    });
    return [
      alpsSkillText("feature-to-adr", {
        references: ["skills/feature-to-adr/references/reimport.md"],
      }),
      `\n---\n\n# This run`,
      CHANGED_PRD,
      TAIL_SPEC,
    ].join("\n");
  },
};
