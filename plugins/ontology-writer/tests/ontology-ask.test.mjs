import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  allAnswers,
  checkDiagrams,
  parseQuestions,
  recordChatAnswer,
  sessionFiles,
  startServer,
  waitForAnswers,
} from "../scripts/ontology-ask.mjs";

const QUESTIONS = {
  version: 1,
  title: "Build questions",
  questions: [
    {
      id: "Q1",
      text: "Keep the boundary? <script>alert(1)</script>",
      options: [
        { id: "yes", label: "Keep" },
        { id: "no", label: "Change" },
      ],
    },
    { id: "Q2", text: "Which basis applies?" },
  ],
};

function session(questions = QUESTIONS) {
  const run = mkdtempSync(path.join(tmpdir(), "ontology-ask-"));
  writeFileSync(path.join(run, "report.json"), "{}");
  const files = sessionFiles(run);
  mkdirSync(files.dir, { recursive: true });
  writeFileSync(files.questions, JSON.stringify(questions));
  const s = startServer(run);
  const origin = new URL(s.url).origin;
  const post = (route, body, headers = { Origin: origin }) =>
    fetch(new URL(`api/${route}`, s.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  const state = async () => (await fetch(new URL("api/state", s.url))).json();
  const done = () => {
    s.server.stop(true);
    rmSync(run, { recursive: true, force: true });
  };
  return { run, files, url: s.url, origin, post, state, done };
}

test("the session needs its token and its own origin, and serves document text only as data", async () => {
  const s = session();
  try {
    assert.equal((await fetch(new URL("/", s.url))).status, 404);
    const page = await fetch(s.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
    assert.doesNotMatch(await page.text(), /alert/);
    assert.equal((await s.post("answer", { questionId: "Q1", optionId: "yes" }, {})).status, 403);
    assert.equal(
      (
        await s.post(
          "answer",
          { questionId: "Q1", optionId: "yes" },
          { Origin: "http://evil.test" },
        )
      ).status,
      403,
    );
    assert.equal((await s.post("apply", {})).status, 404);
    assert.equal((await s.post("answer", { questionId: "Q1", optionId: "maybe" })).status, 400);
    assert.equal((await s.state()).questions[0].answer, null);
  } finally {
    s.done();
  }
});

test("a sent answer wakes the agent; collected answers wait for submission; the last answer counts", async () => {
  const s = session();
  try {
    await s.post("answer", { questionId: "Q1", optionId: "no", deliver: true });
    let woke = await waitForAnswers(s.run, { timeoutSeconds: 2 });
    assert.deepEqual(
      woke.answers.map((a) => [a.questionId, a.optionLabel]),
      [["Q1", "Change"]],
    );
    assert.equal((await s.state()).working, true);

    await s.post("answer", { questionId: "Q2", text: "contract", deliver: false });
    await s.post("answer", { questionId: "Q1", optionId: "yes", deliver: false });
    assert.equal((await waitForAnswers(s.run, { timeoutSeconds: 0.5 })).timeout, true);
    await s.post("deliver", {});
    woke = await waitForAnswers(s.run, { timeoutSeconds: 2 });
    assert.deepEqual(
      woke.answers.map((a) => [a.questionId, a.optionId ?? a.text]),
      [
        ["Q1", "yes"],
        ["Q2", "contract"],
      ],
    );
  } finally {
    s.done();
  }
});

test("follow-up questions and chat answers reach the screen, and answers survive a restart", async () => {
  const s = session();
  try {
    await s.post("answer", { questionId: "Q1", optionId: "yes", deliver: true });
    await Bun.sleep(20);
    writeFileSync(
      s.files.questions,
      JSON.stringify({
        ...QUESTIONS,
        questions: [...QUESTIONS.questions, { id: "Q1.1", text: "Follow-up" }],
      }),
    );
    recordChatAnswer(s.run, "Q2", { text: "user decision" });
    const now = await s.state();
    assert.equal(now.working, false);
    assert.deepEqual(
      now.questions.map((q) => q.id),
      ["Q1", "Q2", "Q1.1"],
    );
    assert.equal(now.questions[1].answer.channel, "chat");

    await s.post("close", {});
    await Bun.sleep(100);
    const again = startServer(s.run);
    try {
      assert.deepEqual(
        allAnswers(s.run).questions.map((q) => q.answer?.optionId ?? q.answer?.text ?? null),
        ["yes", "user decision", null],
      );
    } finally {
      again.server.stop(true);
    }
  } finally {
    s.done();
  }
});

test("the session writes only its own files", async () => {
  const s = session();
  try {
    await s.post("answer", { questionId: "Q1", optionId: "yes", deliver: true });
    assert.deepEqual(readdirSync(s.run).sort(), ["ask", "report.json"]);
    assert.deepEqual(readdirSync(s.files.dir).sort(), [
      "answers.jsonl",
      "questions.json",
      "session.json",
    ]);
  } finally {
    s.done();
  }
});

test("questions carry diagrams, evidence and resolved answers, and bad diagram syntax is reported", async () => {
  const visual = {
    version: 1,
    diagram: { source: "flowchart LR\n  A --> B" },
    questions: [
      {
        id: "Q1",
        text: "Which flow?",
        diagram: { source: "flowchart LR\n  A --> B" },
        evidence: [{ source: "docs/adr/x.md", detail: "Decision", verdict: "conflicting" }],
        options: [{ id: "a", label: "A", diagram: { source: "flowchart LR\n  A --> " } }],
        resolved: { summary: "The newer decision says A.", optionId: "a" },
      },
    ],
  };
  assert.equal(parseQuestions(JSON.stringify(visual)).ok, true);
  assert.deepEqual(
    checkDiagrams(visual).map((e) => e.where),
    ["Q1/a"],
  );
  const wrong = structuredClone(visual);
  wrong.questions[0].evidence[0].verdict = "approved";
  assert.match(parseQuestions(JSON.stringify(wrong)).error, /verdict/);
  wrong.questions[0].evidence[0].verdict = "stated";
  wrong.questions[0].resolved.optionId = "zzz";
  assert.match(parseQuestions(JSON.stringify(wrong)).error, /unknown option/);

  const s = session(visual);
  try {
    const engine = await fetch(new URL("mermaid.js", s.url));
    assert.equal(engine.status, 200);
    assert.match(await (await fetch(s.url)).text(), /mermaid\.js/);
    assert.equal((await s.state()).questions[0].resolved.optionId, "a");
  } finally {
    s.done();
  }
});

test("ontology-build opens the web session for its questions and keeps approval in the conversation", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  assert.match(read("skills/ontology-build/SKILL.md"), /references\/ask-session\.md/);
  const guide = read("skills/ontology-build/references/ask-session.md");
  assert.match(guide, /approval summary\s+and the save approval stay in the conversation/);
  assert.match(guide, /ontology-ask\.mjs wait <run>/);
  assert.match(
    read("skills/ontology-build/SKILL.md"),
    /Code alone shows observed behavior and never\s+resolves a question/,
  );
});
