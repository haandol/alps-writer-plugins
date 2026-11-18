import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { validateEventBoard } from "../scripts/eventstorming-board.mjs";
import { parseQuestions } from "../scripts/ontology-ask.mjs";
import { checkCandidates, readCurrentModel } from "../scripts/ontology-candidates.mjs";
import { diffGraphs, parseTurtle, validateModel } from "../scripts/ontology-lib.mjs";
import { PLUGIN_ROOT, withTmp } from "./helpers.mjs";

const SCRIPT = path.join(PLUGIN_ROOT, "scripts/ontology-candidates.mjs");
const FIXTURE = JSON.parse(
  readFileSync(path.join(PLUGIN_ROOT, "tests/fixtures/candidates-order.json"), "utf8"),
);
const MAPPING = {
  categories: {
    ordering: {
      feature: "Ordering",
      adrs: [
        {
          path: "docs/adr/ordering/0001-submit-order.md",
          status: "Accepted (2026-01-01)",
          summary: "s",
        },
      ],
    },
  },
};

/** A project with an ADR index and, optionally, a saved model. */
function project(dir, candidates = FIXTURE) {
  mkdirSync(path.join(dir, "docs/adr"), { recursive: true });
  writeFileSync(path.join(dir, "docs/adr/.mapping.json"), JSON.stringify(MAPPING));
  writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(candidates));
}
const run = (dir, ...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: "utf8" });
const draftDocs = (dir, name) =>
  readdirSync(path.join(dir, name))
    .sort()
    .map((f) => ({ doc: f, text: readFileSync(path.join(dir, name, f), "utf8") }));
const triplesOf = (docs) => docs.flatMap((d) => parseTurtle(d.text, d.doc).triples);

test("a project without a model gets a valid draft, board, index draft and questions", () => {
  withTmp((dir) => {
    project(dir);
    const out = run(dir, "prepare", "candidates.json", "--run", "run");
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const docs = draftDocs(dir, "run/draft");
    assert.deepEqual(
      docs.map((d) => d.doc),
      ["actors.ttl", "ordering.ttl", "payment.ttl"],
    );
    const check = validateModel(docs, { requireKnowledgeLayers: true });
    assert.deepEqual(
      check.findings.filter((f) => f.level === "error"),
      [],
    );
    assert.match(docs[1].text, /onto:status "Proposed"/, "a new process starts Proposed");
    const board = JSON.parse(readFileSync(path.join(dir, "run/board.json"), "utf8"));
    assert.deepEqual(validateEventBoard(board), []);
    assert.ok(
      board.links.some((l) => l.relation === "causal" && l.to === "ordering.confirm-order"),
    );
    const questions = readFileSync(path.join(dir, "run/ask/questions.json"), "utf8");
    assert.equal(parseQuestions(questions).ok, true);
    assert.match(JSON.parse(questions).questions[0].diagram.source, /^flowchart LR/);
    const mapping = JSON.parse(readFileSync(path.join(dir, "run/mapping.draft.json"), "utf8"));
    assert.deepEqual(mapping.categories.ordering.realizes, ["ordering.submit-order"]);
    assert.ok(existsSync(path.join(dir, "run/candidates-summary.json")));
    assert.deepEqual(
      readdirSync(dir).sort(),
      ["candidates.json", "docs", "run"],
      "writes only in the run",
    );
  });
});

test("the save draft holds only confirmed candidates and names every relation it left out", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    c.steps[2].confirmed = false;
    project(dir, c);
    const out = run(dir, "prepare", "candidates.json", "--run", "run", "--confirmed-only");
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const ids = new Set(triplesOf(draftDocs(dir, "run/save-draft")).map((t) => t.s));
    assert.ok(!ids.has("urn:ontology-writer:model:ordering.confirm-order"));
    assert.match(out.stdout, /ordering\.place-order hasStep ordering\.confirm-order: left out/);
    assert.ok(
      !existsSync(path.join(dir, "run/board.json")),
      "a save draft writes no review artifacts",
    );
  });
});

