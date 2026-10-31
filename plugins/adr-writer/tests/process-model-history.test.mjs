// What repository history decides for the process lifecycle: direct-edit detection
// across merges and the composition-only gate of Accepted → Proposed, the audit of
// committed lifecycle edits and retirements, and undone hand edits. Nothing is
// recorded; every answer comes from git objects and the current documents. The other
// process-model-history-*.test.mjs files hold renewals, the reading of links and
// submodules, clones and git settings, the gates at a commit, commits history cannot
// read, the promotions they may hide, and runs of them.
import assert from "node:assert/strict";
import { renameSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { indexGraph, parseTurtle } from "../scripts/process-model-lib.mjs";
import { changeFlags } from "../scripts/process-model-fs.mjs";
import { commitAll, git, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  EXAMPLE,
  MAPPING,
  OPEN_PATH,
  PAYMENT_PROCESS,
  PAYMENT_STATUS,
  REDATED,
  STEP_DEFINITION,
  UNLINKED_PAYMENTS,
  cli,
  exits,
  head,
  json,
  model,
  read,
  repo,
} from "./process-model-history-helpers.mjs";

test("open scope alone never demotes an Accepted process; a composition change does", () => {
  withTmp((dir) => {
    repo(dir);
    const accepted = head(dir);
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "open path",
    );
    const [flag] = json(dir, ["changes"]).unsyncedAccepted;
    assert.deepEqual(
      [flag.process, flag.since, flag.compositionChanged],
      ["payment.take-payment", accepted, false],
    );
    const refused = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Proposed",
    ]);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /an open-scope edit alone changes no Status/);
    assert.equal(cli(dir, ["lifecycle"]).code, 0);

    model(
      dir,
      read(dir).replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "direct edit",
    );
    const changed = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([changed.since, changed.compositionChanged], [accepted, true]);
    assert.ok(
      changed.changes.some((c) => c.id === "payment.request-payment" && c.change === "changed"),
    );
    const ok = cli(dir, ["transition", "--process", "payment.take-payment", "--to", "Proposed"]);
    assert.equal(ok.code, 0, ok.out);
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(
      lifecycle.code,
      0,
      `the transition follows a committed direct edit: ${lifecycle.out}`,
    );
    commitAll(dir, "sync marks Proposed");
    assert.equal(cli(dir, ["lifecycle"]).code, 0);
  });
});

test("impact --base summarizes a direct edit, and --process keeps only that process", () => {
  withTmp((dir) => {
    repo(dir);
    const accepted = head(dir);
    // An approved change already made ordering Proposed; then payment is edited directly.
    model(
      dir,
      ACCEPTED.replace(
        '"The order is confirmed and the customer can see it."',
        '"The order is confirmed, paid and visible to the customer."',
      ).replace(
        'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:ordering',
        'pm:status "Proposed" ;\n    pm:hasStep m:ordering',
      ),
      "approved ordering change",
    );
    model(
      dir,
      read(dir).replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "direct edit",
    );
    assert.equal(json(dir, ["changes"]).unsyncedAccepted[0].since, accepted, "not HEAD");
    const whole = json(dir, ["impact", "--base", accepted]);
    assert.ok(
      whole.diff.some((e) => e.id.startsWith("ordering.")),
      "the unscoped report re-surfaces ordering",
    );
    const scoped = json(dir, ["impact", "--base", accepted, "--process", "payment.take-payment"]);
    assert.deepEqual(scoped.processesToPropose, ["payment.take-payment"]);
    assert.ok(
      scoped.diff.every((e) => !e.id.startsWith("ordering.")),
      JSON.stringify(scoped.diff.map((e) => e.id)),
    );
    assert.equal(cli(dir, ["impact", "--draft", "x", "--process", "payment.take-payment"]).code, 2);
    // An uncommitted edit compared with HEAD.
    model(dir, read(dir).replace('rdfs:label "Customer"', 'rdfs:label "Shopper"'));
    assert.deepEqual(
      json(dir, ["impact", "--base", "HEAD"]).diff.map((e) => e.id),
      ["customer"],
    );
  });
});

