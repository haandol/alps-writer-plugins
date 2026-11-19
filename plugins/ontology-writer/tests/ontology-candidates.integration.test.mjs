import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { validateEventBoard } from "../scripts/eventstorming-board.mjs";
import { parseQuestions } from "../scripts/ontology-ask.mjs";
import { checkCandidates, readCurrentModel } from "../scripts/ontology-candidates.mjs";
import { diffGraphs, parseTurtle, sourceTrace, validateModel } from "../scripts/ontology-lib.mjs";
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
/** Save candidates as the project's first model, as an approved first build would. */
function saveFirstModel(dir, candidates) {
  project(dir, candidates);
  const out = run(dir, "prepare", "candidates.json", "--run", "first", "--confirmed-only");
  assert.equal(out.status, 0, out.stdout + out.stderr);
  mkdirSync(path.join(dir, "docs/ontology"));
  for (const d of draftDocs(dir, "first/save-draft"))
    writeFileSync(path.join(dir, "docs/ontology", d.doc), d.text);
}

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

test("an unconfirmed hand-off policy cuts the path it declares, though every step is confirmed", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    c.policies[0].confirmed = false; // payment completed → confirm the order
    c.processes[0].openScope = [{ kind: "none" }];
    project(dir, c);
    const out = run(dir, "prepare", "candidates.json", "--run", "run", "--confirmed-only");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    for (const path of [
      "payment\\.payment-completed triggers ordering\\.on-payment-completed-confirm-order",
      "ordering\\.on-payment-completed-confirm-order starts ordering\\.confirm-order",
    ])
      assert.match(
        out.stdout,
        new RegExp(
          `ordering\\.place-order openScope: "none" cannot be saved while ${path} is left out`,
        ),
      );
    assert.ok(!existsSync(path.join(dir, "run")), "a refused save draft writes nothing");

    c.processes[0].openScope = [
      { kind: "open-path", text: "결제 완료 뒤 주문 확정으로 넘어가는 경로가 확인되지 않았다." },
    ];
    project(dir, c);
    const recorded = run(dir, "prepare", "candidates.json", "--run", "run2", "--confirmed-only");
    assert.equal(recorded.status, 0, recorded.stdout + recorded.stderr);
    assert.match(
      recorded.stdout,
      /ordering\.on-payment-completed-confirm-order starts ordering\.confirm-order: left out/,
    );
  });
});