test("a save draft that leaves out an unconfirmed path cannot claim the process has no open scope", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    c.steps[2].confirmed = false;
    c.processes[0].openScope = [{ kind: "none" }];
    project(dir, c);
    const out = run(dir, "prepare", "candidates.json", "--run", "run", "--confirmed-only");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(
      out.stdout,
      /ordering\.place-order openScope: "none" cannot be saved while ordering\.place-order hasStep ordering\.confirm-order is left out/,
    );
    // A path left out through an event or a policy names the same process.
    assert.match(
      out.stdout,
      /while ordering\.on-payment-completed-confirm-order starts ordering\.confirm-order is left out/,
    );

    // With every step left out, no hasStep remains to find the process by.
    const allCut = structuredClone(c);
    for (const step of allCut.steps) step.confirmed = false;
    project(dir, allCut);
    const none = run(dir, "prepare", "candidates.json", "--run", "run-all", "--confirmed-only");
    assert.equal(none.status, 1, none.stdout + none.stderr);
    assert.match(none.stdout, /ordering\.place-order openScope: "none" cannot be saved/);

    c.processes[0].openScope = [
      { kind: "open-path", text: "Confirming an order is not settled yet." },
    ];
    project(dir, c);
    const recorded = run(dir, "prepare", "candidates.json", "--run", "run2", "--confirmed-only");
    assert.equal(recorded.status, 0, recorded.stdout + recorded.stderr);
    // The review draft shows the same candidates without refusing them.
    c.processes[0].openScope = [{ kind: "none" }];
    project(dir, c);
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "run3").status, 0);
  });
});

test("a save draft never carries an input document's name, file, page or quoted passage into the model", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    const rule = c.rules[0];
    rule.evidence = [{ source: "영업 회의록", detail: "3행" }];
    rule.basis = {
      kind: "operating-policy",
      text: '주문정책서.pdf 12쪽: "결제가 끝난 주문만 확정한다"',
    };
    rule.comment = ["영업 회의록에서 확인한 규칙"];
    c.steps[0].definition = "고객 주문을 접수한다 (p. 4 참고).";
    project(dir, c);
    const save = run(dir, "prepare", "candidates.json", "--run", "run", "--confirmed-only");
    assert.equal(save.status, 1, save.stdout + save.stderr);
    for (const why of [
      `rules\\[0\\] \\(${rule.id}\\) basis: names the file 주문정책서\\.pdf`,
      `rules\\[0\\] \\(${rule.id}\\) comment: names the input document "영업 회의록"`,
      `steps\\[0\\] \\(${c.steps[0].id}\\) definition: cites the page "p\\. 4"`,
    ])
      assert.match(save.stdout, new RegExp(why));

    // A review draft shows the same problems as warnings; the user still sees the candidates.
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "review").status, 0);
    const summary = readFileSync(path.join(dir, "review/candidates-summary.json"), "utf8");
    assert.match(summary, /names the file 주문정책서\.pdf/);

    // A short sentence naming a regulation and its article is a basis, not a source trace.
    rule.basis = { kind: "regulation", text: '전자상거래법 제17조의 "청약 철회" 규정을 따른다.' };
    rule.comment = [];
    c.steps[0].definition = "고객 주문을 접수한다.";
    project(dir, c);
    const clean = run(dir, "prepare", "candidates.json", "--run", "clean", "--confirmed-only");
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    rule.basis.text = '"결제가 끝난 주문만 확정한다"는 문장을 따른다.';
    project(dir, c);
    const quoted = run(dir, "prepare", "candidates.json", "--run", "quoted", "--confirmed-only");
    assert.equal(quoted.status, 1);
    assert.match(quoted.stdout, /basis: quotes a source passage/);
  });
});

