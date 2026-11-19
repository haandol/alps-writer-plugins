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
