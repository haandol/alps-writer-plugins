// The approved save path: impact binds the summary, apply writes one change unit or
// nothing, documents and links are written as the working tree names them, and every
// input the approval saw is checked again before any write. The glossary guard is in
// ontology-apply-glossary.integration.test.mjs, the lifecycle guards and renewals
// in ontology-apply-lifecycle.integration.test.mjs.
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { validateModel } from "../scripts/ontology-lib.mjs";
import { commitAll, git, initRepo, withTmp, write } from "./helpers.mjs";
import {
  ACCEPTED,
  ACTORS,
  AUDITOR,
  EXAMPLE,
  GLOSSARY,
  MAPPING,
  ORDER_EDIT,
  PREFIXES,
  RETURNS,
  SETTLED,
  STEP_EDIT,
  UNLINKED,
  WORDING,
  apply,
  cli,
  draft,
  exits,
  impact,
  insideGit,
  paymentIn,
  read,
  repo,
  statusOf,
} from "./ontology-apply-helpers.mjs";

test("an affected ADR edited after the summary stops the apply and keeps the edit", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    const summary = impact(dir);
    assert.deepEqual(summary.affectedAdrs, [
      "docs/adr/checkout/0001-a.md",
      "docs/adr/payments/0001-b.md",
    ]);
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      `${read(dir, "docs/adr/payments/0001-b.md")}\nA user's note.\n`,
    );
    const stale = apply(dir, summary.baseHash, [
      "--log",
      "`payment.payment-completed`: settled too",
    ]);
    assert.equal(stale.code, 1);
    assert.match(
      stale.out,
      /an affected ADR .*changed after the approval summary; nothing was written/,
    );
    assert.match(read(dir, "docs/adr/payments/0001-b.md"), /A user's note\./);
    assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
    // Editing the approved draft itself also invalidates the approval.
    const fresh = impact(dir);
    write(
      dir,
      "draft/model.ttl",
      read(dir, "draft/model.ttl").replace(SETTLED, '"Changed again."'),
    );
    assert.match(apply(dir, fresh.baseHash).out, /changed after the approval summary/);
  });
});

test(
  "an unreadable input or a failed write leaves every file as it was",
  { skip: process.getuid?.() === 0 && "a read-only directory does not stop root from writing" },
  () => {
    withTmp((dir) => {
      repo(dir);
      draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
      const { baseHash } = impact(dir);
      const missing = apply(dir, baseHash, ["--glossary", "glossary.nxt.md"]);
      assert.equal(missing.code, 1);
      assert.match(missing.out, /nothing was written: cannot read --glossary glossary\.nxt\.md/);
      assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);

      // The change log is the last file of the unit; when it cannot be written,
      // the model already moved into place is restored.
      mkdirSync(path.join(dir, "docs/ontology/change-log.md/blocked"), { recursive: true });
      const blocked = apply(dir, impact(dir).baseHash, [
        "--log",
        "`payment.payment-completed`: settled too",
      ]);
      assert.equal(blocked.code, 1, blocked.out);
      assert.match(blocked.out, /writing failed .*every file already written was restored/);
      assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
      rmSync(path.join(dir, "docs/ontology/change-log.md"), { recursive: true });

      // An unwritable index directory fails while staging, before anything moves.
      write(dir, "mapping.next.json", JSON.stringify(MAPPING, null, 2));
      chmodSync(path.join(dir, "docs/adr"), 0o555);
      try {
        const staged = apply(dir, impact(dir, ["--mapping", "mapping.next.json"]).baseHash, [
          "--mapping",
          "mapping.next.json",
        ]);
        assert.equal(staged.code, 1, staged.out);
        assert.match(staged.out, /staging failed .*nothing was written/);
      } finally {
        chmodSync(path.join(dir, "docs/adr"), 0o755);
      }
      assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
      assert.equal(git(dir, ["status", "--porcelain", "--", "docs"]).trim(), "");
    });
  },
);

test("a retirement removes the links to its steps in the same unit, and a process is never removed", () => {
  withTmp((dir) => {
    repo(dir);
    const deprecated = ACCEPTED.replace(
      'onto:status "Accepted (2020-01-01)" ;\n    onto:hasStep m:payment',
      'onto:status "Deprecated (2020-01-30)" ;\n    onto:hasStep m:payment',
    );
    draft(dir, deprecated);
    const summary = impact(dir);
    assert.deepEqual(summary.linkChanges, [
      { category: "payments", step: "payment.request-payment", reason: "retired" },
    ]);
    const log = ["--log", "`payment.take-payment` deprecated: payment moved to invoicing"];
    const leftover = apply(dir, summary.baseHash, log);
    assert.equal(leftover.code, 1);
    assert.match(leftover.out, /ontology-link-retired/);
    const unlinked = structuredClone(MAPPING);
    unlinked.categories.payments.realizes = [];
    write(dir, "mapping.next.json", JSON.stringify(unlinked, null, 2));
    const relinked = impact(dir, ["--mapping", "mapping.next.json"]);
    const retired = apply(dir, relinked.baseHash, [...log, "--mapping", "mapping.next.json"]);
    assert.equal(retired.code, 0, retired.out);
    assert.equal(cli(dir, ["validate"]).code, 0);
  });
});

