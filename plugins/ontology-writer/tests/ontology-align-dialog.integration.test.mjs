import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { questionSession } from "./ontology-ask-helpers.mjs";
import { PLUGIN_ROOT, write, initRepo, commitAll } from "./helpers.mjs";

import { CLI } from "./ontology-helpers.mjs";

const model = `@prefix m: <urn:ontology-writer:model:> .
@prefix onto: <urn:ontology-writer:vocabulary:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:refunds a onto:BoundedContext ; rdfs:label "Refunds" ; onto:definition "Handle returns." ; onto:coreLogic "Credit a returned item." .
m:store a onto:Actor ; rdfs:label "Store" ; onto:definition "The store processing returns." ; onto:performs m:refund.credit .
m:returns a onto:Process ; rdfs:label "Refund an item" ; onto:definition "Credit a returned item." ; onto:startCondition "A customer starts a return." ; onto:businessOutcome "Credit on submission." ; onto:openScope "none"^^onto:NoOpenScope ; onto:status "Proposed" ; onto:hasStep m:refund.credit .
m:refund.credit a onto:Step ; rdfs:label "Credit" ; onto:definition "Issue the refund." ; onto:stepKind "system" ; onto:inContext m:refunds .
m:refund-recipient a onto:ObservationCriterion ; rdfs:label "Credit timing" ; onto:startCondition "A return moves through submission and receipt." ; onto:observedResult "Credit on submission." ; onto:criterionOf m:returns .
`;

const ask = path.join(PLUGIN_ROOT, "scripts/ontology-ask.mjs");