test("an extension's unconfirmed new hand-off on an existing step keeps the process from claiming no open scope", () => {
  withTmp((dir) => {
    // A first model whose process claims it has no open scope.
    const first = structuredClone(FIXTURE);
    first.processes[0].openScope = [{ kind: "none" }];
    first.links = [];
    saveFirstModel(dir, first);
    // A new document adds a path between two existing steps; the user confirms only a rule.
    const ext = {
      version: 1,
      title: "extension",
      scope: "주문 제출부터 확정까지",
      language: "ko",
      steps: [
        {
          id: "ordering.submit-order",
          verdict: "stated",
          evidence: [{ source: "zero.md", detail: "1행" }],
          confirmed: false,
          flowsTo: ["payment.request-payment", "ordering.confirm-order"],
        },
      ],
      rules: [
        {
          id: "ordering.confirm-orders-once",
          label: "주문은 한 번만 확정",
          definition: "같은 주문을 두 번 확정하지 않는다.",
          verdict: "stated",
          evidence: [{ source: "zero.md", detail: "2행" }],
          confirmed: true,
          basis: { kind: "operating-policy", text: "주문 운영 정책을 따른다." },
          constrains: ["ordering.submit-order", "ordering.confirm-order"],
        },
      ],
    };
    project(dir, ext);
    const out = run(dir, "prepare", "candidates.json", "--run", "ext", "--confirmed-only");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(
      out.stdout,
      /ordering\.place-order openScope: "none" cannot be saved while ordering\.submit-order flowsTo ordering\.confirm-order is left out/,
    );
    // The relation the model already holds is not a left-out path.
    assert.doesNotMatch(out.stdout, /submit-order flowsTo payment\.request-payment is left out/);
    assert.match(
      out.stdout,
      /ordering\.submit-order flowsTo ordering\.confirm-order: left out, because the user has not confirmed it/,
    );
    assert.ok(!existsSync(path.join(dir, "ext")), "a refused save draft writes nothing");

    // The new path may also lead to a new, unconfirmed step, listed or not on the process.
    const toNew = structuredClone(ext);
    toNew.steps[0].flowsTo = ["payment.request-payment", "ordering.close-zero-amount-order"];
    toNew.steps.push({
      id: "ordering.close-zero-amount-order",
      label: "0원 주문 종결",
      definition: "결제할 금액이 없는 주문을 바로 끝낸다.",
      context: "ordering",
      kind: "system",
      verdict: "stated",
      evidence: [{ source: "zero.md", detail: "1행" }],
      confirmed: false,
    });
    for (const listed of [false, true]) {
      const c = structuredClone(toNew);
      if (listed)
        c.processes = [
          {
            id: "ordering.place-order",
            verdict: "stated",
            evidence: [{ source: "zero.md", detail: "1행" }],
            confirmed: false,
            steps: [...first.processes[0].steps, "ordering.close-zero-amount-order"],
          },
        ];
      project(dir, c);
      const cut = run(
        dir,
        "prepare",
        "candidates.json",
        "--run",
        `new-${listed}`,
        "--confirmed-only",
      );
      assert.equal(cut.status, 1, cut.stdout + cut.stderr);
      assert.match(
        cut.stdout,
        /ordering\.place-order openScope: "none" cannot be saved while ordering\.submit-order flowsTo ordering\.close-zero-amount-order is left out/,
      );
    }

    // Recording that path as an open path (or the axis as not applicable) replaces the saved
    // "none", and the save draft is a valid model that no longer claims it.
    for (const kind of ["open-path", "not-applicable"]) {
      const c = structuredClone(toNew);
      c.processes = [
        {
          id: "ordering.place-order",
          verdict: "stated",
          evidence: [{ source: "zero.md", detail: "1행" }],
          confirmed: true,
          openScope: [{ kind, text: "0원 주문의 종결 경로는 확인되지 않았다." }],
        },
      ];
      project(dir, c);
      const out = run(
        dir,
        "prepare",
        "candidates.json",
        "--run",
        `scope-${kind}`,
        "--confirmed-only",
      );
      assert.equal(out.status, 0, out.stdout + out.stderr);
      const docs = draftDocs(dir, `scope-${kind}/save-draft`);
      const ordering = docs.find((d) => d.doc === "ordering.ttl").text;
      assert.doesNotMatch(ordering, /NoOpenScope/, kind);
      assert.match(ordering, /0원 주문의 종결 경로는 확인되지 않았다/, kind);
      assert.deepEqual(
        validateModel(docs).findings.filter((f) => f.level === "error"),
        [],
        kind,
      );
    }
  });
});

