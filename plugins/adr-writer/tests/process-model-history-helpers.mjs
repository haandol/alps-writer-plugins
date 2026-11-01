// The example model, its ADR index and the fixture, CLI and transition helpers the
// process-model history tests share.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { cachedRepo, commitAll, git, initRepo, write, writeAdrFiles } from "./helpers.mjs";
import { ACCEPTED, CLI, EXAMPLE, cli, exits, json } from "./process-model-helpers.mjs";

export { ACCEPTED, CLI, EXAMPLE, cli, exits, json };

export const PAYMENT_STATUS = 'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment';
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
/** The index with the payment feature linked to no step, so its system step has no realizing feature. */
export const UNLINKED_PAYMENTS = {
  categories: {
    ...MAPPING.categories,
    payments: { ...MAPPING.categories.payments, realizes: [] },
  },
};
export const OPEN_PATH = '"Retrying after the payment provider declines a card."^^pm:OpenPath';
export const STEP_DEFINITION = '"The customer authorizes the card charge for the order."';
export const PAYMENT_PROCESS = /m:payment\.take-payment a pm:Process ;[\s\S]*?\.\n\n/;
/** A valid model document of its own, for documents the model reaches through a link. */
export const EXTRA = `@prefix m: <urn:adr-writer:model:> .
@prefix pm: <urn:adr-writer:process:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:courier a pm:Actor ;
    rdfs:label "Courier" ;
    pm:definition "The outside organization that delivers orders." .
`;
/** A process saved by hand as Accepted, whose only criterion executes no system step. */
export const REFUND_PROCESS = `@prefix m: <urn:adr-writer:model:> .
@prefix pm: <urn:adr-writer:process:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:payment.refund-payment a pm:Process ;
    rdfs:label "Refund a payment" ;
    pm:definition "The store returns the money of a paid order." ;
    pm:startCondition "A customer asks for a refund." ;
    pm:businessOutcome "The order's payment is refunded." ;
    pm:openScope "none"^^pm:NoOpenScope ;
    pm:status "Accepted (2020-01-15)" ;
    pm:hasStep m:payment.return-money .

m:payment.return-money a pm:Step ;
    rdfs:label "Return the money" ;
    pm:definition "The payment provider returns the money to the card." ;
    pm:stepKind "outside-system" ;
    pm:inContext m:payment .

m:payment-provider pm:performs m:payment.return-money .

m:payment.refund-payment.refunded a pm:ObservationCriterion ;
    rdfs:label "A refund reaches the card" ;
    pm:startCondition "A customer asks for a refund." ;
    pm:observedResult "The card shows the refund." ;
    pm:criterionOf m:payment.refund-payment .
`;