test("committed lifecycle edits made by hand are reported from history", () => {
  withTmp((dir) => {
    // A promotion whose gates did not hold at that commit.
    const unlinked = { categories: { checkout: MAPPING.categories.checkout } };
    repo(dir, EXAMPLE, unlinked);
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
      "hand promotion",
    );
    const promoted = json(dir, ["lifecycle"]).findings;
    assert.ok(
      promoted.some(
        (f) => f.element === "payment.take-payment" && /alignment gates did not hold/.test(f.msg),
      ),
      JSON.stringify(promoted),
    );
  });
  withTmp((dir) => {
    repo(dir);
    // A new process added by hand as Accepted, then a revival and a re-dated retirement.
    write(
      dir,
      "docs/process/returns.ttl",
      `@prefix m: <urn:adr-writer:model:> .\n@prefix pm: <urn:adr-writer:process:> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\nm:returns a pm:Process ;\n    rdfs:label "Returns" ;\n    pm:definition "d" ;\n    pm:startCondition "s" ;\n    pm:businessOutcome "o" ;\n    pm:openScope "none"^^pm:NoOpenScope ;\n    pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:returns.take-back .\n\nm:returns.take-back a pm:Step ;\n    rdfs:label "Take back" ;\n    pm:definition "d" ;\n    pm:stepKind "outside-system" ;\n    pm:inContext m:ordering .\n\nm:customer pm:performs m:returns.take-back .\n\nm:returns.done a pm:ObservationCriterion ;\n    rdfs:label "Done" ;\n    pm:startCondition "s" ;\n    pm:observedResult "r" ;\n    pm:criterionOf m:returns .\n`,
    );
    commitAll(dir, "hand-added process");
    assert.ok(
      json(dir, ["lifecycle"]).findings.some(
        (f) =>
          f.element === "returns" &&
          /saved and became Accepted in one change while the alignment gates did not hold/.test(
            f.msg,
          ),
      ),
    );
    write(
      dir,
      "docs/process/change-log.md",
      "# Process model change log\n\n- 2020-01-30 — `payment.take-payment` deprecated: moved to invoicing\n",
    );
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-01)" ;\n    pm:hasStep m:payment',
      ),
      "deprecate",
    );
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
      "re-date",
    );
    assert.ok(
      json(dir, ["lifecycle"]).findings.some(
        (f) => f.element === "payment.take-payment" && /final/.test(f.msg),
      ),
    );
    model(
      dir,
      ACCEPTED.replace(PAYMENT_STATUS, 'pm:status "Proposed" ;\n    pm:hasStep m:payment'),
      "revival",
    );
    assert.ok(
      json(dir, ["lifecycle"]).findings.some(
        (f) =>
          f.element === "payment.take-payment" &&
          /Deprecated → Proposed is not an allowed transition/.test(f.msg),
      ),
    );
    // Removing a process entirely.
    renameSync(path.join(dir, "docs/process/returns.ttl"), path.join(dir, "returns.bak"));
    commitAll(dir, "removed");
    assert.ok(
      json(dir, ["lifecycle"]).findings.some(
        (f) => f.element === "returns" && /was removed/.test(f.msg),
      ),
    );
  });
});

test("edits after acceptance on a merged branch stay flagged", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE);
    git(dir, ["checkout", "-qb", "feature"]);
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-01)" ;\n    pm:hasStep m:payment',
      ),
      "accept payment",
    );
    model(
      dir,
      read(dir).replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "edit on branch",
    );
    git(dir, ["checkout", "-q", "-"]);
    // Main edits another process meanwhile, so the merge joins two model histories.
    model(
      dir,
      read(dir).replace(
        '"The customer sends the cart as an order."',
        '"The customer sends the whole cart as an order."',
      ),
      "main work",
    );
    git(dir, ["merge", "-q", "--no-ff", "feature", "-m", "merge feature"]);
    const [flag] = json(dir, ["changes"]).unsyncedAccepted;
    assert.equal(flag?.process, "payment.take-payment", "the merge keeps the edit visible");
  });
});

test("a retired process never comes back, even through a deletion and a later re-add", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/process/change-log.md",
      "# Process model change log\n\n- 2020-01-30 — `payment.take-payment` deprecated: moved to invoicing\n",
    );
    const unlinked = structuredClone(MAPPING);
    unlinked.categories.payments.realizes = [];
    write(dir, "docs/adr/.mapping.json", JSON.stringify(unlinked, null, 2));
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
      "deprecate",
    );
    // The revival restores the index link, so only the lifecycle edit can refuse a promotion.
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    const proposed = ACCEPTED.replace(
      PAYMENT_STATUS,
      'pm:status "Proposed" ;\n    pm:hasStep m:payment',
    );
    model(dir, proposed, "revived in one step");
    const revivalReported = () => {
      const findings = json(dir, ["lifecycle"]).findings;
      assert.ok(
        findings.some(
          (f) =>
            f.element === "payment.take-payment" &&
            /a retired process never becomes Proposed or Accepted again/.test(f.msg),
        ),
        JSON.stringify(findings),
      );
    };
    revivalReported();
    model(dir, ACCEPTED.replace(PAYMENT_PROCESS, ""), "removed");
    model(dir, proposed, "added again");
    revivalReported();
    const promoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
    ]);
    assert.equal(promoted.code, 1, promoted.out);
    assert.match(promoted.out, /lifecycle edits ADR Writer's transitions do not explain/);
  });
});

