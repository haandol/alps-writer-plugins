import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  ontologyQuery,
  PAYMENTS_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "reported",
    text: "The query could not judge change flags (the project is not a Git work tree). The response says so with that reason instead of treating the context as unchanged.",
  },
  {
    id: "possibly-edited",
    text: "It treats the Accepted processes in the payments context as possibly edited directly until history is available and ontology sync has checked them, and does not present them as a settled reference for the ADR change.",
  },
].map((o) => ({ ...o, label: `history unknown: ${o.id}` }));

export default {
  name: "author-checks-business-history-unknown",
  description:
    "When change flags cannot be judged, ADR authoring says why and treats the Accepted processes in scope as possibly edited.",
  obligations,
  build(dir) {
    const mapping = settledMapping();
    seedRuleDocs(dir);
    seedMapping(dir, mapping);
    seedIndexedAdrs(dir, mapping, { "docs/adr/payments/0001-card-capture.md": PAYMENTS_ADR });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    const context = ontologyQuery(dir, ["--category", "payments"]);
    return [
      skillText("adr-new", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-new payments",
      "",
      "카드가 거절되면 고객에게 거절 사유를 보여 주도록 결제 결정을 고쳐 줘.",
      "",
      "docs/adr/payments/0001-card-capture.md:",
      "```markdown",
      PAYMENTS_ADR,
      "```",
      "The business-context query for `payments` returned:",
      "```text",
      context,
      "```",
      "Do not call tools or write files. Show what you would present before saving.",
      "In the tail use CHECKED_CONTEXT, HISTORY and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