test("an existing step's unconfirmed hand-off into another process is cut at the step's own process", () => {
  withTmp((dir) => {
    const first = structuredClone(FIXTURE);
    first.processes[0].openScope = [{ kind: "none" }];
    first.links = [];
    saveFirstModel(dir, first);
    // A confirmed returns process whose step the order flow would now hand work to.
    const ext = {
      version: 1,
      title: "returns",
      scope: "주문 확정 뒤 반품",
      language: "ko",
      contexts: [
        {
          id: "returns",
          label: "반품",
          definition: "고객이 돌려보낸 상품을 처리한다.",
          coreLogic: "반품을 받고 환불을 요청한다.",
          verdict: "stated",
          evidence: [{ source: "returns.md", detail: "1행" }],
          confirmed: true,
        },
      ],
      processes: [
        {
          id: "returns.handle-return",
          label: "반품 처리",
          definition: "반품을 받아 처리한다.",
          context: "returns",
          startCondition: "고객이 반품을 요청했다.",
          businessOutcome: "반품이 처리되었다.",
          steps: ["returns.receive-return"],
          openScope: [{ kind: "open-path", text: "환불 경로는 확인되지 않았다." }],
          verdict: "stated",
          evidence: [{ source: "returns.md", detail: "1행" }],
          confirmed: true,
        },
      ],
      steps: [
        {
          id: "returns.receive-return",
          label: "반품 접수",
          definition: "고객의 반품을 접수한다.",
          context: "returns",
          kind: "outside-system",
          performers: ["customer"],
          verdict: "stated",
          evidence: [{ source: "returns.md", detail: "2행" }],
          confirmed: true,
        },
        {
          id: "ordering.confirm-order",
          verdict: "inferred",
          evidence: [{ source: "returns.md", detail: "3행" }],
          confirmed: false,
          flowsTo: ["returns.receive-return"],
        },
      ],
    };
    project(dir, ext);
    const out = run(dir, "prepare", "candidates.json", "--run", "ext", "--confirmed-only");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(
      out.stdout,
      /ordering\.place-order openScope: "none" cannot be saved while ordering\.confirm-order flowsTo returns\.receive-return is left out/,
    );
  });
});

test("a step whose open path this save records keeps its process from claiming no open scope", () => {
  withTmp((dir) => {
    // A first build: the process claims none while one of its steps records an open path.
    const c = structuredClone(FIXTURE);
    c.processes[0].openScope = [{ kind: "none" }];
    c.steps[0].openScope = [{ kind: "open-path", text: "주문 취소 경로는 확인되지 않았다." }];
    project(dir, c);
    const out = run(dir, "prepare", "candidates.json", "--run", "run", "--confirmed-only");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(
      out.stdout,
      /ordering\.place-order openScope: "none" cannot be saved while its step ordering\.submit-order records an open path/,
    );
    // Recorded on the process as well, the same path saves.
    c.processes[0].openScope = [{ kind: "open-path", text: "주문 취소 경로는 확인되지 않았다." }];
    project(dir, c);
    assert.equal(
      run(dir, "prepare", "candidates.json", "--run", "run2", "--confirmed-only").status,
      0,
    );
  });
});

test("on an extension, a new step open path is refused under a none process, and an old one is left alone", () => {
  withTmp((dir) => {
    const first = structuredClone(FIXTURE);
    first.processes[0].openScope = [{ kind: "none" }];
    first.links = [];
    saveFirstModel(dir, first);
    const stepPath = (text) => ({
      version: 1,
      title: "extension",
      scope: "주문 제출",
      language: "ko",
      steps: [
        {
          id: "ordering.submit-order",
          verdict: "stated",
          evidence: [{ source: "x.md", detail: "1행" }],
          confirmed: true,
          openScope: [{ kind: "open-path", text }],
        },
      ],
    });
    // This save gives an existing step an open path while its process keeps "none".
    project(dir, stepPath("0원 주문의 처리는 확인되지 않았다."));
    const refused = run(dir, "prepare", "candidates.json", "--run", "ext", "--confirmed-only");
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stdout, /its step ordering\.submit-order records an open path/);
    // A model that already holds that combination still accepts an unrelated save.
    const held = draftDocs(dir, "first/save-draft").map((d) =>
      d.doc === "ordering.ttl"
        ? {
            ...d,
            text: d.text.replace(
              /(m:ordering\.submit-order a onto:Step ;)/,
              '$1\n    onto:openScope "취소 경로는 확인되지 않았다."^^onto:OpenPath ;',
            ),
          }
        : d,
    );
    assert.ok(held.find((d) => d.doc === "ordering.ttl").text.includes("onto:OpenPath"));
    for (const d of held) writeFileSync(path.join(dir, "docs/ontology", d.doc), d.text);
    const rule = structuredClone(FIXTURE.rules[0]);
    rule.id = "ordering.confirm-orders-once";
    rule.label = "주문은 한 번만 확정";
    rule.definition = "같은 주문을 두 번 확정하지 않는다.";
    project(dir, { version: 1, title: "rule", scope: "주문 확정", language: "ko", rules: [rule] });
    const untouched = run(dir, "prepare", "candidates.json", "--run", "rule", "--confirmed-only");
    assert.equal(untouched.status, 0, untouched.stdout + untouched.stderr);
  });
});

