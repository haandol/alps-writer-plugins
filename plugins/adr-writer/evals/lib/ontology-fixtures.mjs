// Fixture helpers for business-context scenarios: the shipped template model, the real
// ontology-writer query CLI and session directive run inside the fixture, so a prompt shows
// exactly what an agent in that repository would see.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { ONTOLOGY_PLUGIN_ROOT, ontologySkillText, ruleText, TAIL_SPEC } from "./harness.mjs";

export const EXAMPLE_MODEL = readFileSync(
  path.join(ONTOLOGY_PLUGIN_ROOT, "templates", "ontology", "example.ttl"),
  "utf8",
);
const CLI = path.join(ONTOLOGY_PLUGIN_ROOT, "scripts", "ontology.mjs");
const HOOK = path.join(ONTOLOGY_PLUGIN_ROOT, "hooks", "surface-business-context.mjs");

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

/** The text `ontology.mjs query <args>` prints in the fixture; a non-zero exit is part of it. */
export function ontologyQuery(dir, args) {
  const result = run(process.execPath, [CLI, "query", ...args], { cwd: dir });
  return `${result.stdout}${result.stderr}`.trim();
}

/**
 * Commit everything in the fixture, creating its repository on first use. The author and date
 * are fixed, so the same fixture gets the same commit id and the prompt stays reproducible.
 */
