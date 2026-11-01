// Fixtures that process-model-lifecycle.test.mjs and process-model-lifecycle.integration.test.mjs share.

export const MAPPING = {
  categories: {
    checkout: {
      adrs: [
        { path: "docs/adr/checkout/0001-a.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["ordering.submit-order", "ordering.confirm-order"],
    },
    payments: {
      adrs: [
        { path: "docs/adr/payments/0001-b.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["payment.request-payment"],
    },
  },
};