test("a process removed in the working tree is reported where HEAD's document states it", () => {
  withTmp((dir) => {
    repo(dir);
    const block = /m:payment\.take-payment a pm:Process ;[\s\S]*?\n\n/;
    const line = ACCEPTED.slice(0, ACCEPTED.search(block)).split("\n").length;
    write(dir, "docs/process/model.ttl", ACCEPTED.replace(block, ""));
    const removed = json(dir, ["lifecycle"]).findings.find(
      (f) => f.element === "payment.take-payment" && /was removed/.test(f.msg),
    );
    assert.equal(removed?.where, `HEAD:docs/process/model.ttl:${line}`);
  });
});

test("ADR Writer's own transitions committed together are not lifecycle edits", () => {
  withTmp((dir) => {
    repo(dir);
    // An approved change and its passing review in one commit re-date Accepted.
    model(
      dir,
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."').replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
      "approved change, implemented and reviewed",
    );
    exits(dir, ["lifecycle"], 0);
    // Re-dating without any composition change stays an error.
    model(dir, read(dir).replace('"Accepted (2020-01-30)"', '"Accepted (2020-01-31)"'), "re-dated");
    assert.ok(
      json(dir, ["lifecycle"]).findings.some((f) =>
        /re-dated without passing through Proposed/.test(f.msg),
      ),
    );
  });
});

test("a retirement's change-log line must name the process itself, not an element under it", () => {
  withTmp((dir) => {
    repo(dir);
    write(
      dir,
      "docs/process/change-log.md",
      "# Process model change log\n\n- 2020-01-30 — `payment.take-payment.completed` reworded\n",
    );
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
      "deprecate without its own line",
    );
    assert.ok(
      json(dir, ["lifecycle"]).findings.some(
        (f) => f.element === "payment.take-payment" && /change-log line naming/.test(f.msg),
      ),
    );
  });
});

test("an uncommitted hand retirement with its change-log line is a warning to report, and no save includes it", () => {
  withTmp((dir) => {
    repo(dir);
    // Written into the change log directly, not by a save's --log.
    write(
      dir,
      "docs/process/change-log.md",
      "# Process model change log\n\n- 2020-01-30 — `payment.take-payment` deprecated: moved to invoicing\n",
    );
    // Without the link to a retired process's step, only the retirement itself can refuse a save.
    const unlinked = structuredClone(MAPPING);
    unlinked.categories.payments.realizes = [];
    write(dir, "docs/adr/.mapping.json", JSON.stringify(unlinked, null, 2));
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Deprecated (2020-01-30)" ;\n    pm:hasStep m:payment',
      ),
    );
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 0, lifecycle.out);
    assert.match(
      lifecycle.out,
      /⚠ \[process-lifecycle-needs-approval\] \S+ payment\.take-payment\n/,
      lifecycle.out,
    );
    const { baseHash } = json(dir, ["impact", "--base", "HEAD"]);
    const saved = cli(dir, ["apply", "--base", "HEAD", "--base-hash", baseHash]);
    assert.equal(saved.code, 1, saved.out);
    assert.match(saved.out, /no save includes a retirement it did not approve/);
  });
});

test("a process removed and added again is judged as one change from its last state before the removal", () => {
  withTmp((dir) => {
    repo(dir);
    model(dir, ACCEPTED.replace(PAYMENT_PROCESS, ""), "removed");
    model(
      dir,
      ACCEPTED.replace(PAYMENT_STATUS, 'pm:status "Proposed" ;\n    pm:hasStep m:payment'),
      "added again as a new process",
    );
    // Accepted before the removal, Proposed after it, and nothing in its composition changed.
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.equal(lifecycle.code, 1, lifecycle.out);
    assert.match(
      lifecycle.out,
      /payment\.take-payment[\s\S]*Accepted → Proposed without a change to the process's business composition/,
    );
  });
});

test("a process moved into a document of its own across two commits is unchanged, and can be renewed", () => {
  withTmp((dir) => {
    repo(dir);
    const block = PAYMENT_PROCESS.exec(ACCEPTED)[0];
    const prefixes = ACCEPTED.slice(0, ACCEPTED.indexOf("m:customer a pm:Actor"));
    // Committed the way `git commit -a` leaves a move before the new file is added.
    model(dir, ACCEPTED.replace(PAYMENT_PROCESS, ""), "process moved out");
    write(dir, "docs/process/payment.ttl", `${prefixes}${block}`);
    commitAll(dir, "its own document");
    exits(dir, ["lifecycle"], 0);
    const clean = cli(dir, ["changes"]);
    assert.equal(clean.code, 0, clean.out);
    write(
      dir,
      "docs/process/payment.ttl",
      `${prefixes}${block}`.replace(
        OPEN_PATH,
        `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`,
      ),
    );
    const renewed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-29",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
  });
});

