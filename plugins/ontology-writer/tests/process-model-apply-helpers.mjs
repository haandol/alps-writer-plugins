// The example model, its ADR index and the draft, impact, apply and renewal helpers the
// process-model save tests share.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import {
  elementIri,
  indexGraph,
  parseTurtle,
  processStatus,
} from "../scripts/process-model-lib.mjs";
import { cachedRepo, commitAll, initRepo, write } from "./helpers.mjs";
import { ACCEPTED, CLI, EXAMPLE, cli, exits, json } from "./process-model-helpers.mjs";

export { ACCEPTED, CLI, EXAMPLE, cli, exits, json };

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
export const GLOSSARY = "| Term | Meaning |\n| --- | --- |\n| Settlement | paying sellers |\n";
export const SETTLED = '"The money for an order was collected and settled."';
export const STEP_EDIT = [
  '"The customer authorizes the card charge for the order."',
  '"The customer approves the card charge."',
];
export const ORDER_EDIT = [
  '"The customer sends the cart as an order."',
  '"The customer sends the cart."',
];
export const OPEN_PATH = '"Retrying after the payment provider declines a card."^^pm:OpenPath';
export const MORE_OPEN_SCOPE = `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`;
export const PAYMENT_STATUS = 'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment';
/** The index with the payment feature linked to no step. */
export const UNLINKED = {
  categories: { ...MAPPING.categories, payments: { ...MAPPING.categories.payments, realizes: [] } },
};
export const PREFIXES = EXAMPLE.slice(0, EXAMPLE.indexOf("m:customer a pm:Actor"));
/** The model's actors as a document of their own; model.ttl states every triple too. */
export const ACTORS = EXAMPLE.slice(0, EXAMPLE.indexOf("m:ordering a pm:BoundedContext"));
export const AUDITOR =
  'm:auditor a pm:Actor ;\n    rdfs:label "Auditor" ;\n    pm:definition "Checks the books." .\n';

export const read = (dir, rel) => readFileSync(path.join(dir, rel), "utf8");

export function repo(dir, model = ACCEPTED, mapping = MAPPING) {
  cachedRepo(dir, JSON.stringify(["apply", model, mapping]), (at) => {
    initRepo(at);
    write(at, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    write(at, "docs/adr/glossary.md", GLOSSARY);
    write(
      at,
      "docs/adr/checkout/0001-a.md",
      "# ADR 0001: a\n\n## Status\n\nAccepted (2020-01-01)\n",
    );
    write(
      at,
      "docs/adr/payments/0001-b.md",
      "# ADR 0001: b\n\n## Status\n\nAccepted (2020-01-01)\n",
    );
    write(at, "docs/process/model.ttl", model);
    commitAll(at, "base");
  });
}
/** A disposable draft holding every current model document, then the edited model. */
export function draft(dir, text) {
  rmSync(path.join(dir, "draft"), { recursive: true, force: true });
  cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), { recursive: true });
  rmSync(path.join(dir, "draft/change-log.md"), { force: true });
  if (text !== undefined) write(dir, "draft/model.ttl", text);
}
export const impact = (dir, args = []) =>
  JSON.parse(cli(dir, ["impact", "--draft", "draft", "--json", ...args]).out);
export const apply = (dir, hash, args = []) =>
  cli(dir, ["apply", "--draft", "draft", "--base-hash", hash, ...args]);
export const today = () => new Date().toLocaleDateString("sv-SE");
export const statusOf = (dir, id) =>
  processStatus(
    indexGraph(parseTurtle(read(dir, "docs/process/model.ttl")).triples),
    elementIri(id),
  );
/** The Accepted model with `payment.take-payment` in another Status. */
export const paymentIn = (status) =>
  ACCEPTED.replace(PAYMENT_STATUS, `pm:status "${status}" ;\n    pm:hasStep m:payment`);
export const unsynced = (dir, id) =>
  json(dir, ["changes"]).unsyncedAccepted.find((u) => u.process === id);

/** A direct-edit save as process sync makes it: the summary against `base`, then the save it binds. */
export function directSave(dir, { base = "HEAD", args = [], save = [] } = {}) {
  const { baseHash } = json(dir, ["impact", "--base", base, ...args]);
  return cli(dir, ["apply", "--base", base, "--base-hash", baseHash, ...args, ...save]);
}

export const WORDING = ["--same-meaning", "payment.request-payment=rdfs:label"];
/**
 * Save, through a draft of the current model, a payment step label reworded and
 * confirmed to keep its meaning; with the Status of `payment.take-payment`
 * before and after the save.
 */
export function saveWording(dir) {
  const before = statusOf(dir, "payment.take-payment");
  draft(
    dir,
    read(dir, "docs/process/model.ttl").replace(
      'rdfs:label "Request the payment"',
      'rdfs:label "Ask for the payment"',
    ),
  );
  const saved = apply(dir, impact(dir, WORDING).baseHash, WORDING);
  return { ...saved, before, after: statusOf(dir, "payment.take-payment") };
}
/** The wording was saved, the Accepted date of `payment.take-payment` stayed, and the output says why. */
export function assertNotRenewed(saved, why) {
  assert.equal(saved.code, 0, saved.out);
  assert.equal(saved.after, saved.before, "the Accepted date stays");
  assert.doesNotMatch(saved.out, /Accepted renewed/);
  assert.match(saved.out, /⚠ Accepted date of payment\.take-payment not renewed:/);
  assert.match(saved.out, why);
}

export const RETURNS = `@prefix m: <urn:ontology-writer:model:> .
@prefix pm: <urn:ontology-writer:process:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:returns a pm:Process ;
    rdfs:label "Returns" ;
    pm:definition "The store takes back a delivered order." ;
    pm:startCondition "A customer returns an order." ;
    pm:businessOutcome "The order is taken back." ;
    pm:openScope "none"^^pm:NoOpenScope ;
    pm:status "Deprecated (2020-01-01)" ;
    pm:hasStep m:returns.take-back .

m:returns.take-back a pm:Step ;
    rdfs:label "Take the order back" ;
    pm:definition "The customer hands the order back." ;
    pm:stepKind "outside-system" ;
    pm:inContext m:ordering .

m:customer pm:performs m:returns.take-back .

m:returns.taken-back a pm:ObservationCriterion ;
    rdfs:label "A returned order is taken back" ;
    pm:startCondition "A customer returns an order." ;
    pm:observedResult "The order is taken back." ;
    pm:criterionOf m:returns .
`;

/** Whether `dir` lies inside a git work tree, so a test meant outside git cannot run there. */
export function insideGit(dir) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