export function commitFixture(dir, message = "fixture") {
  const when = "2026-10-01T00:00:00Z";
  const env = { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
  const git = (...args) => {
    const result = run("git", args, { cwd: dir, env });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  };
  git("init", "-q");
  git("add", "-A");
  git(
    "-c",
    "user.name=eval",
    "-c",
    "user.email=eval@example.invalid",
    "commit",
    "-q",
    "-m",
    message,
  );
}

/**
 * The SessionStart directive Ontology Writer gives a new session in the fixture, with an
 * isolated, empty preference store so the user's own saved choices never leak in.
 */
export function ontologyDirective(dir, { source = "startup" } = {}) {
  const preferences = mkdtempSync(path.join(tmpdir(), "ontology-eval-preferences-"));
  const env = { ...process.env, ONTOLOGY_WRITER_PREFERENCES_DIR: preferences };
  try {
    const result = run(process.execPath, [HOOK], {
      cwd: dir,
      input: JSON.stringify({ hook_event_name: "SessionStart", source, cwd: dir }),
      env: { ...env, CLAUDE_PROJECT_DIR: dir },
    });
    if (result.status !== 0) throw new Error(`ontology hook failed: ${result.stderr}`);
    const out = result.stdout.trim();
    return out ? (JSON.parse(out).hookSpecificOutput?.additionalContext ?? "") : "";
  } finally {
    rmSync(preferences, { recursive: true, force: true });
  }
}

/** The template model with every process Accepted: a settled business reference. */
export const SETTLED_MODEL = EXAMPLE_MODEL.replaceAll(
  'onto:status "Proposed"',
  'onto:status "Accepted (2026-10-01)"',
);

/** A minimal ADR that passes the shipped structure lint. */
export function adrDocument({
  number = "0001",
  title,
  status = "Accepted (2026-10-01)",
  purpose,
  decision,
  rows,
}) {
  return `# ADR ${number}: ${title}

Date: 2026-10-01

## Status

${status}

## Purpose

${purpose}

## Decision Drivers

- The business flow stays intact across features.

## Decision

${decision}

### Requirement contract

${rows.map((r) => `- ${r}`).join("\n")}

## Alternatives

1. **Manual handling** — too slow.
2. **Automatic handling (chosen)**.

## Consequences

### Positive

- Orders move without manual work.
`;
}

/** The three realizing features of the template model, each with one Accepted ADR. */
export function settledMapping(extra = {}) {
  const record = (path, summary, status = "Accepted (2026-10-01)") => ({ path, status, summary });
  return {
    categories: {
      checkout: {
        feature: "Checkout",
        adrs: [
          record("docs/adr/checkout/0001-submit-orders.md", "orders are submitted from the cart"),
        ],
        realizes: ["ordering.submit-order"],
        dependsOn: [],
      },
      confirmation: {
        feature: "Order confirmation",
        adrs: [record("docs/adr/confirmation/0001-confirm-paid.md", "paid orders are confirmed")],
        realizes: ["ordering.confirm-order"],
        dependsOn: [],
      },
      payments: {
        feature: "Payments",
        adrs: [
          record(
            "docs/adr/payments/0001-card-capture.md",
            "card payments are captured once per order",
          ),
        ],
        realizes: ["payment.request-payment", "payment.capture-payment"],
        dependsOn: [],
      },
      ...extra,
    },
  };
}

export const PAYMENTS_ADR = adrDocument({
  title: "Capture card payments once per order",
  purpose: "Customers must never be charged twice for one order.",
  decision: "Capture the card charge through the payment provider once per order.",
  rows: [
    "An order is captured at most once; a repeated capture request returns the first result.",
    "A declined card leaves the order unpaid.",
  ],
});
export const RETRY_ADR = adrDocument({
  title: "Capture card payments once per order",
  purpose: "Customers must never be charged twice for one order.",
  decision: "Capture the card charge through the payment provider once per order.",
  rows: [
    "An order is captured at most once; a repeated capture request returns the first result.",
    "A declined card may be retried at most 3 times per order; the fourth attempt is rejected and the order stays unpaid — payment risk policy.",
  ],
});
export const CONFIRMATION_ADR = adrDocument({
  title: "Confirm paid orders",
  purpose: "A paid order is accepted for fulfilment without manual review.",
  decision: "Confirm an order once its payment is complete.",
  rows: ["A confirmed order is shown to the customer as confirmed."],
});
export const CHECKOUT_ADR = adrDocument({
  title: "Submit orders from the cart",
  purpose: "A customer can turn a cart into an order.",
  decision: "Submitting the cart creates one order.",
  rows: ["One submission creates exactly one order."],
});

/**
 * An ontology-build prompt: the shipped skill with the references this run loads (each after
 * the module that links it), the ADR concepts an agent reads alongside, then the run itself.
 */
export function buildPrompt(references, ...run) {
  return [
    ontologySkillText("ontology-build", { references }),
    ruleText("concepts.md"),
    "# This run",
    ...run,
    TAIL_SPEC,
  ].join("\n\n");
}

/** The references a candidate report reads, in the order the build skill links them. */
export const REPORT_REFERENCES = [
  "references/ontology.md",
  "references/eventstorming.md",
  "skills/ontology-build/references/candidate-review.md",
  "skills/ontology-build/references/candidates.md",
];

/**
 * A payments ADR whose contract the code honours; only a storage detail it names has drifted.
 */
export const DRIFTED_PAYMENTS_ADR = adrDocument({
  title: "Capture card payments once per order",
  purpose: "Customers must never be charged twice for one order.",
  decision: "Capture the card charge through the payment provider once per order.",
  rows: [
    "An order is captured at most once; a repeated capture request returns the first result.",
    "A declined card leaves the order unpaid; the decline is written to the `payment_failures` table.",
  ],
});
/** The capture code that honours that contract, writing declines to its own log. */
export const CAPTURE_CODE = `// payments/capture.ts
export async function capture(order) {
  const first = await ledger.find(order.id);
  if (first) return first; // a repeated request returns the first result
  const result = await provider.capture(order.id, order.total);
  await ledger.record(order.id, result);
  if (result.declined) {
    await declineLog.append(order.id, result.reason);
    return keepUnpaid(order.id);
  }
  return markPaid(order.id);
}`;

/** The one Accepted quote-approval ADR of the pre-build review-route scenarios. */
export const QUOTE_APPROVAL_ADR = {
  path: "docs/adr/sales/quotes/0001-quote-approval.md",
  status: "Accepted (2026-10-01)",
  summary: "A sales manager decides whether to approve a submitted quote",
};

/** An index whose only feature is quote approval, realized by that ADR. */
export const quoteApprovalMapping = () => ({
  categories: {
    "sales/quotes": { feature: "Quote approval", dependsOn: [], adrs: [{ ...QUOTE_APPROVAL_ADR }] },
  },
});

/**
 * The settled index as the first business-context scenarios recorded it: its checkout summary is
 * shorter, and the fixture commit (and so the query text) depends on every byte of it.
 */
export function recordedMapping() {
  const mapping = settledMapping();
  mapping.categories.checkout.adrs[0].summary = "orders are submitted";
  return mapping;
}

/** A payments ADR that takes card payments, before any compliance contract. */
export const TAKE_PAYMENTS_ADR = `# ADR 0001: Take card payments for orders

Date: 2026-10-01

## Status

Accepted (2026-10-01)

## Purpose

Customers pay for an order by card.

## Decision Drivers

- One order is charged at most once.

## Decision

Charge the order total by card through the payment provider.

### Requirement contract

- An order is charged at most once.

## Alternatives

1. **Pay on delivery** — not offered.
2. **Card payment (chosen)**.

## Consequences

### Positive

- Customers pay at checkout.
`;

/** A Proposed payments ADR announcing a completed payment, implemented in the review scenarios. */
export const ANNOUNCE_PAYMENT_ADR = `# ADR 0002: Announce a completed payment once

Date: 2026-11-01

## Status

Proposed

## Purpose

Order confirmation must learn about a completed payment exactly once, so an order is never confirmed twice or left waiting.

## Decision Drivers

- One announcement per paid order.

## Decision

After a successful capture, announce Payment completed with the order id. A declined card announces nothing.

### Requirement contract

- A successful capture announces Payment completed once, carrying the order id.
- A repeated capture of the same order announces nothing new.
- A declined card announces nothing.

## Alternatives

1. **Confirm the order directly** — couples payments to ordering data.
2. **Announce the event (chosen)**.

## Consequences

### Positive

- Confirmation reacts without knowing payment internals.
`;