test("a retired process stays in the model; deleting it is refused", () => {
  assert.equal(
    validateModel([
      { doc: "model.ttl", text: ACCEPTED },
      { doc: "returns.ttl", text: RETURNS },
    ]).ok,
    true,
  );
  withTmp((dir) => {
    repo(dir);
    write(dir, "docs/ontology/returns.ttl", RETURNS);
    commitAll(dir, "returns retired");
    draft(dir);
    rmSync(path.join(dir, "draft/returns.ttl"));
    const removal = impact(dir);
    assert.equal(removal.draftValid, true);
    const removed = apply(dir, removal.baseHash);
    assert.equal(removed.code, 1);
    assert.match(removed.out, /returns: the process was removed/);
    assert.equal(read(dir, "docs/ontology/returns.ttl"), RETURNS);
  });
});

test("a document whose graph did not change keeps its text, so a repeated save changes nothing", () => {
  withTmp((dir) => {
    const extra =
      'm:auditor a onto:Actor ;\n        rdfs:label "Auditor" ;\n    onto:definition    "Checks the books." .\n';
    repo(dir);
    write(
      dir,
      "docs/ontology/people.ttl",
      `@prefix m: <urn:ontology-writer:model:> .\n@prefix onto: <urn:ontology-writer:vocabulary:> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n${extra}`,
    );
    exits(dir, ["validate"], 0);
    commitAll(dir, "people");
    const people = read(dir, "docs/ontology/people.ttl");
    draft(dir);
    const same = impact(dir);
    assert.equal(same.same, true);
    assert.equal(apply(dir, same.baseHash).code, 0);
    assert.equal(
      git(dir, ["status", "--porcelain"])
        .trim()
        .split("\n")
        .filter((l) => !l.includes("draft/"))
        .join(""),
      "",
    );
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    const changed = impact(dir);
    assert.equal(
      apply(dir, changed.baseHash, ["--log", "`payment.payment-completed`: settled too"]).code,
      0,
    );
    assert.equal(
      read(dir, "docs/ontology/people.ttl"),
      people,
      "the untouched document keeps its formatting",
    );
  });
});

