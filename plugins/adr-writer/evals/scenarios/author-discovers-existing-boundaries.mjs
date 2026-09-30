import path from "node:path";
import { existsSync } from "node:fs";
import { skillText, write, read, TAIL_SPEC } from "../lib/harness.mjs";

export const fixtureFiles = {
  "package.json": '{"private":true,"workspaces":["packages/*"]}\n',
  "README.md":
    "Ordering owns order submission and confirmation across checkout and worker packages. Billing owns payment settlement with a separate model. Historical limit rationale is unknown.\n",
  "deploy.md":
    "Checkout, order-worker and settlement deploy independently from this single repository. A referenced fulfillment repository is unavailable.\n",
  "packages/checkout/backend/submit.mjs":
    "export const submit = (items, member) => { if (!member || items.length < 1 || items.length > 3) throw Error('invalid order'); return {items, state:'submitted'}; };\n",
  "packages/order-worker/services/confirm.mjs":
    "export const confirm = order => { if(order.state !== 'submitted') throw Error('invalid transition'); return {...order, state:'confirmed'}; };\n",
  "packages/settlement/backend/pay.mjs":
    "export const settle = (payment, success) => payment.completed || !success ? payment : {...payment,completed:true};\n",
};

/** Check produced artifacts and protected inputs; a semantic judge checks the discovered grouping. */
export function score({ dir, events = [] }, reportPath = ".adr-review/discovery/report.md") {
  const report = read(dir, reportPath) ?? "";
  const requests = events.filter((e) => e.kind === "request");
  const readPaths = requests
    .filter((e) => e.tool === "read_file")
    .map((e) => e.arguments?.path ?? "");
  return [
    {
      label: "a discovery report was produced",
      pass: report.trim().length > 100,
      detail: report.slice(0, 120),
    },
    {
      label: "application and topology inputs stay unchanged",
      pass: Object.entries(fixtureFiles).every(([file, body]) => read(dir, file) === body),
      detail: "compare every supplied input",
    },
    {
      label: "captured mutations stay in the requested report",
      pass: requests.every(
        (e) =>
          !["write_file", "delete_file", "move_file", "demote_adr_status"].includes(e.tool) ||
          (e.tool === "write_file" &&
            path.resolve(dir, e.arguments?.path ?? "") === path.join(dir, reportPath)),
      ),
      detail: "reject transient source writes even if restored",
    },
    {
      label: "no contract index is saved before approval",
      pass: !existsSync(path.join(dir, "docs/adr/.mapping.json")),
      detail: "official index remains absent",
    },
    {
      label: "fixture execution captured repository discovery",
      pass: ["package.json", "deploy.md", "packages/checkout/backend/submit.mjs"].every((file) =>
        readPaths.some((p) => p === file || p.endsWith("/" + file)),
      ),
      detail: readPaths.join(", "),
    },
  ];
}

export default {
  name: "author-discovers-existing-boundaries",
  description:
    "Inspect an existing layered monorepo before proposing business-scoped ADRs, preserving exact rules and unavailable-repository limits without saving unapproved contracts.",
  obligations: [
    {
      id: "discovery",
      text: "Use actual repository evidence to distinguish one monorepo from three independently deployed services; group checkout and worker under Ordering, settlement under Billing. Preserve the 1..3 item/member rules and valid confirmation transition. Ask for missing intent rather than inventing it. Do not claim access to fulfillment or change application sources or official ADR/index.",
    },
  ],
  score,
  deterministicScore: score,
  build(dir) {
    for (const [file, body] of Object.entries(fixtureFiles)) write(dir, file, body);
    return [
      skillText("adr-new", { references: ["references/feature-boundaries.md"] }),
      `# This run
Inspect the existing project at ${dir} and prepare a proposed order-submission
decision from the actual code. The user has not approved a contract or supplied
historical intent. Use the available fixture read tools to discover the project.
Do not create or change official docs/adr or its index. Do not change supplied
application, topology or project files. You may write only the disposable report
.adr-review/discovery/report.md; this scenario requests Markdown explicitly.
State the project shape, business ownership, exact observed rules and remaining
questions. Keep unsupported rationale unconfirmed. Do not execute cloud/network
commands or infer another repository's internals.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