test("a save that declares no open scope for a process whose step already records an open path is refused", () => {
  withTmp((dir) => {
    // A first model whose process records nothing about open scope while a step has an open path.
    const first = structuredClone(FIXTURE);
    delete first.processes[0].openScope;
    first.steps[0].openScope = [{ kind: "open-path", text: "주문 취소 경로는 확인되지 않았다." }];
    first.links = [];
    saveFirstModel(dir, first);
    // The user now confirms that the process has no open scope at all.
    project(dir, {
      version: 1,
      title: "scope",
      scope: "주문",
      language: "ko",
      processes: [
        {
          id: "ordering.place-order",
          verdict: "stated",
          evidence: [{ source: "x.md", detail: "1행" }],
          confirmed: true,
          openScope: [{ kind: "none" }],
        },
      ],
    });
    const out = run(dir, "prepare", "candidates.json", "--run", "none", "--confirmed-only");
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(out.stdout, /its step ordering\.submit-order records an open path/);
  });
});

test('one candidate cannot mix "none" with other open-scope items', () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    c.processes[0].openScope = [{ kind: "none" }, { kind: "open-path", text: "취소는 미정이다." }];
    const { errors } = checkCandidates(c, readCurrentModel(path.join(dir, "none")));
    assert.ok(
      errors.some((e) => /openScope "none" stands alone/.test(e)),
      errors.join("; "),
    );
  });
});

test("an extension's review draft repeats current elements by id and still gets a valid board", () => {
  withTmp((dir) => {
    const first = structuredClone(FIXTURE);
    first.links = [];
    saveFirstModel(dir, first);
    // A new step emits a current event; current elements are repeated by id only.
    const ext = {
      version: 1,
      title: "extension",
      scope: "결제 뒤 영수증",
      language: "ko",
      contexts: [{ id: "payment", verdict: "stated", evidence: [], confirmed: false }],
      events: [
        { id: "payment.payment-completed", verdict: "stated", evidence: [], confirmed: false },
      ],
      policies: [
        {
          id: "ordering.on-payment-completed-confirm-order",
          trigger: "payment.payment-completed",
          verdict: "stated",
          evidence: [],
          confirmed: false,
        },
      ],
      steps: [
        {
          id: "payment.request-payment",
          verdict: "stated",
          evidence: [],
          confirmed: false,
          emits: ["payment.payment-completed"],
        },
        {
          id: "payment.send-receipt",
          label: "영수증 발송",
          definition: "결제가 끝나면 영수증을 보낸다.",
          context: "payment",
          kind: "system",
          emits: ["payment.payment-completed"],
          verdict: "stated",
          evidence: [{ source: "receipt.md", detail: "1행" }],
          confirmed: false,
        },
      ],
      questions: [
        { id: "Q1", text: "영수증은 확정 전에도 보내나요?", stages: ["ordering.confirm-order"] },
        { id: "Q2", text: "영수증은 이메일로만 보내나요?", stages: ["payment.send-receipt"] },
      ],
    };
    project(dir, ext);
    const out = run(dir, "prepare", "candidates.json", "--run", "review");
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const board = JSON.parse(readFileSync(path.join(dir, "review/board.json"), "utf8"));
    assert.deepEqual(validateEventBoard(board), []);
    const stage = board.stages.find((x) => x.id === "payment.request-payment");
    assert.ok(stage.event.description, "the current event's definition fills its description");
    // The repeated policy reads its label and reaction condition from the current model.
    assert.equal(stage.policies.length, 1, JSON.stringify(stage));
    assert.match(stage.policies[0], /^\S.*: \S/, stage.policies[0]);
    assert.ok(!stage.policies[0].startsWith("undefined"), stage.policies[0]);
    // Q1 asks about a current step no candidate repeats: it stays in the session, off the board.
    assert.deepEqual(
      board.questions.map((q) => q.id),
      ["Q2"],
    );
    const session = JSON.parse(readFileSync(path.join(dir, "review/ask/questions.json"), "utf8"));
    assert.deepEqual(
      session.questions.map((q) => q.id),
      ["Q1", "Q2"],
      "both questions stay in the session",
    );
  });
});

