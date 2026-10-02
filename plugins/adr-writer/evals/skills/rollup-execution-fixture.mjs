// Valid synthetic ADRs for local execution traces. No verifier expectations or
// positive/mutant tool sequences are exported with these raw inputs.
function adr(number, title, decision, related = "- None", status = "Accepted (2026-09-01)") {
  return `# ADR ${number}: ${title}

Date: 2026-09-01

## Status

${status}

## Purpose

Users need a predictable policy while implementation details can change.

## Decision Drivers

- Preserve the account's required retention and recovery window.
- Keep independently owned permissions explicit.
- Preserve the reason for adopted changes.

## Decision

${decision}

### Alternatives

- Indefinite retention was rejected because expiry must remain possible.
- Unconditional deletion was rejected because audit access must be preserved.

## Consequences

Expiry and permission need separate verification before deletion.

## Related

${related}
`;
}

export function buildRollupExecutionFixture() {
  const files = {
    ".gitignore": ".adr-review/\n",
    "package.json": '{"private":true,"type":"module"}\n',
    "docs/adr/storage/0001-retention.md": adr(
      "0001",
      "Retention",
      "Standard accounts retain data for 30 days and regulated accounts for 90 days. Deletion requires compliance clearance. These periods allow recovery while bounding retention.",
      "- [Clearance](../compliance/0001-clearance.md)",
      "Superseded by [ADR 0002](./0002-retention.md)",
    ),
    "docs/adr/storage/0002-retention.md": adr(
      "0002",
      "Retention revision",
      "Adopted 40 days for standard accounts to allow more recovery time, replacing only the original standard period. Regulated retention and compliance clearance remain unchanged.",
      "- [Original contract](./0001-retention.md)",
      "Superseded by [ADR 0003](./0003-retention.md)",
    ),
    "docs/adr/storage/0003-retention.md": adr(
      "0003",
      "Standard retention",
      "Adopted 45 days for standard accounts to allow more recovery time, replacing only the prior standard period. Regulated retention and compliance clearance remain unchanged.",
      "- [Prior revision](./0002-retention.md)\n- [Clearance](../compliance/0001-clearance.md)",
    ),
    "docs/adr/compliance/0001-clearance.md": adr(
      "0001",
      "Deletion clearance",
      "Expiry alone never permits deletion. Clearance is governed by the allowed audit states in the audit-state decision.",
      "- [Audit states](./0002-audit-state.md)",
    ),
    "docs/adr/compliance/0002-audit-state.md": adr(
      "0002",
      "Audit states",
      "An open audit blocks deletion for both account types. Closed audits permit clearance. Preserve access while an audit remains open.",
    ),
    "docs/adr/billing/0001-retries.md": adr(
      "0001",
      "Retry limit",
      "Allow one retry of an unsettled payment, preserving payment identity. Never settle a payment twice.",
      "- None",
      "Superseded by [ADR 0002](./0002-retries.md)",
    ),
    "docs/adr/billing/0002-retries.md": adr(
      "0002",
      "Retry revision",
      "Allow three retries of an unsettled payment to allow more recovery attempts. Replace only the original retry limit; stable identity and single settlement remain required.",
      "- [Original retry contract](./0001-retries.md)",
    ),
    "docs/adr/notifications/0001-delivery.md": adr(
      "0001",
      "Notification delivery",
      "Deliver at most once per notification key. This decision is independently current.",
    ),
    "docs/ops/retention-link.md":
      "# Operator reference\n\n[Retention](../adr/storage/0001-retention.md)\n",
    "src/retention.mjs":
      "export const canDelete = (days, regulated, openAudit) => !openAudit && days >= (regulated ? 90 : 45);\n",
    "src/billing.mjs": "export const canRetry = (attempts, settled) => !settled && attempts < 3;\n",
    "src/notifications.mjs": "export const deliveryAttempts = 1;\n",
    "deploy.md": "Notifications deploy separately from the retention worker.\n",
    "test/policy.test.mjs": `import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canDelete} from '../src/retention.mjs';
import {canRetry} from '../src/billing.mjs';
test('retention and audit clearance', () => {
  assert.equal(canDelete(44, false, false), false);
  assert.equal(canDelete(45, false, false), true);
  assert.equal(canDelete(89, true, false), false);
  assert.equal(canDelete(90, true, false), true);
  assert.equal(canDelete(100, false, true), false);
});
test('retry cap and settlement', () => {
  assert.equal(canRetry(2, false), true);
  assert.equal(canRetry(3, false), false);
  assert.equal(canRetry(0, true), false);
});
`,
  };
  const categories = {};
  for (const [path, body] of Object.entries(files)) {
    const match = path.match(/^docs\/adr\/([^/]+)\/\d{4}-/);
    if (!match) continue;
    const category = (categories[match[1]] ??= {
      feature: match[1],
      adrs: [],
      dependsOn: match[1] === "storage" ? ["compliance"] : [],
    });
    category.adrs.push({
      path,
      status: body.match(/## Status\s+([^\n]+)/)[1],
      summary: body.match(/^# ADR \d+: (.+)/)[1],
    });
  }
  files["docs/adr/.mapping.json"] = JSON.stringify({ categories }, null, 2) + "\n";
  return files;
}
