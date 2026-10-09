import {
  alpsSkillText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectText,
} from "../lib/harness.mjs";

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
      `In the machine-readable tail use SEMANTIC_NOOP, REMOVAL_REVIEW, and`,
      `NO_MUTATION as tags. Put each tag exactly to the left of the | separator.`,
      `Use ADR_UPDATE or CONTRACT_DELETE only if you conclude that this comparison`,
      `should immediately mutate or weaken the current ADR.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    const serialized = tail.findings
      .map((finding) => `${finding.tag} | ${finding.summary}`)
      .join("\n");
    const mutations = tail.findings.filter((finding) =>
      /ADR_UPDATE|CONTRACT_DELETE/i.test(finding.tag),
    );
    return [
      expectText(
        serialized,
        /SEMANTIC_NOOP.{0,160}30/i,
        "treats the reworded 30-day rule as no-op",
      ),
      expectText(
        serialized,
        /SEMANTIC_NOOP.{0,160}ArchiveCo/i,
        "treats the reworded ArchiveCo boundary as no-op",
      ),
      expectText(
        serialized,
        /REMOVAL_REVIEW.{0,180}24/i,
        "requires explicit review before removing the 24-hour fallback",
      ),
      expectText(serialized, /NO_MUTATION/i, "keeps the current ADR state unchanged"),
      {
        pass: mutations.length === 0,
        detail:
          mutations.map((item) => `${item.tag} | ${item.summary}`).join(" ; ") ||
          "no ADR update or contract deletion",
        label: "does not mutate or weaken the ADR during comparison",
      },
    ];
  },
};