test("an approved direct edit saves only the index, glossary and log, bound to its affected ADRs", () => {
  withTmp((dir) => {
    repo(dir);
    const edited = `${ACCEPTED.replace('"The money for an order was collected."', SETTLED)}\nm:payment.settlement a onto:BusinessConcept ;\n    rdfs:label "Settlement" ;\n    onto:definition "Paying sellers." ;\n    onto:inContext m:payment .\n`;
    write(dir, "docs/ontology/model.ttl", edited);
    for (const p of ["ordering.place-order", "payment.take-payment"])
      assert.equal(cli(dir, ["transition", "--process", p, "--to", "Proposed"]).code, 0, p);
    const marked = read(dir, "docs/ontology/model.ttl");
    const summary = JSON.parse(cli(dir, ["impact", "--base", "HEAD", "--json"]).out);
    assert.deepEqual(summary.affectedAdrs, [
      "docs/adr/checkout/0001-a.md",
      "docs/adr/payments/0001-b.md",
    ]);
    const save = (hash, extra = []) =>
      cli(dir, ["apply", "--base", "HEAD", "--base-hash", hash, ...extra]);
    write(
      dir,
      "docs/adr/checkout/0001-a.md",
      `${read(dir, "docs/adr/checkout/0001-a.md")}\nA user's note.\n`,
    );
    assert.match(
      save(summary.baseHash).out,
      /an affected ADR .*changed after the approval summary/,
    );
    const fresh = JSON.parse(cli(dir, ["impact", "--base", "HEAD", "--json"]).out);
    assert.match(save(fresh.baseHash).out, /the glossary would still define "Settlement"/);
    write(dir, "glossary.next.md", "| Term | Meaning |\n| --- | --- |\n");
    const approved = JSON.parse(
      cli(dir, ["impact", "--base", "HEAD", "--glossary", "glossary.next.md", "--json"]).out,
    );
    const applied = save(approved.baseHash, [
      "--glossary",
      "glossary.next.md",
      "--log",
      "`payment.payment-completed`: settled too",
    ]);
    assert.equal(applied.code, 0, applied.out);
    assert.equal(read(dir, "docs/ontology/model.ttl"), marked, "the user's edit is not rewritten");
    assert.doesNotMatch(read(dir, "docs/adr/glossary.md"), /Settlement/);
    assert.match(read(dir, "docs/adr/checkout/0001-a.md"), /A user's note\./);
  });
});

test("an approved direct edit is saved only against the revision its summary compared with", () => {
  withTmp((dir) => {
    repo(dir);
    // HEAD and HEAD~1 hold the same model, so a summary against either lists the same ADRs.
    write(dir, "notes.md", "unrelated\n");
    commitAll(dir, "an unrelated commit");
    write(
      dir,
      "docs/ontology/model.ttl",
      ACCEPTED.replace('"The money for an order was collected."', SETTLED),
    );
    for (const p of ["ordering.place-order", "payment.take-payment"])
      assert.equal(cli(dir, ["transition", "--process", p, "--to", "Proposed"]).code, 0, p);
    const summary = JSON.parse(cli(dir, ["impact", "--base", "HEAD", "--json"]).out);
    const other = JSON.parse(cli(dir, ["impact", "--base", "HEAD~1", "--json"]).out);
    assert.deepEqual(other.affectedAdrs, summary.affectedAdrs);
    const log = ["--log", "`payment.payment-completed`: settled too"];
    const save = (base, hash) => cli(dir, ["apply", "--base", base, "--base-hash", hash, ...log]);
    assert.match(
      save("HEAD~1", summary.baseHash).out,
      /the compared revision, .*changed after the approval summary; nothing was written/,
    );
    // A ref that moves after the summary names another revision too.
    git(dir, ["commit", "--allow-empty", "-qm", "HEAD moves"]);
    assert.match(
      save("HEAD", summary.baseHash).out,
      /the compared revision, .*changed after the approval summary; nothing was written/,
    );
    const fresh = JSON.parse(cli(dir, ["impact", "--base", "HEAD", "--json"]).out);
    const applied = save("HEAD", fresh.baseHash);
    assert.equal(applied.code, 0, applied.out);
  });
});

for (const state of ["with a commit", "with no commit yet", "outside git"])
  test(`a first model is saved into a repository without one, ${state}, every new process Proposed`, (t) => {
    withTmp((dir) => {
      if (state === "outside git" && insideGit(dir))
        return t.skip("the temporary directory lies inside a git work tree");
      if (state !== "outside git") initRepo(dir);
      write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }, null, 2));
      if (state === "with a commit") commitAll(dir, "index only");
      rmSync(path.join(dir, "draft"), { recursive: true, force: true });
      write(dir, "draft/model.ttl", ACCEPTED);
      const summary = impact(dir);
      assert.equal(summary.draftValid, true);
      assert.deepEqual(summary.processesToPropose, [
        "ordering.place-order",
        "payment.take-payment",
      ]);
      const saved = apply(dir, summary.baseHash, ["--log", "first model of ordering and payment"]);
      assert.equal(saved.code, 0, saved.out);
      const model = read(dir, "docs/ontology/model.ttl");
      assert.equal((model.match(/onto:status "Proposed"/g) ?? []).length, 2);
      assert.doesNotMatch(model, /Accepted/);
      assert.equal(cli(dir, ["validate"]).code, 0);
    });
  });

test("the approval also binds the index and glossary drafts, the change log and every relinked feature's ADR", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    const log = ["--log", "`payment.payment-completed`: settled too"];
    for (const [file, text] of [
      ["docs/adr/.mapping.json", JSON.stringify({ ...MAPPING, note: 1 }, null, 2)],
      ["docs/adr/glossary.md", `${GLOSSARY}| Refund | money back |\n`],
      ["docs/ontology/change-log.md", "# Ontology change log\n\n- 2020-01-29 — earlier\n"],
    ]) {
      const { baseHash } = impact(dir);
      const before = existsSync(path.join(dir, file)) ? read(dir, file) : null;
      write(dir, file, text);
      const stale = apply(dir, baseHash, log);
      assert.match(stale.out, /changed after the approval summary/, file);
      if (before === null) rmSync(path.join(dir, file));
      else write(dir, file, before);
    }
    // An index draft relinking an existing feature binds that feature's ADR and the draft itself.
    const relinked = structuredClone(MAPPING);
    relinked.categories.payments.realizes = ["payment.request-payment", "payment.capture-payment"];
    write(dir, "mapping.next.json", JSON.stringify(relinked, null, 2));
    const summary = impact(dir, ["--mapping", "mapping.next.json"]);
    assert.deepEqual(summary.relinkedCategories, ["payments"]);
    write(dir, "mapping.next.json", JSON.stringify(MAPPING, null, 2));
    assert.match(
      apply(dir, summary.baseHash, [...log, "--mapping", "mapping.next.json"]).out,
      /changed after the approval summary/,
      "the index draft changed after the summary",
    );
  });
});

test("an unreadable index draft is refused even when the approval had no index draft", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    const index = read(dir, "docs/adr/.mapping.json");
    const refused = apply(dir, impact(dir).baseHash, ["--mapping", "missing.json"]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /nothing was written: cannot read --mapping missing\.json/);
    assert.equal(read(dir, "docs/adr/.mapping.json"), index);
    assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
  });
});