test("a whole-process request keeps Q&A, explicit approval and re-verification in one conversation", async () => {
  const project = mkdtempSync(path.join(tmpdir(), "align-dialog-"));
  initRepo(project);
  const adrPath = "docs/adr/refunds/0001-credit.md";
  const files = {
    ontology: write(project, "docs/ontology/returns.ttl", model),
    adr: write(
      project,
      adrPath,
      "# ADR 0001: Refund credit\n\n## Status\n\nAccepted (2020-01-01)\n\n## Decision\n\nCredit on submission.\n",
    ),
    code: write(
      project,
      "refund.mjs",
      'console.log(process.argv[2] === "submitted" ? "credited" : "pending");\n',
    ),
  };
  write(
    project,
    "docs/adr/.mapping.json",
    JSON.stringify({
      categories: {
        refunds: {
          feature: "Refunds",
          adrs: [
            { path: adrPath, status: "Accepted (2020-01-01)", summary: "Refund credit timing" },
          ],
          dependsOn: [],
          realizes: ["refund.credit"],
        },
      },
    }),
  );
  commitAll(project, "seed refund contracts");
  const owner = (script, ...args) =>
    execFileSync(process.execPath, [script, ...args], { cwd: project, encoding: "utf8" });
  const ontology = (...args) => owner(CLI, ...args);
  const adrStatus = (status) =>
    owner(path.join(PLUGIN_ROOT, "scripts/adr-status-transition.mjs"), adrPath, status);
  const s = questionSession({
    version: 1,
    questions: [],
    alignment: {
      projectRoot: project,
      processes: [{ id: "returns", criteria: [{ criterion: "refund-recipient" }] }],
    },
  });
  const helper = (...args) =>
    spawnSync(process.execPath, [ask, args[0], s.run, ...args.slice(1)], {
      cwd: project,
      encoding: "utf8",
    });
  const prompt = (id, body) => {
    const file = write(s.run, id + ".json", JSON.stringify({ id, ...body }));
    return helper("prompt", "work", "--file", file);
  };
  const wait = () => JSON.parse(helper("wait", "--timeout", "1").stdout);
  const respond = (id, decision, text = "") =>
    s.post("respond", { requestId: "work", promptId: id, decision, text });
  const snapshot = () => Object.values(files).map((p) => readFileSync(p, "utf8"));
  const actual = (state) =>
    execFileSync(process.execPath, [files.code, state], { encoding: "utf8" }).trim();
  try {
    const original = snapshot();
    assert.equal(helper("request", "work", "--process", "returns").status, 0);
    assert.equal(wait().messages[0].messageId, "work");
    assert.equal(
      prompt("q1", { kind: "question", question: "When should the credit be issued?" }).status,
      0,
    );
    assert.equal(
      (await respond("q1", "answer", "After the warehouse receives the return.")).status,
      200,
    );
    const catalogue = readFileSync(s.files.questions, "utf8");
    writeFileSync(s.files.questions, "{");
    try {
      assert.equal(wait().responses[0].decision, "answer");
    } finally {
      writeFileSync(s.files.questions, catalogue);
    }
    assert.notEqual(helper("approved", "work", "q1").status, 0);
    const changes = Object.entries(files).map(([layer, p], i) => ({
      layer,
      target: path.relative(project, p),
      before: original[i],
      after: original[i]
        .replaceAll("submitted", "received")
        .replaceAll("submission.", "warehouse receipt."),
    }));
    write(project, ".adr-review/draft/returns.ttl", changes[0].after);
    const impact = JSON.parse(ontology("impact", "--draft", ".adr-review/draft", "--json"));
    assert.equal(impact.draftValid, true);
    const proposal = {
      kind: "proposal",
      question: "Apply and retest these three changes?",
      changes,
      files: ["docs/adr/.mapping.json", ".adr-review/draft/returns.ttl"],
      verification: "Submit a return, then receive it; credit only on receipt.",
    };
    assert.equal(prompt("p1", proposal).status, 0);
    const baseline = (await s.state()).discussion.messages[0].dialogue.at(-1).baseline;
    assert.deepEqual(
      baseline.files,
      [...new Set([...proposal.files, ...changes.map((c) => c.target)])].sort(),
    );
    assert.match(baseline.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(
      (await respond("p1", "clarify", "What happens to a submitted return?")).status,
      200,
    );
    assert.equal(wait().responses[0].decision, "clarify");
    assert.deepEqual(snapshot(), original);
    assert.equal(
      prompt("p2", {
        ...proposal,
        question: "A submitted return stays pending. Apply these changes?",
      }).status,
      0,
    );
    assert.equal((await respond("p1", "approve")).status, 409);
    assert.equal((await respond("p2", "approve")).status, 200);
    assert.equal((await respond("p2", "approve")).status, 200);
    assert.equal(wait().responses.length, 1);
    const grant = helper("approved", "work", "p2");
    assert.equal(grant.status, 0, grant.stderr);
    assert.deepEqual(snapshot(), original);
    assert.equal(actual("submitted"), "credited");
    // Drive the actual owner CLIs for the approved fixture change, then exercise
    // the consumer application and verify its model through the real process query.
    ontology(
      "apply",
      "--draft",
      ".adr-review/draft",
      "--base-hash",
      impact.baseHash,
      "--log",
      "returns: credit on receipt — user confirmed the warehouse event",
    );
    const approved = JSON.parse(grant.stdout);
    writeFileSync(files.adr, approved.changes.find((c) => c.layer === "adr").after);
    adrStatus("Proposed");
    writeFileSync(files.code, approved.changes.find((c) => c.layer === "code").after);
    assert.equal(actual("submitted"), "pending");
    assert.equal(actual("received"), "credited");
    // The transition records the local calendar date, as every save does.
    const date = new Date().toLocaleDateString("sv-SE");
    adrStatus(`Accepted (${date})`);
    const plan = JSON.parse(ontology("align", "--process", "returns", "--json"));
    assert.deepEqual(plan.blocking, []);
    assert.equal(plan.criteria[0].observedResult, "Credit on warehouse receipt.");
    ontology("transition", "--process", "returns", "--to", "Accepted");
    const saved = JSON.parse(ontology("query", "--process", "returns", "--json"));
    assert.equal(saved.process.status, `Accepted (${date})`);
    assert.match(readFileSync(files.adr, "utf8"), /Credit on warehouse receipt/);
    assert.equal(
      helper(
        "reply",
        "work",
        "--text",
        JSON.stringify({
          outcome: "passed",
          evidence: "Both refund entry-point cases executed.",
          nextAction: "Inspect the refund evidence.",
        }),
      ).status,
      0,
    );
    const message = (await s.state()).discussion.messages[0];
    assert.deepEqual(
      message.dialogue.map((t) => t.response.decision),
      ["answer", "clarify", "approve"],
    );
    assert.equal(message.reply.result.outcome, "passed");
    assert.notEqual(helper("approved", "work", "p2").status, 0);
  } finally {
    s.done();
    rmSync(project, { recursive: true, force: true });
  }
});

test("declined, stale and partial requests cannot authorize edits", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "align-choice-"));
  const s = questionSession({
    version: 1,
    questions: [],
    alignment: {
      projectRoot: root,
      processes: [{ id: "returns", criteria: [{ criterion: "receipt" }] }],
    },
  });
  const p = write(root, "refund.md", "original");
  const file = write(
    s.run,
    "p.json",
    JSON.stringify({
      id: "p",
      kind: "proposal",
      question: "Change refund timing?",
      changes: [{ layer: "adr", target: "refund.md", before: "old", after: "new" }],
      files: ["refund.md"],
      verification: "check receipt",
    }),
  );
  const helper = (command, ...args) =>
    spawnSync(process.execPath, [ask, command, s.run, ...args], { encoding: "utf8" }).status;
  try {
    for (const [id, decision] of [
      ["denied", "decline"],
      ["stale", "approve"],
      ["late", "approve"],
    ]) {
      helper("request", id, "--process", "returns", "--criteria", JSON.stringify([]));
      assert.equal(helper("prompt", id, "--file", file), 0);
      if (id === "stale") writeFileSync(p, "newer user edit");
      assert.equal(
        (await s.post("respond", { requestId: id, promptId: "p", decision })).status,
        200,
      );
      if (id === "late") writeFileSync(p, "even newer edit");
      assert.notEqual(helper("approved", id, "p"), 0);
    }
    const states = (await s.state()).discussion.messages;
    assert.deepEqual(
      states.map((m) => m.dialogue[0].response.decision),
      ["decline", "stale", "approve"],
    );
    helper("request", "part", "--process", "returns", "--criteria", JSON.stringify(["receipt"]));
    assert.notEqual(helper("prompt", "part", "--file", file), 0);
    assert.equal(readFileSync(p, "utf8"), "even newer edit");
  } finally {
    s.done();
    rmSync(root, { recursive: true, force: true });
  }
});