export const model = (dir, text, message) => {
  write(dir, "docs/process/model.ttl", text);
  if (message) commitAll(dir, message);
};
/** A repository whose processes started Proposed; an Accepted text is committed as the passed review. */
export function repo(dir, text = ACCEPTED, mapping = MAPPING) {
  cachedRepo(dir, JSON.stringify(["history", text, mapping]), (at) => {
    // An Accepted text is committed over the cached Proposed history of the same index.
    if (text !== EXAMPLE) {
      repo(at, EXAMPLE, mapping);
      model(at, text, "accepted after the alignment review");
      return;
    }
    mkdirSync(at, { recursive: true });
    initRepo(at);
    write(at, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    writeAdrFiles(at, mapping);
    model(at, EXAMPLE, "proposed");
  });
}
export const head = (dir) => git(dir, ["rev-parse", "HEAD"]).trim();
/** Clone over file://, so that --depth and --filter take effect. */
export function cloneOf(source, target, ...options) {
  execFileSync("git", ["clone", "-q", ...options, `file://${source}`, target]);
  return target;
}
export const directEdit = (dir) =>
  model(
    dir,
    ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
    "direct edit",
  );
/** The passed review with a direct edit committed on top, built once per test process. */
export const directlyEdited = (dir) =>
  cachedRepo(dir, "history: direct edit", (at) => {
    repo(at);
    directEdit(at);
  });
export function read(dir) {
  return readFileSync(path.join(dir, "docs/process/model.ttl"), "utf8");
}

export const REDATED = ACCEPTED.replace(
  PAYMENT_STATUS,
  'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
);

/** A submodule at `at` holding `files`, added to the work tree `work` and committed. */
export function addSubmodule(dir, work, at, files) {
  const sub = path.join(dir, `${at.replaceAll("/", "-")}-repo`);
  mkdirSync(sub);
  initRepo(sub);
  for (const [rel, text] of Object.entries(files)) write(sub, rel, text);
  commitAll(sub, "the documents");
  git(work, ["-c", "protocol.file.allow=always", "submodule", "add", "-q", sub, at]);
  commitAll(work, `${at} kept in a submodule`);
}
/** The submodule at `at` absorbed into the work tree as ordinary files, committed. */
export function absorbSubmodule(work, at, { keepSection = false } = {}) {
  git(work, ["rm", "-q", "--cached", at]);
  if (!keepSection) git(work, ["rm", "-q", ".gitmodules"]);
  rmSync(path.join(work, at, ".git"), { force: true, recursive: true });
  commitAll(work, `${at} absorbed into the repository`);
}

export const REWORDED = ACCEPTED.replace(
  STEP_DEFINITION,
  '"The customer approves the card charge."',
);
export const MORE_OPEN_SCOPE = ACCEPTED.replace(
  OPEN_PATH,
  `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`,
);
// The commit each cached round trip returned, for the copies made from it.
const roundTrips = new Map();
/**
 * An Accepted process demoted with the model changed to `edited` inside a commit that
 * does not parse, the commit after it promoted by hand to the first Accepted date, and
 * the edit then undone — with a hand re-date undone before the hidden round trip or
 * after the edit back. Returns the commit right after the one that does not parse:
 * had the hidden promotion happened, it would be the baseline.
 */
export function hiddenRoundTrip(dir, { redate = null, edited = REWORDED } = {}) {
  const status = (date) => `pm:status "Accepted (${date})" ;\n    pm:hasStep m:payment`;
  const key = JSON.stringify(["hidden round trip", redate, edited]);
  let repaired;
  cachedRepo(dir, key, (at) => {
    repo(at);
    if (redate === "before")
      model(at, ACCEPTED.replace(PAYMENT_STATUS, status("2020-01-15")), "re-dated by hand");
    write(at, "docs/process/broken.ttl", "m:x a\n");
    model(
      at,
      edited.replace(PAYMENT_STATUS, 'pm:status "Proposed" ;\n    pm:hasStep m:payment'),
      "demoted with an edit, beside a document that does not parse",
    );
    rmSync(path.join(at, "docs/process/broken.ttl"));
    model(at, edited, "repaired, and promoted by hand to the first Accepted date");
    repaired = head(at);
    model(at, ACCEPTED, "the edit undone, and any re-date undone");
    if (redate === "after") {
      model(at, ACCEPTED.replace(PAYMENT_STATUS, status("2020-01-15")), "re-dated by hand");
      model(at, ACCEPTED, "the re-date undone");
    }
    // A template, not a build in place: its copies hold the same commits.
    if (at !== dir) roundTrips.set(key, repaired);
  });
  return repaired ?? roundTrips.get(key);
}
export const paymentFlag = (dir) =>
  json(dir, ["changes"]).unsyncedAccepted.find((u) => u.process === "payment.take-payment");
export const renewPayment = (dir, args = []) =>
  cli(dir, [
    "transition",
    "--process",
    "payment.take-payment",
    "--to",
    "Accepted",
    "--date",
    "2020-01-20",
    ...args,
  ]);
/** Save `text` through an approved draft of the whole model, as process edit does. */
export function approvedSave(dir, text, args = []) {
  cpSync(path.join(dir, "docs/process"), path.join(dir, "draft"), { recursive: true });
  rmSync(path.join(dir, "draft/change-log.md"), { force: true });
  write(dir, "draft/model.ttl", text);
  const { baseHash } = json(dir, ["impact", "--draft", "draft", ...args]);
  const saved = exits(dir, ["apply", "--draft", "draft", "--base-hash", baseHash, ...args], 0);
  rmSync(path.join(dir, "draft"), { recursive: true });
  return saved;
}
export const HIDDEN_RENEWAL =
  /"payment\.take-payment" may have become Accepted again behind commits history cannot read, on a business composition this result changes; mark it Proposed for an alignment review/;
export const HIDDEN_EDITS =
  /⚠ Accepted date of payment\.take-payment not renewed: "payment\.take-payment" may have become Accepted again behind commits history cannot read, with edits since then that this confirmation does not cover; run process sync/;

/**
 * An Accepted process demoted with a reworded step inside `run` commits whose model
 * does not parse, set back to its Accepted date inside them when there are two, and
 * repaired with the step reworded back: one such commit holds one Status, two may hide
 * the Status leaving and coming back on a composition nobody can see.
 */
export function unreadRun(dir, run) {
  cachedRepo(dir, JSON.stringify(["unread run", run]), (at) => {
    repo(at);
    write(at, "docs/process/broken.ttl", "m:x a\n");
    const demoted = REWORDED.replace(
      PAYMENT_STATUS,
      'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    );
    if (run === 2) {
      model(at, demoted, "demoted with a reworded step, beside a document that does not parse");
      model(at, REWORDED, "promoted back by hand, the document still broken");
    } else model(at, REWORDED, "a reworded step, beside a document that does not parse");
    rmSync(path.join(at, "docs/process/broken.ttl"));
    model(at, ACCEPTED, "repaired, and the step reworded back");
  });
}
export const UNSEEN_RUN =
  "two or more commits in a row that history cannot read may hide where its Status last appeared, on a composition nobody can see";
export const UNREAD_UNCHANGED = ["--unread-unchanged"];

/** Two commits whose broken document sits beside the one that states every Status. */
export function brokenBeside(dir) {
  cachedRepo(dir, "broken beside", (at) => {
    repo(at);
    write(at, "docs/process/broken.ttl", "m:x a\n");
    commitAll(at, "a document that does not parse");
    write(at, "docs/process/broken.ttl", "m:y a\n");
    commitAll(at, "still broken");
    rmSync(path.join(at, "docs/process/broken.ttl"));
    commitAll(at, "repaired");
  });
}

/** Replace the committed link at the change log with a tracked change log. */
export function trackChangeLog(dir, message) {
  const at = path.join(dir, "docs/process/change-log.md");
  const text = readFileSync(at, "utf8");
  unlinkSync(at);
  write(dir, "docs/process/change-log.md", text);
  commitAll(dir, message);
}
/** Keep the change log in an ignored local file the model directory links to. */
export function linkChangeLog(dir, text = "# Process model change log\n") {
  write(dir, ".gitignore", "local/\n");
  write(dir, "local/change-log.md", text);
  rmSync(path.join(dir, "docs/process/change-log.md"), { force: true });
  symlinkSync("../../local/change-log.md", path.join(dir, "docs/process/change-log.md"));
}

export const PROCESS_DEFINITION = '"The store collects the money for a placed order."';
export const STEP_RENEWAL = ["--same-meaning", "payment.request-payment=pm:definition"];