test("a relinked feature's ADR edited after the summary stops the apply and keeps the edit", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir);
    const relinked = structuredClone(MAPPING);
    relinked.categories.payments.realizes = ["payment.request-payment", "payment.capture-payment"];
    write(dir, "mapping.next.json", JSON.stringify(relinked, null, 2));
    const summary = impact(dir, ["--mapping", "mapping.next.json"]);
    // No model change: the relink alone puts the payment ADR under the approval.
    assert.equal(summary.same, true);
    assert.deepEqual(summary.affectedAdrs, ["docs/adr/payments/0001-b.md"]);
    write(
      dir,
      "docs/adr/payments/0001-b.md",
      `${read(dir, "docs/adr/payments/0001-b.md")}\nA user's note.\n`,
    );
    const stale = apply(dir, summary.baseHash, ["--mapping", "mapping.next.json"]);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary; nothing was written/);
    assert.match(read(dir, "docs/adr/payments/0001-b.md"), /A user's note\./);
    assert.equal(read(dir, "docs/adr/.mapping.json"), JSON.stringify(MAPPING, null, 2));
  });
});

test("a glossary draft edited after the summary stops the apply", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir);
    write(dir, "glossary.next.md", `${GLOSSARY}| Refund | money back |\n`);
    const summary = impact(dir, ["--glossary", "glossary.next.md"]);
    write(dir, "glossary.next.md", `${GLOSSARY}| Refund | money returned to the buyer |\n`);
    const stale = apply(dir, summary.baseHash, ["--glossary", "glossary.next.md"]);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary; nothing was written/);
    assert.equal(read(dir, "docs/adr/glossary.md"), GLOSSARY);
  });
});

test("an index draft whose ADR record changed after the summary stops the apply", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir);
    write(dir, "mapping.next.json", JSON.stringify(MAPPING, null, 2));
    const summary = impact(dir, ["--mapping", "mapping.next.json"]);
    // A record field, not a link: no relinked ADR binds the change.
    const edited = structuredClone(MAPPING);
    edited.categories.payments.adrs[0].summary = "Card payments are settled daily.";
    write(dir, "mapping.next.json", JSON.stringify(edited, null, 2));
    const stale = apply(dir, summary.baseHash, ["--mapping", "mapping.next.json"]);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary; nothing was written/);
    assert.equal(read(dir, "docs/adr/.mapping.json"), JSON.stringify(MAPPING, null, 2));
  });
});

test("a model document edited after the summary stops the apply and keeps the edit", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    const summary = impact(dir);
    // The edit leaves the affected ADRs as the summary showed them: only the model binds it.
    const edited = ACCEPTED.replace(ORDER_EDIT[0], ORDER_EDIT[1]);
    write(dir, "docs/ontology/model.ttl", edited);
    const stale = apply(dir, summary.baseHash, [
      "--log",
      "`payment.payment-completed`: settled too",
    ]);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary; nothing was written/);
    assert.equal(read(dir, "docs/ontology/model.ttl"), edited);
  });
});

test("a same-meaning confirmation the summary did not show stops the apply", () => {
  withTmp((dir) => {
    // With no feature realizing the payment steps, the confirmation changes no
    // affected ADR: only the confirmations themselves differ from the approval.
    repo(dir, ACCEPTED, UNLINKED);
    draft(
      dir,
      ACCEPTED.replace('rdfs:label "Request the payment"', 'rdfs:label "Ask for the payment"'),
    );
    const unconfirmed = impact(dir);
    assert.deepEqual(unconfirmed.affectedAdrs, []);
    const stale = apply(dir, unconfirmed.baseHash, WORDING);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /changed after the approval summary; nothing was written/);
    assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
  });
});

test("an invalid draft, a malformed index draft or a draft linked to the model is refused before any write", () => {
  withTmp((dir) => {
    repo(dir);
    draft(
      dir,
      ACCEPTED.replace('    onto:definition "A person who buys products from the store." ;\n', ""),
    );
    const invalid = cli(dir, ["impact", "--draft", "draft", "--json"]);
    assert.equal(invalid.code, 1);
    assert.equal(JSON.parse(invalid.out).draftValid, false);
    const refused = apply(dir, JSON.parse(invalid.out).baseHash);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /nothing was written: the approved change must leave a valid model/);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    write(dir, "mapping.next.json", "{ not json");
    const malformed = apply(dir, impact(dir).baseHash, ["--mapping", "mapping.next.json"]);
    assert.equal(malformed.code, 1);
    assert.match(malformed.out, /nothing was written: --mapping mapping\.next\.json is not JSON/);
    assert.equal(apply(dir, "x", ["--mapping", "missing.json"]).code, 1);
    assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
    // A draft whose document is a link into the model would edit the model before approval.
    rmSync(path.join(dir, "draft"), { recursive: true });
    mkdirSync(path.join(dir, "draft"));
    symlinkSync(path.join(dir, "docs/ontology/model.ttl"), path.join(dir, "draft/model.ttl"));
    const linked = cli(dir, ["impact", "--draft", "draft"]);
    assert.equal(linked.code, 2);
    assert.match(linked.out, /an edit made through it has already changed the model/);
    // A hard link is the same file too.
    rmSync(path.join(dir, "draft"), { recursive: true });
    mkdirSync(path.join(dir, "draft"));
    linkSync(path.join(dir, "docs/ontology/model.ttl"), path.join(dir, "draft/model.ttl"));
    const hard = cli(dir, ["impact", "--draft", "draft"]);
    assert.equal(hard.code, 2, hard.out);
    assert.match(hard.out, /a model document under another name \(a link or a hard link\)/);
  });
});