test("the review summary lists every candidate the user has not confirmed, stated ones included", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    for (const kind of ["steps", "policies", "rules"])
      for (const item of c[kind]) item.confirmed = false;
    project(dir, c);
    assert.equal(run(dir, "prepare", "candidates.json", "--run", "run").status, 0);
    const summary = JSON.parse(readFileSync(path.join(dir, "run/candidates-summary.json"), "utf8"));
    const needs = summary.contexts.flatMap((e) => e.needsConfirmation).sort();
    assert.deepEqual(needs, [...c.steps, ...c.policies, ...c.rules].map((item) => item.id).sort());
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
    assert.ok(
      !existsSync(path.join(dir, "run")),
      "a refused save draft cannot reach impact or apply",
    );
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

    // A basis may name the policy it follows, even when the input document has that title.
    rule.evidence = [{ source: "주문 운영 정책", detail: "확정 조건" }];
    rule.basis = { kind: "operating-policy", text: "주문 운영 정책의 확정 조건을 따른다." };
    project(dir, c);
    const named = run(dir, "prepare", "candidates.json", "--run", "named", "--confirmed-only");
    assert.equal(named.status, 0, named.stdout + named.stderr);
    // Elsewhere, and as a path, the same source is a trace; so are an open path and a condition.
    rule.comment = ["주문 운영 정책에서 확인한 규칙"];
    rule.evidence = [{ source: "policies/주문 운영 정책", detail: "확정 조건" }];
    rule.basis.text = "policies/주문 운영 정책의 확정 조건을 따른다.";
    c.processes[0].openScope = [{ kind: "open-path", text: "재시도는 회의록.docx에서 미정이다." }];
    c.policies[0].condition = "결제가 승인되었다 (5쪽).";
    project(dir, c);
    const traced = run(dir, "prepare", "candidates.json", "--run", "traced", "--confirmed-only");
    assert.equal(traced.status, 1);
    for (const why of [
      `rules\\[0\\] \\(${rule.id}\\) comment: names the input document "주문 운영 정책"`,
      `rules\\[0\\] \\(${rule.id}\\) basis: names the input document "policies/주문 운영 정책"`,
      `processes\\[0\\] \\(${c.processes[0].id}\\) openScope: names the file 회의록\\.docx`,
      `policies\\[0\\] \\(${c.policies[0].id}\\) reactionCondition: cites the page "5쪽"`,
    ])
      assert.match(traced.stdout, new RegExp(why));
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

test("a feature with an empty realization record takes a confirmed link candidate; the project's index stays as it is", () => {
  withTmp((dir) => {
    const c = structuredClone(FIXTURE);
    project(dir, c);
    const index = {
      categories: {
        ...MAPPING.categories,
        notifications: { feature: "Notifications", adrs: [], realizes: [] },
      },
    };
    writeFileSync(path.join(dir, "docs/adr/.mapping.json"), JSON.stringify(index));
    c.links.push({
      category: "notifications",
      step: "ordering.confirm-order",
      reason: "The notification ADR sends the confirmation the step completes.",
      verdict: "inferred",
      evidence: [],
      confirmed: true,
    });
    writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(c));
    assert.equal(
      run(dir, "prepare", "candidates.json", "--run", "save", "--confirmed-only").status,
      0,
    );
    const saved = JSON.parse(readFileSync(path.join(dir, "save/mapping.save.json"), "utf8"));
    assert.deepEqual(saved.categories.notifications.realizes, ["ordering.confirm-order"]);
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8")),
      index,
      "the index changes only through the approved save",
    );
  });
});