test(
  "a proposal cannot be reused after a target symlink moves to an identical file",
  { skip: process.platform === "win32" },
  async () => {
    const project = mkdtempSync(path.join(tmpdir(), "align-retarget-"));
    const s = questionSession({
      version: 1,
      questions: [],
      alignment: { projectRoot: project, processes: [{ id: "refunds", criteria: [] }] },
    });
    try {
      const link = path.join(project, "current.md");
      write(project, "a.md", "same");
      write(project, "b.md", "same");
      symlinkSync("a.md", link);
      const file = write(
        s.run,
        "offer.json",
        JSON.stringify({
          id: "offer",
          kind: "proposal",
          question: "Change the contract?",
          changes: [{ layer: "adr", target: "current.md", before: "same", after: "revised" }],
          verification: "Run the real feature.",
          files: ["current.md"],
        }),
      );
      const helper = (cmd, ...args) =>
        spawnSync(process.execPath, [ask, cmd, s.run, "request", ...args], { encoding: "utf8" });
      assert.equal(helper("request", "--process", "refunds").status, 0);
      assert.equal(helper("prompt", "--file", file).status, 0);
      assert.equal(
        (await s.post("respond", { requestId: "request", promptId: "offer", decision: "approve" }))
          .status,
        200,
      );
      assert.equal(helper("approved", "offer").status, 0);
      unlinkSync(link);
      symlinkSync("b.md", link);
      assert.notEqual(helper("approved", "offer").status, 0);
    } finally {
      s.done();
      rmSync(project, { recursive: true, force: true });
    }
  },
);