test("a symlinked model document is written through to its target", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "shared/model.ttl", ACCEPTED);
    rmSync(path.join(dir, "docs/ontology/model.ttl"));
    symlinkSync(path.join(dir, "shared/model.ttl"), path.join(dir, "docs/ontology/model.ttl"));
    rmSync(path.join(dir, "draft"), { recursive: true, force: true });
    mkdirSync(path.join(dir, "draft"));
    write(
      dir,
      "draft/model.ttl",
      ACCEPTED.replace('"The money for an order was collected."', SETTLED),
    );
    const saved = apply(dir, impact(dir).baseHash, [
      "--log",
      "`payment.payment-completed`: settled too",
    ]);
    assert.equal(saved.code, 0, saved.out);
    assert.ok(
      lstatSync(path.join(dir, "docs/ontology/model.ttl")).isSymbolicLink(),
      "the link stays a link",
    );
    assert.match(read(dir, "shared/model.ttl"), /collected and settled/);
  });
});

test("dropping a linked model document removes the link, never the shared file it points to", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "shared/actors.ttl", ACTORS);
    symlinkSync("../../shared/actors.ttl", path.join(dir, "docs/ontology/actors.ttl"));
    commitAll(dir, "actors shared with another model");
    write(dir, "draft/model.ttl", ACCEPTED);
    const summary = impact(dir);
    assert.equal(summary.same, true, "model.ttl states every shared actor too");
    const saved = apply(dir, summary.baseHash);
    assert.equal(saved.code, 0, saved.out);
    assert.equal(read(dir, "shared/actors.ttl"), ACTORS);
    assert.throws(() => lstatSync(path.join(dir, "docs/ontology/actors.ttl")), { code: "ENOENT" });
    assert.equal(cli(dir, ["validate"]).code, 0);
  });
});

test("a draft that writes one model file under two names is refused before any write", () => {
  withTmp((dir) => {
    repo(dir);
    symlinkSync("model.ttl", path.join(dir, "docs/ontology/alias.ttl"));
    commitAll(dir, "a second name for the model");
    write(dir, "draft/model.ttl", `${ACCEPTED}\n${AUDITOR}`);
    write(dir, "draft/alias.ttl", `${PREFIXES}${AUDITOR}`);
    const refused = apply(dir, impact(dir).baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /alias\.ttl and docs\/ontology\/model\.ttl are one file \(/);
    assert.match(refused.out, /nothing was written/);
    assert.equal(read(dir, "docs/ontology/model.ttl"), ACCEPTED);
  });
});

test("a document reached through a linked directory is never removed through the model", () => {
  withTmp((dir) => {
    repo(dir);
    write(dir, "shared/extra.ttl", ACTORS);
    symlinkSync("../../shared", path.join(dir, "docs/ontology/shared"));
    commitAll(dir, "a shared directory linked into the model");
    write(dir, "draft/model.ttl", ACCEPTED);
    const refused = apply(dir, impact(dir).baseHash);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /shared\/extra\.ttl lives in a linked directory \(/);
    assert.match(refused.out, /nothing was written/);
    assert.equal(read(dir, "shared/extra.ttl"), ACTORS);
  });
});

test("a transition rewrites the Status in every document that states it", () => {
  withTmp((dir) => {
    repo(dir, paymentIn("Proposed"));
    const copy = `${PREFIXES}m:payment.take-payment onto:status "Proposed" .\n`;
    write(dir, "docs/ontology/copy.ttl", copy);
    commitAll(dir, "the Status stated in a second document");
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
    assert.equal(statusOf(dir, "payment.take-payment"), "Accepted (2020-01-20)");
    assert.equal(
      read(dir, "docs/ontology/copy.ttl"),
      copy.replace('"Proposed"', '"Accepted (2020-01-20)"'),
    );
    assert.equal(cli(dir, ["validate"]).code, 0);
  });
});

test("a transition changes a Status stated twice in one document, and a file with two names once", () => {
  withTmp((dir) => {
    repo(dir, `${paymentIn("Proposed")}\nm:payment.take-payment onto:status "Proposed" .\n`);
    symlinkSync("model.ttl", path.join(dir, "docs/ontology/alias.ttl"));
    commitAll(dir, "the Status stated twice, and a second name for the model");
    assert.equal(cli(dir, ["validate"]).code, 0, "a fact written twice is one fact");
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
    assert.equal(
      read(dir, "docs/ontology/model.ttl").match(/onto:status "Accepted \(2020-01-20\)"/g)?.length,
      2,
    );
    assert.doesNotMatch(
      read(dir, "docs/ontology/model.ttl"),
      /m:payment\.take-payment onto:status "Proposed"/,
    );
    assert.ok(lstatSync(path.join(dir, "docs/ontology/alias.ttl")).isSymbolicLink());
    exits(dir, ["validate"], 0);
  });
});

test("a transition never reports a Status it did not write", () => {
  withTmp((dir) => {
    // The order process's Status is written across two lines, so the first matching
    // line after it is the payment process's.
    const split = EXAMPLE.replace(
      'onto:status "Proposed" ;\n    onto:hasStep m:ordering',
      'onto:status\n        "Proposed" ;\n    onto:hasStep m:ordering',
    );
    assert.notEqual(split, EXAMPLE);
    repo(dir, split);
    const promoted = cli(dir, [
      "transition",
      "--process",
      "ordering.place-order",
      "--to",
      "Accepted",
      "--date",
      "2020-01-20",
    ]);
    assert.equal(promoted.code, 1, promoted.out);
    assert.match(promoted.out, /refusing to write|cannot locate the Status/);
    assert.equal(read(dir, "docs/ontology/model.ttl"), split);
  });
});

test("impact refuses an index it cannot read, as the save it prepares would", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2).slice(0, 80));
    const refused = cli(dir, ["impact", "--draft", "draft", "--json"]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /\[ontology-index-unreadable\] [^:]+:.*fix the ADR index before a change approval/,
    );
  });
});