test("the save index draft adds only confirmed realization links, while the review draft shows them all", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    c.links.push({
      category: "ordering",
      step: "ordering.confirm-order",
      reason: "The same feature may also confirm orders.",
      verdict: "unconfirmed",
      evidence: [],
      confirmed: false,
    });
    project(dir, c);
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "review").status, 0);
    const save = run(dir, "prepare", "candidates.json", "--run", "save", "--confirmed-only");
    assert.equal(save.status, 0, save.stdout + save.stderr);
    const realizes = (file) =>
      JSON.parse(readFileSync(path.join(dir, file), "utf8")).categories.ordering.realizes;
    assert.deepEqual(realizes("review/mapping.draft.json"), [
      "ordering.submit-order",
      "ordering.confirm-order",
    ]);
    assert.deepEqual(realizes("save/mapping.save.json"), ["ordering.submit-order"]);
    // The project's index itself is untouched by either draft.
    assert.equal(
      JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8")).categories.ordering
        .realizes,
      undefined,
    );
  });
});

test("link candidates in a project without an ADR index are reported, not silently dropped", () => {
  withTmp((dir) => {
    writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(FIXTURE));
    const out = run(dir, "prepare", "candidates.json", "--run", "run");
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(
      out.stdout,
      /links: 1 realization link candidate\(s\) not drafted, because the project has no ADR index/,
    );
    assert.ok(!existsSync(path.join(dir, "run/mapping.draft.json")));
  });
});

test("rebuilding from the same candidates changes nothing, and a wording change needs `changes`", () => {
  withTmp((dir) => {
    project(dir);
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "first").status, 0);
    mkdirSync(path.join(dir, "docs/ontology"));
    for (const d of draftDocs(dir, "first/draft"))
      writeFileSync(path.join(dir, "docs/ontology", d.doc), d.text);
    const saved = triplesOf(draftDocs(dir, "docs/ontology"));
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "again").status, 0);
    assert.equal(diffGraphs(saved, triplesOf(draftDocs(dir, "again/draft"))).same, true);

    const renamed = structuredClone(FIXTURE);
    renamed.steps[0].label = "주문서 접수";
    writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(renamed));
    const kept = run(dir, "prepare", "candidates.json", "--run", "kept");
    assert.match(kept.stdout, /ordering\.submit-order rdfs:label: kept the current wording/);
    assert.equal(diffGraphs(saved, triplesOf(draftDocs(dir, "kept/draft"))).same, true);

    renamed.steps[0].changes = ["label"];
    writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(renamed));
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "changed").status, 0);
    const diff = diffGraphs(saved, triplesOf(draftDocs(dir, "changed/draft")));
    assert.deepEqual(
      diff.elements.map((e) => e.id),
      ["ordering.submit-order"],
    );
  });
});

test("the check names serial ids, missing bases, unknown references and type clashes", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    c.rules[0].id = "ordering.rule-01";
    delete c.rules[0].basis;
    c.steps[0].flowsTo = ["ordering.no-such-step"];
    c.events[0].id = "ordering.submit-order";
    const { errors, warnings } = checkCandidates(c, readCurrentModel(path.join(dir, "none")));
    assert.ok(warnings.some((w) => /ordering\.rule-01 names a number/.test(w)));
    assert.ok(warnings.some((w) => /rules\[0\]: no basis was found/.test(w)));
    assert.ok(errors.some((e) => /ordering\.no-such-step is neither a candidate/.test(e)));
    assert.ok(errors.some((e) => /id ordering\.submit-order is already used/.test(e)));
    project(dir, c);
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "run").status, 1);
    assert.ok(!existsSync(path.join(dir, "run")), "unusable candidates write nothing");
  });
});

test("the run directory may not be the model directory", () => {
  withTmp((dir) => {
    project(dir);
    mkdirSync(path.join(dir, "docs/ontology"));
    const out = run(dir, "prepare", "candidates.json", "--run", "docs/ontology/run");
    assert.equal(out.status, 2);
    assert.match(out.stderr, /must not be inside the model directory/);
  });
});
