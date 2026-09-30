const DATE = "2026-09-30";
const document = (
  domain,
) => `# ADR 0001: ${domain === "ordering" ? "Member order submission" : "Payment completion"}

Date: ${DATE}

## Status

Proposed

## Purpose

${domain === "ordering" ? "Members submit bounded orders for manual fulfillment." : "Provider failure must not look like completed payment."}

## Decision Drivers

- Preserve the confirmed user outcome.
- Reject an invalid transition.
- Keep the current reason independent of unknown history.

## Decision

${domain === "ordering" ? "Only members submit one through three items; only submitted orders can be confirmed." : "Provider success completes pending payment; failure leaves it pending and completed results stay completed."}

### Requirement contract

- ${domain === "ordering" ? "Members submit 1 to 3 items; submitted is the only state that can become confirmed." : "Provider failure never completes pending payment; completed results remain completed on later success or failure."}

### Alternatives

1. Preserve the confirmed contract so callers observe stable results.
2. Adopt new behavior after a separate policy decision; existing behavior would change.

## Consequences

Current intent is recorded, while unknown historical motives remain unknown.
`;

export function adopt(tools, domains, { status = "Proposed", omit = [] } = {}) {
  const categories = {};
  for (const domain of domains) {
    const file = `docs/adr/${domain}/0001-${domain}.md`;
    if (!omit.includes(domain))
      tools.call("write_file", {
        path: file,
        content: document(domain).replace("\nProposed\n", `\n${status}\n`),
      });
    categories[domain] = {
      feature: domain,
      adrs: [{ path: file, status, summary: `${domain} owns the confirmed contract.` }],
      dependsOn: [],
    };
  }
  tools.call("write_file", {
    path: "docs/adr/.mapping.json",
    content: JSON.stringify({ categories }, null, 2) + "\n",
  });
}