test("impact refuses ADR records of a realizing feature the level cannot count, naming the cause validate names", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    for (const [adrs, cause] of [
      [{}, 'the ADR records of realizing feature "payments" are not a list'],
      [
        [{ status: "Accepted (2020-01-01)", summary: "s" }],
        'realizing feature "payments" has an ADR record without a path',
      ],
      [undefined, 'realizing feature "payments" has no ADR records'],
      [
        [{ path: "docs/adr/checkout/0001-a.md", status: "Accepted (2020-01-01)", summary: "s" }],
        'the index records "docs/adr/checkout/0001-a.md" for realizing feature "payments", which is not an ADR file of its folder',
      ],
      [
        [{ path: "docs/adr/payments/notes.md", status: "Accepted (2020-01-01)", summary: "s" }],
        'the index records "docs/adr/payments/notes.md" for realizing feature "payments", which is not an ADR file of its folder',
      ],
    ]) {
      const mapping = structuredClone(MAPPING);
      mapping.categories.payments.adrs = adrs;
      write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
      const refused = cli(dir, ["impact", "--draft", "draft", "--json"]);
      assert.equal(refused.code, 1, refused.out);
      assert.ok(
        refused.out.includes(
          `[ontology-adr-record-invalid] ${cause}; fix the ADR index before a change approval`,
        ),
        refused.out,
      );
      const validate = cli(dir, ["validate"]);
      assert.ok(validate.out.includes(cause), validate.out);
    }
    // An index draft the approval would save is held to the same rule.
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    const next = structuredClone(MAPPING);
    next.categories.payments.adrs = [
      { path: "docs/adr/payments/notes.md", status: "Accepted (2020-01-01)", summary: "s" },
    ];
    write(dir, "mapping.next.json", JSON.stringify(next, null, 2));
    const refused = cli(dir, ["impact", "--draft", "draft", "--mapping", "mapping.next.json"]);
    assert.equal(refused.code, 1, refused.out);
    assert.ok(
      refused.out.includes(
        '[ontology-adr-record-invalid] the index records "docs/adr/payments/notes.md" for realizing feature "payments", which is not an ADR file of its folder; fix the ADR index or its draft before a change approval',
      ),
      refused.out,
    );
  });
});

test("records that are not a list never crash a summary or a save, in the index or its draft", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    // An index draft that relinks a feature whose records are not a list.
    const next = structuredClone(MAPPING);
    next.categories.payments.adrs = {};
    next.categories.payments.realizes = [];
    write(dir, "mapping.next.json", JSON.stringify(next, null, 2));
    const summary = cli(dir, ["impact", "--draft", "draft", "--mapping", "mapping.next.json"]);
    assert.doesNotMatch(summary.out, /TypeError|at .*\.mjs:\d+/);
    // A save over an index whose records are not a list.
    const broken = structuredClone(MAPPING);
    broken.categories.payments.adrs = {};
    write(dir, "docs/adr/.mapping.json", JSON.stringify(broken, null, 2));
    const saved = apply(dir, "0".repeat(64));
    assert.equal(saved.code, 1, saved.out);
    assert.doesNotMatch(saved.out, /TypeError|at .*\.mjs:\d+/);
  });
});