test("a process removed and added again as Accepted keeps the baseline where it first became Accepted", () => {
  withTmp((dir) => {
    repo(dir);
    const accepted = head(dir);
    model(dir, ACCEPTED.replace(PAYMENT_PROCESS, ""), "removed");
    model(
      dir,
      ACCEPTED.replace('"The order has a completed payment."', '"The order is paid in full."'),
      "added again with another outcome",
    );
    // The same Status before the removal and after the re-add: no lifecycle edit, but
    // the outcome changed since the process became Accepted.
    const lifecycle = cli(dir, ["lifecycle"]);
    assert.doesNotMatch(lifecycle.out, /removed/, lifecycle.out);
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("undoing a committed hand promotion ends its report", () => {
  withTmp((dir) => {
    repo(dir, EXAMPLE, UNLINKED_PAYMENTS);
    model(
      dir,
      EXAMPLE.replace(
        'pm:status "Proposed" ;\n    pm:hasStep m:payment',
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "promoted by hand while payments is unlinked",
    );
    assert.equal(cli(dir, ["lifecycle"]).code, 1);
    model(dir, EXAMPLE, "undone by hand");
    const undone = cli(dir, ["lifecycle"]);
    assert.equal(undone.code, 0, undone.out);
    assert.match(undone.out, /✓ no unexplained lifecycle change against HEAD/);
  });
});

test("undoing a hand re-dating keeps the original baseline, so an edit made with the undo stays flagged", () => {
  withTmp((dir) => {
    repo(dir);
    const accepted = head(dir);
    model(
      dir,
      ACCEPTED.replace(
        PAYMENT_STATUS,
        'pm:status "Accepted (2020-01-15)" ;\n    pm:hasStep m:payment',
      ),
      "re-dated by hand",
    );
    assert.equal(cli(dir, ["lifecycle"]).code, 1);
    model(
      dir,
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "undone, together with an edit",
    );
    exits(dir, ["lifecycle"], 0);
    const flag = json(dir, ["changes"]).unsyncedAccepted.find(
      (u) => u.process === "payment.take-payment",
    );
    assert.deepEqual([flag?.since, flag?.compositionChanged], [accepted, true]);
  });
});

test("after a hand edit is undone together with an edit, ADR Writer's demotion and promotion stay its own once committed", () => {
  withTmp((dir) => {
    repo(dir);
    model(dir, REDATED, "re-dated by hand");
    model(
      dir,
      ACCEPTED.replace(STEP_DEFINITION, '"The customer approves the card charge."'),
      "undone, together with an edit",
    );
    const demoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Proposed",
    ]);
    assert.equal(demoted.code, 0, demoted.out);
    commitAll(dir, "marked Proposed by process sync");
    exits(dir, ["lifecycle"], 0);
    const promoted = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(promoted.code, 0, promoted.out);
    commitAll(dir, "accepted after its review");
    exits(dir, ["lifecycle"], 0);
    exits(dir, ["changes"], 0);
  });
});

test("after a hand edit is undone together with an open-scope edit, the renewal stays ADR Writer's own once committed", () => {
  withTmp((dir) => {
    repo(dir);
    model(dir, REDATED, "re-dated by hand");
    model(
      dir,
      ACCEPTED.replace(OPEN_PATH, `${OPEN_PATH}, "Refunds after a dispute."^^pm:OpenPath`),
      "undone, together with an open path",
    );
    const renewed = cli(dir, [
      "transition",
      "--process",
      "payment.take-payment",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(renewed.code, 0, renewed.out);
    commitAll(dir, "renewed after confirming the open path");
    exits(dir, ["lifecycle"], 0);
    exits(dir, ["changes"], 0);
  });
});

test("an Accepted process whose Status no readable commit shows has unknown edits, never clean ones", () => {
  const graph = indexGraph(parseTurtle(ACCEPTED, "docs/process/model.ttl").triples);
  // A history whose commits hold no model: nowhere to find where the Status appeared.
  const history = {
    available: true,
    top: "/",
    dir: "docs/process",
    head: "c0",
    history: { available: true },
    tip: null,
    nodes: new Map(),
    boundary: new Set(),
    headFiles: new Map(),
    headSkipped: [],
    graphAt: (c) => (c === "c0" ? graph : null),
    errorsAt: () => [],
    tracksMapping: false,
    mappingAt: () => undefined,
    changeLogAt: () => "",
  };
  const flags = changeFlags("docs/process", graph, { history });
  assert.equal(
    flags.uncertain.get("payment.take-payment"),
    "where its Accepted Status first appeared is not in the readable history",
  );
  assert.equal(flags.unsynced.size, 0);
});