test("candidates for one process never remove another process or an uncovered step from the draft", () => {
  withTmp((dir) => {
    project(dir);
    mkdirSync(path.join(dir, "docs/ontology"));
    const draft = (name) => draftDocs(dir, name);
    // A first model of the order flow, then a second process in its own context.
    assert.equal(
      run(dir, "prepare", "candidates.json", "--run", "first", "--confirmed-only").status,
      0,
    );
    for (const d of draft("first/save-draft"))
      writeFileSync(path.join(dir, "docs/ontology", d.doc), d.text);
    writeFileSync(
      path.join(dir, "docs/ontology/returns.ttl"),
      `${draft("first/save-draft")[0]
        .text.split("\n")
        .filter((l) => l.startsWith("@prefix"))
        .join("\n")}
m:returns a onto:BoundedContext ;
    rdfs:label "Returns" ;
    onto:coreLogic "Takes back what customers return." .
m:returns.handle-return a onto:Process ;
    rdfs:label "Handle a return" ;
    onto:inContext m:returns ;
    onto:status "Proposed" .
`,
    );
    const before = triplesOf(
      readdirSync(path.join(dir, "docs/ontology"))
        .sort()
        .map((f) => ({ doc: f, text: readFileSync(path.join(dir, "docs/ontology", f), "utf8") })),
    );
    assert.ok(before.some((t) => t.s.endsWith(":returns.handle-return")));
    assert.ok(before.some((t) => t.s.endsWith(":payment.request-payment")));
    // The new document covers only the order flow, and not its payment request step.
    const c = structuredClone(FIXTURE);
    c.steps = c.steps.filter((step) => step.id !== "payment.request-payment");
    c.processes[0].steps = c.processes[0].steps.filter((id) => id !== "payment.request-payment");
    c.questions = [];
    project(dir, c);
    const out = run(dir, "prepare", "candidates.json", "--run", "second");
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const after = triplesOf(draft("second/draft"));
    const key = (t) => `${t.s} ${t.p} ${t.o.value}`;
    const kept = new Set(after.map(key));
    assert.deepEqual(
      before.filter((t) => !kept.has(key(t))).map(key),
      [],
      "every current element and relation stays in the draft",
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

test("every candidate, bounded contexts included, carries a source verdict and its evidence list", () => {
  withTmp((dir) => {
    for (const kind of [
      "contexts",
      "actors",
      "events",
      "processes",
      "steps",
      "policies",
      "rules",
      "criteria",
    ]) {
      for (const field of ["verdict", "evidence"]) {
        const c = structuredClone(FIXTURE);
        delete c[kind][0][field];
        const { errors } = checkCandidates(c, readCurrentModel(path.join(dir, "none")));
        assert.ok(
          errors.some((e) => e.startsWith(`${kind}[0]`) && e.includes(field)),
          `${kind} without ${field}: ${errors.join("; ")}`,
        );
      }
    }
    // An empty evidence list is the explicit mark that no source location was found.
    const c = structuredClone(FIXTURE);
    c.contexts[0].evidence = [];
    c.contexts[0].verdict = "unconfirmed";
    assert.deepEqual(checkCandidates(c, readCurrentModel(path.join(dir, "none"))).errors, []);
  });
});

test("a page is a source trace however it is written, while business wording is not", () => {
  for (const text of ["주문 정책서 12p의 기준", "정책 p12 참조", "p. 4 참고", "page 3", "12쪽"])
    assert.match(sourceTrace(text) ?? "", /cites the page/, text);
  for (const text of [
    "P2P 결제는 지원하지 않는다",
    "P1 장애는 바로 알린다",
    "P2 등급 고객",
    "4P 분석",
    "p1 장애 대응",
    "12pt 글꼴",
    "전자상거래법 제17조",
    "3면 접착 포장",
    "1080 원",
  ])
    assert.equal(sourceTrace(text), null, text);
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