test("impact refuses link records that are not lists of step ids, as the save it prepares would", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir, ACCEPTED.replace('"The money for an order was collected."', SETTLED));
    const mapping = structuredClone(MAPPING);
    mapping.categories.payments.realizes = "payment.request-payment";
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    const refused = cli(dir, ["impact", "--draft", "draft", "--json"]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(
      refused.out,
      /\[ontology-link-shape\] .*category "payments" has a realizes value that is not a list of step ids; fix the ADR index before a change approval/,
    );
  });
});

test("the summary judges links as the index draft saves them, and its text names every ADR the approval binds", () => {
  withTmp((dir) => {
    repo(dir, ACCEPTED, UNLINKED);
    draft(dir, ACCEPTED.replace(STEP_EDIT[0], STEP_EDIT[1]));
    // The index leaves the changed payment step unrealized; the draft links the payment feature to it.
    assert.deepEqual(impact(dir).unrealizedSystemSteps, ["payment.request-payment"]);
    write(dir, "mapping.next.json", JSON.stringify(MAPPING, null, 2));
    const args = ["--mapping", "mapping.next.json"];
    const summary = impact(dir, args);
    assert.deepEqual(summary.unrealizedSystemSteps, []);
    assert.deepEqual(summary.directlyAffectedCategories, ["payments"]);
    assert.deepEqual(summary.categoriesOfProposedProcesses, ["payments"]);
    assert.deepEqual(summary.relinkedCategories, ["payments"]);
    assert.deepEqual(summary.affectedAdrs, ["docs/adr/payments/0001-b.md"]);
    const text = exits(dir, ["impact", "--draft", "draft", ...args], 0).out;
    assert.match(text, /^system steps without a realizing feature: none$/m);
    assert.match(text, /^features whose index links change: payments$/m);
    assert.match(text, /^affected ADRs: docs\/adr\/payments\/0001-b\.md$/m);
    // The save checks the summary it binds against the same index.
    const saved = apply(dir, summary.baseHash, args);
    assert.equal(saved.code, 0, saved.out);
    assert.deepEqual(JSON.parse(read(dir, "docs/adr/.mapping.json")), MAPPING);
    // A relink alone binds the relinked feature's ADR, and the text names it as well.
    draft(dir);
    const relinked = structuredClone(MAPPING);
    relinked.categories.payments.realizes = ["payment.request-payment", "payment.capture-payment"];
    write(dir, "mapping.next.json", JSON.stringify(relinked, null, 2));
    const relink = exits(dir, ["impact", "--draft", "draft", ...args], 0).out;
    assert.match(relink, /^semantic change: none$/m);
    assert.match(relink, /^directly affected features: none$/m);
    assert.match(relink, /^features whose index links change: payments$/m);
    assert.match(relink, /^affected ADRs: docs\/adr\/payments\/0001-b\.md$/m);
  });
});

test("a relink binds only current ADRs of a feature that realizes a step before or after it", () => {
  withTmp((dir) => {
    repo(dir);
    draft(dir);
    // A retired ADR the payment feature keeps beside its current one.
    write(
      dir,
      "docs/adr/payments/0002-old.md",
      "# ADR 0002: old\n\n## Status\n\nSuperseded by [ADR 0001](0001-b.md)\n",
    );
    const next = structuredClone(MAPPING);
    next.categories.payments.adrs.push({
      path: "docs/adr/payments/0002-old.md",
      status: "Superseded by [ADR 0001](0001-b.md)",
      summary: "s",
    });
    next.categories.payments.realizes = ["payment.request-payment", "payment.capture-payment"];
    // A feature first recorded as realizing no step.
    write(
      dir,
      "docs/adr/reports/0001-r.md",
      "# ADR 0001: r\n\n## Status\n\nAccepted (2020-01-01)\n",
    );
    next.categories.reports = {
      adrs: [{ path: "docs/adr/reports/0001-r.md", status: "Accepted (2020-01-01)", summary: "s" }],
      realizes: [],
    };
    write(dir, "mapping.next.json", JSON.stringify(next, null, 2));
    const summary = impact(dir, ["--mapping", "mapping.next.json"]);
    assert.deepEqual(summary.relinkedCategories, ["payments", "reports"]);
    assert.deepEqual(summary.affectedAdrs, ["docs/adr/payments/0001-b.md"]);
  });
});

test("the impact text still summarizes a draft that parses but has an element of no known type", () => {
  withTmp((dir) => {
    repo(dir);
    // Sorted after the step, the unknown type is the one a type-keyed sort reaches second.
    draft(
      dir,
      `${ACCEPTED}\nm:zz.thing a onto:Bogus ; rdfs:label "Thing" .\nm:aa.new-step a onto:Step ; rdfs:label "New step" .\n`,
    );
    const run = cli(dir, ["impact", "--draft", "draft"]);
    assert.equal(run.code, 1, run.out);
    assert.doesNotMatch(run.out, /TypeError|at .*\.mjs:\d+/);
    assert.match(run.out, /^semantic change: 2 element\(s\) — added 1 \?, 1 Step$/m);
    assert.match(run.out, /^base hash: [0-9a-f]{64}$/m);
  });
});

