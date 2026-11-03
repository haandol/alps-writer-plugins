import { BOARD } from "./eventstorming-fixture.mjs";

/** Synthetic memberships deliberately include overlap, equal labels and missing scope. */
export function areaBoard() {
  const board = structuredClone(BOARD);
  const claim = {
    verdict: "stated",
    evidence: [
      {
        source: "Authored membership example",
        detail: "Synthetic boundary and view cases, not a real business.",
      },
    ],
  };
  board.domain = { name: "Retail", ...claim };
  for (const stage of board.stages) stage.contextId = stage.context.toLowerCase();
  board.contexts = [
    { id: "ordering", name: "Ordering", ...claim },
    { id: "payment", name: "Payment", ...claim },
    { id: "reconciliation", name: "Reconciliation", ...claim },
    { id: "partner", name: "Payment network", external: true, ...claim },
    { id: "other-ordering", name: "Ordering", ...claim },
  ];
  board.subdomains = [
    {
      id: "sales",
      name: "Sales",
      responsibility: "Taking and fulfilling purchases",
      classification: "core",
      contextIds: ["ordering", "reconciliation"],
      ...claim,
    },
    {
      id: "finance",
      name: "Finance",
      responsibility: "Collecting and reconciling money",
      classification: "supporting",
      contextIds: ["payment", "reconciliation", "partner"],
      ...claim,
    },
  ];
  const base = structuredClone(board.stages[0]);
  board.stages.push({
    ...base,
    id: "reconcile",
    contextId: "reconciliation",
    context: "Reconciliation",
    actor: "Settlement worker",
    action: "Reconcile settlement",
    event: { name: "Settlement reconciled" },
    entities: [
      { name: "Settlement", kind: "entity", before: "Pending", after: "Reconciled", ...claim },
    ],
    policies: [],
  });
  board.links.push({
    from: "pay",
    to: "reconcile",
    label: "Reconcile collected payment",
    ...claim,
  });
  board.stages[0].views = [
    {
      name: "Order form",
      role: "input",
      description: "The customer reviews the purchase before submitting it.",
      ...claim,
    },
  ];
  board.stages[2].views = [
    {
      name: "Order status",
      role: "result",
      description: "The customer checks the confirmation.",
      ...claim,
    },
  ];
  return board;
}