test("a large change keeps the impact text readable and apply names what it marked Proposed", () => {
  withTmp((dir) => {
    repo(dir);
    const steps = Array.from(
      { length: 22 },
      (_, i) => `audit.step-${String(i + 1).padStart(2, "0")}`,
    );
    const audit = `
m:audit.keep-records a onto:Process ;
    rdfs:label "Keep records" ;
    onto:definition "The store keeps a record of every order." ;
    onto:startCondition "An order is placed." ;
    onto:businessOutcome "The order has a record." ;
    onto:openScope "none"^^onto:NoOpenScope ;
    onto:status "Proposed" ;
    onto:hasStep ${steps.map((s) => `m:${s}`).join(", ")} .
${steps
  .map(
    (s, i) => `
m:${s} a onto:Step ;
    rdfs:label "Record part ${i + 1}" ;
    onto:definition "The clerk records part ${i + 1} of the order." ;
    onto:stepKind "outside-system" ;${i + 1 < steps.length ? `\n    onto:flowsTo m:${steps[i + 1]} ;` : ""}
    onto:inContext m:ordering .
m:customer onto:performs m:${s} .`,
  )
  .join("\n")}

m:audit.keep-records.kept a onto:ObservationCriterion ;
    rdfs:label "Every order is kept" ;
    onto:startCondition "An order is placed." ;
    onto:observedResult "The order has a record." ;
    onto:criterionOf m:audit.keep-records .
`;
    draft(dir, `${ACCEPTED}${audit}`);
    const text = exits(dir, ["impact", "--draft", "draft"], 0).out;
    assert.match(
      text,
      /^semantic change: 25 element\(s\) — added 22 Step, 1 ObservationCriterion, 1 Process; changed 1 Actor$/m,
    );
    // The candidates are counted by bounded context; --json lists each one.
    assert.match(
      text,
      /^change-log candidates \(24; each one is listed by --json\):\n {2}audit: added 22 Step, 1 ObservationCriterion\n {2}customer: changed 1 Actor$/m,
    );
    for (const line of text.split("\n")) assert.ok(line.length <= 400, line.slice(0, 120));
    const summary = impact(dir);
    assert.equal(summary.majorChangeCandidates.length, 24);
    const saved = apply(dir, summary.baseHash, [
      "--log",
      "`audit.keep-records`: added — every order is kept",
    ]);
    assert.equal(saved.code, 0, saved.out);
    assert.match(
      saved.out,
      /^✓ applied; processes this save marked Proposed: audit\.keep-records$/m,
    );
  });
});

test("impact refuses an index draft the model it saves cannot resolve, as the save would", () => {
  withTmp((dir) => {
    repo(dir);
    const next = structuredClone(MAPPING);
    const linking = (realizes) => {
      next.categories.payments.realizes = realizes;
      write(dir, "mapping.next.json", JSON.stringify(next, null, 2));
      return cli(dir, ["impact", "--draft", "draft", "--mapping", "mapping.next.json"]);
    };
    draft(dir, ACCEPTED.replace(STEP_EDIT[0], STEP_EDIT[1]));
    const dangling = linking(["payment.request-payment", "payment.refund-payment"]);
    assert.equal(dangling.code, 1, dangling.out);
    assert.ok(
      dangling.out.includes(
        '[ontology-link-dangling] mapping.next.json: category "payments" realizes "payment.refund-payment", which is not a step of the ontology; fix the index draft before a change approval',
      ),
      dangling.out,
    );
    assert.doesNotMatch(dangling.out, /base hash/);
    // A link to a step of a process the draft retires.
    draft(dir, paymentIn("Deprecated (2020-01-30)"));
    const retired = linking(["payment.request-payment"]);
    assert.equal(retired.code, 1, retired.out);
    assert.match(
      retired.out,
      /\[ontology-link-retired\] mapping\.next\.json: category "payments" realizes step "payment\.request-payment" of the retired process "payment\.take-payment"; .*fix the index draft before a change approval/,
    );
    // A step only the draft adds is one the index draft may link.
    draft(
      dir,
      `${ACCEPTED}
m:payment.record-payment a onto:Step ;
    rdfs:label "Record the payment" ;
    onto:definition "The store records the collected money against its order." ;
    onto:stepKind "system" ;
    onto:uses m:payment.payment ;
    onto:inContext m:payment .

m:payment.capture-payment onto:flowsTo m:payment.record-payment .
m:payment.take-payment onto:hasStep m:payment.record-payment .
m:order-system onto:performs m:payment.record-payment .
`,
    );
    const added = linking(["payment.request-payment", "payment.record-payment"]);
    assert.equal(added.code, 0, added.out);
    const hash = /^base hash: (\S+)$/m.exec(added.out)[1];
    const saved = apply(dir, hash, ["--mapping", "mapping.next.json"]);
    assert.equal(saved.code, 0, saved.out);
  });
});
