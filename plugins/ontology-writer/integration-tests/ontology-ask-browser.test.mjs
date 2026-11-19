import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { launch } from "./browser.mjs";
import { questionSession, QUESTIONS } from "../tests/ontology-ask-helpers.mjs";
import {
  allAnswers,
  discussionMessages,
  readEvents,
  waitForAnswers,
} from "../scripts/ontology-ask.mjs";

let browser, profileDir;
before(async () => {
  profileDir = mkdtempSync(path.join(tmpdir(), "ontology-question-browser-"));
  browser = await launch(path.join(profileDir, "question-review-session"));
});
after(async () => {
  await browser?.close();
  if (profileDir) rmSync(profileDir, { recursive: true, force: true });
});

async function inQuestionPage(fn, questions = QUESTIONS) {
  const s = questionSession(questions);
  const page = await browser.newPage();
  const errors = [],
    external = [];
  let intercept = (request) => request.continue();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== s.origin) {
      external.push(request.url());
      request.abort();
    } else Promise.resolve(intercept(request)).catch((error) => errors.push(error.message));
  });
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(s.url, { waitUntil: "load" });
    await page.waitForSelector("#q-Q1");
    await fn(s, page, (next) => {
      intercept = next;
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], "the question UI stays on its own loopback server");
  } finally {
    await page.close();
    s.done();
  }
}

const choose = (page, question, value) => page.click(`#q-${question} input[value="${value}"]`);
const saved = (page, question, text) =>
  page.waitForFunction(
    (id, text) => document.querySelector(`#q-${id} .answer`).textContent.includes(text),
    {},
    question,
    text,
  );
const selected = (page, question) =>
  page.$$eval(`#q-${question} input:checked`, (inputs) => inputs.map((i) => i.value));
const textOf = (page, selector) => page.$eval(selector, (input) => input.value);

test("collected answers wait for submission, a sent answer shows the agent working once taken, and a follow-up appears in place", async () => {
  await inQuestionPage(async (s, page) => {
    const deliveries = () => readEvents(s.files.answers).filter((e) => e.type === "deliver");
    const status = () => page.$eval(".status", (n) => n.textContent);
    assert.equal(
      await page.$eval('.mode[aria-pressed="true"]', (b) => b.textContent),
      "Send now",
      "sending each answer at once is the default",
    );

    await page.click(".mode:nth-child(2)");
    await choose(page, "Q1", "yes");
    await saved(page, "Q1", "Keep");
    assert.equal(deliveries().length, 0, "a collected answer does not reach the agent");
    assert.equal((await waitForAnswers(s.run, { timeoutSeconds: 0.3, pollMs: 50 })).timeout, true);
    assert.equal(allAnswers(s.run).questions[0].answer, null, "nor is it read before it is sent");
    assert.equal(allAnswers(s.run).questions[0].pending, true);
    await page.waitForFunction(() => !document.querySelector(".submit-all").disabled);
    await page.click(".submit-all");
    // No agent is listening: the answer is sent, not shown as being applied or delivered.
    await page.waitForFunction(() =>
      /waiting for the agent to pick them up/.test(document.querySelector(".status").textContent),
    );
    assert.match(await status(), /tell the agent in the main conversation/);
    await saved(page, "Q1", "Sent · waiting for the agent");
    assert.deepEqual(deliveries().at(-1).questionIds, ["Q1"]);
    // Once a wait takes it, the screen shows the agent working and the answer delivered.
    const taken = await waitForAnswers(s.run, { timeoutSeconds: 2, pollMs: 20 });
    assert.deepEqual(
      taken.answers.map((a) => a.questionId),
      ["Q1"],
    );
    await page.waitForFunction(() =>
      /applying your answers/.test(document.querySelector(".status").textContent),
    );
    await saved(page, "Q1", "(Delivered)");

    // The agent rewrites the questions: the screen shows the follow-up without a reload.
    const before = await page.evaluate(() => performance.timeOrigin);
    writeFileSync(
      s.files.questions,
      JSON.stringify({
        ...QUESTIONS,
        questions: [...QUESTIONS.questions, { id: "Q3", text: "And after approval?" }],
      }),
    );
    await page.waitForSelector("#q-Q3");
    assert.equal(await page.evaluate(() => performance.timeOrigin), before, "no reload");
    await page.waitForFunction(
      () => !/applying your answers/.test(document.querySelector(".status").textContent),
    );

    await page.click(".mode:nth-child(1)");
    await choose(page, "Q2", "no");
    await saved(page, "Q2", "Replace");
    assert.deepEqual(deliveries().at(-1).questionIds, ["Q2"], "sending now delivers that answer");
  });
});

test("a question shows its flow and each option's result as drawn diagrams, its evidence with verdicts, and an undrawable diagram as source and error", async () => {
  const visual = {
    version: 1,
    title: "Boundary review",
    questions: [
      {
        id: "Q1",
        text: "Which hand-off applies?",
        diagram: { source: "flowchart LR\n  Order --> Payment" },
        evidence: [
          { source: "docs/orders.md", detail: "Hand-off section", verdict: "stated" },
          { source: "docs/payments.md", detail: "Another account", verdict: "conflicting" },
        ],
        options: [
          { id: "a", label: "Pay first", diagram: { source: "flowchart LR\n  Pay --> Ship" } },
          { id: "b", label: "Ship first", diagram: { source: "flowchart LR\n  Ship --> " } },
        ],
      },
    ],
  };
  await inQuestionPage(async (s, page) => {
    await page.waitForSelector('#q-Q1 > figure[data-rendered="true"] svg');
    await page.waitForSelector('#q-Q1 .option:nth-child(1) figure[data-rendered="true"] svg');
    assert.equal(
      await page.$eval("#q-Q1 .options", (n) => n.classList.contains("options--visual")),
      true,
    );
    await page.waitForFunction(
      () => !document.querySelector("#q-Q1 .option:nth-child(2) .diagram__status").hidden,
    );
    const broken = await page.$eval("#q-Q1 .option:nth-child(2) figure", (f) => ({
      status: f.querySelector(".diagram__status").textContent,
      open: f.querySelector(".diagram__source").open,
      source: f.querySelector(".diagram__source pre").textContent,
      svg: Boolean(f.querySelector("svg")),
    }));
    assert.match(broken.status, /^The diagram could not be drawn: /);
    assert.deepEqual(
      [broken.open, broken.source, broken.svg],
      [true, "flowchart LR\n  Ship --> ", false],
    );
    const evidence = await page.$$eval("#q-Q1 .evidence li", (items) =>
      items.map((li) => [
        li.querySelector(".verdict")?.textContent,
        li.querySelector("code").textContent,
      ]),
    );
    assert.deepEqual(evidence, [
      ["Stated", "docs/orders.md"],
      ["Conflicting", "docs/payments.md"],
    ]);
  }, visual);
});

test("every Mermaid link syntax draws as a plain shape, and a participant named call still draws", async () => {
  const linked = {
    version: 1,
    title: "Linked diagrams",
    diagram: {
      source: 'flowchart LR\n  A[주문] --> B[결제]\n  click A href "https://example.com/flow"',
    },
    questions: [
      {
        id: "Q1",
        text: "Which class?",
        diagram: {
          source: 'classDiagram\n  class Order\n  link Order "https://example.com/class"',
        },
        options: [
          {
            id: "a",
            label: "A",
            diagram: {
              source:
                "sequenceDiagram\n  participant Alice\n  participant Bob\n  link Alice: Dashboard @ https://example.com/seq\n  Alice->>Bob: Pay",
            },
          },
        ],
      },
      {
        id: "Q2",
        text: "Who answers?",
        diagram: { source: "sequenceDiagram\n  call->>agent: 상담 연결" },
        options: [{ id: "b", label: "B" }],
      },
    ],
  };
  await inQuestionPage(async (s, page) => {
    await page.waitForFunction(
      () =>
        document.querySelectorAll('figure[data-rendered="true"] svg').length === 4 &&
        !document.querySelector('figure[data-rendered="false"]'),
    );
    const figures = await page.$$eval('figure[data-rendered="true"] svg', (svgs) =>
      svgs.map((svg) => ({
        anchors: svg.querySelectorAll("a").length,
        links: [svg, ...svg.querySelectorAll("*")].filter((n) =>
          [...n.attributes].some((a) => /^on/i.test(a.name) || /(^|:)href$/i.test(a.name)),
        ).length,
        text: svg.textContent.replace(/\s+/g, " ").trim(),
      })),
    );
    assert.equal(figures.length, 4);
    for (const f of figures) assert.deepEqual([f.anchors, f.links], [0, 0], f.text);
    assert.ok(
      figures.some((f) => /상담 연결/.test(f.text)),
      "the call participant's message is drawn",
    );
    for (const svg of await page.$$('figure[data-rendered="true"] svg')) await svg.click();
    assert.equal(new URL(page.url()).origin, s.origin, "the page did not navigate");
  }, linked);
});

test("a drawn diagram carries no working link, embedded HTML or event handler from document wording", async () => {
  const hostile = {
    version: 1,
    title: "Hostile wording",
    questions: [
      {
        id: "Q1",
        text: "Which flow?",
        diagram: {
          source:
            'flowchart LR\n  A["<img src=x onerror=window.__ontologyAskInjected=1> Pay"] --> B["<a href=https://example.com/x>Ship</a>"]',
        },
        options: [{ id: "a", label: "A" }],
      },
    ],
  };
  await inQuestionPage(async (s, page) => {
    await page.waitForSelector('#q-Q1 > figure[data-rendered="true"] svg');
    const found = await page.$eval("#q-Q1 > figure svg", (svg) => ({
      active: svg.querySelectorAll("a, img, foreignObject, script, iframe").length,
      handlers: [svg, ...svg.querySelectorAll("*")].filter((n) =>
        [...n.attributes].some((a) => /^on/i.test(a.name) || /(^|:)href$/i.test(a.name)),
      ).length,
      text: svg.textContent,
    }));
    assert.deepEqual([found.active, found.handlers], [0, 0]);
    assert.match(found.text, /Pay/);
    await page.click("#q-Q1 > figure svg");
    assert.equal(
      await page.evaluate(() => window.__ontologyAskInjected ?? null),
      null,
      "nothing ran",
    );
    assert.equal(new URL(page.url()).origin, s.origin, "the page did not navigate");
  }, hostile);
});

test("a question the repository settles is listed as resolved with its source, and the user's different answer counts", async () => {
  const settledByAdr = {
    version: 1,
    title: "Build questions",
    questions: [
      { id: "Q1", text: "Who approves a quote?", options: [{ id: "manager", label: "A manager" }] },
      {
        id: "Q2",
        text: "Does a returned quote go back to sales?",
        resolved: { summary: "Yes — the accepted quote decision says so.", optionId: "yes" },
        evidence: [
          { source: "docs/decisions/quote-approval.md", detail: "Decision", verdict: "stated" },
        ],
        options: [
          { id: "yes", label: "Back to sales" },
          { id: "no", label: "Closed" },
        ],
      },
    ],
  };
  await inQuestionPage(async (s, page) => {
    await page.waitForSelector(".resolved-box #q-Q2");
    // The asked list is the workspace's own; the resolved list sits inside the resolved box.
    assert.equal(
      await page.$(".answers-workspace > section.questions #q-Q2"),
      null,
      "a settled question is not asked",
    );
    assert.ok(await page.$(".answers-workspace > section.questions #q-Q1"));
    assert.match(
      await page.$eval(".resolved-box summary", (n) => n.textContent),
      /^1 questions? resolved from repository sources/,
    );
    const card = await page.$eval("#q-Q2", (c) => ({
      resolution: c.querySelector(".resolution").textContent,
      source: c.querySelector(".evidence code").textContent,
    }));
    assert.match(card.resolution, /the accepted quote decision says so/);
    assert.equal(card.source, "docs/decisions/quote-approval.md");

    await page.click(".resolved-box > summary");
    await page.click("#q-Q2 .override > summary");
    await choose(page, "Q2", "no");
    await saved(page, "Q2", "Closed");
    assert.equal(
      allAnswers(s.run).questions[1].answer.optionId,
      "no",
      "the user's answer overrides",
    );
  }, settledByAdr);
});

test("typing, paste and composition replace only that card's option and survive question refresh", async () => {
  await inQuestionPage(async (s, page) => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#q-Q1 figure:not([hidden])")].every(
        (figure) => figure.dataset.rendered === "true",
      ),
    );
    assert.equal(await page.$$eval("#q-Q1 figure:not([hidden]) svg", (items) => items.length), 3);
    await choose(page, "Q1", "yes");
    await saved(page, "Q1", "Keep");
    await choose(page, "Q2", "yes");
    await saved(page, "Q2", "Use");
    await page.focus("#q-Q1 textarea");
    assert.deepEqual(await selected(page, "Q1"), ["yes"], "focus alone keeps the answer");
    await page.type("#q-Q1 textarea", "Use a different boundary");
    assert.deepEqual(await selected(page, "Q1"), []);
    assert.equal(await page.$$eval("#q-Q1 .option.is-chosen", (items) => items.length), 0);
    assert.deepEqual(await selected(page, "Q2"), ["yes"]);
    writeFileSync(
      s.files.questions,
      JSON.stringify({
        ...QUESTIONS,
        questions: QUESTIONS.questions.map((q) =>
          q.id === "Q1"
            ? {
                ...q,
                detail: "Refreshed source evidence",
                options: q.options.map((o) => ({ ...o, description: "Updated context" })),
              }
            : q,
        ),
      }),
    );
    await page.waitForFunction(
      () => document.querySelector("#q-Q1 .detail").textContent === "Refreshed source evidence",
    );
    assert.deepEqual(await selected(page, "Q1"), []);
    assert.equal(await textOf(page, "#q-Q1 textarea"), "Use a different boundary");
    await page.click("#q-Q1 .send");
    await saved(page, "Q1", "Use a different boundary");
    assert.equal(allAnswers(s.run).questions[0].answer.optionId, null);
    await choose(page, "Q1", "no");
    await saved(page, "Q1", "Change");
    assert.equal(allAnswers(s.run).questions[0].answer.text, "");
    await page.$eval("#q-Q1 textarea", (input) => {
      input.value = "Pasted alternative";
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: input.value }),
      );
    });
    assert.deepEqual(await selected(page, "Q1"), []);
    await choose(page, "Q1", "yes");
    await saved(page, "Q1", "Keep");
    assert.equal(await textOf(page, "#q-Q1 textarea"), "");
    await page.$eval("#q-Q1 textarea", (input) => {
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      input.value = "새로운 업무 경계";
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertCompositionText",
          data: input.value,
          isComposing: true,
        }),
      );
      input.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: input.value }),
      );
    });
    assert.deepEqual(await selected(page, "Q1"), []);
    assert.deepEqual(await selected(page, "Q2"), ["yes"]);
  });
});

test("late option and text save responses cannot restore an option or erase newer typing", async () => {
  await inQuestionPage(async (s, page, intercept) => {
    let release, stored;
    let captured = new Promise((resolve) => {
      stored = resolve;
    });
    let responseGate = new Promise((resolve) => {
      release = resolve;
    });
    let hold = true;
    intercept(async (request) => {
      if (!hold || !request.url().endsWith("/api/answer")) return request.continue();
      hold = false;
      const response = await fetch(request.url(), {
        method: "POST",
        headers: { Origin: s.origin, "Content-Type": "application/json" },
        body: request.postData(),
      });
      const body = await response.text();
      stored();
      await responseGate;
      await request.respond({ status: response.status, contentType: "application/json", body });
    });
    try {
      await choose(page, "Q1", "yes");
      await captured;
      await page.type("#q-Q1 textarea", "Replacement");
      release();
      await saved(page, "Q1", "Keep");
      assert.deepEqual(await selected(page, "Q1"), []);
      assert.equal(await textOf(page, "#q-Q1 textarea"), "Replacement");

      captured = new Promise((resolve) => {
        stored = resolve;
      });
      responseGate = new Promise((resolve) => {
        release = resolve;
      });
      hold = true;
      await page.click("#q-Q1 .send");
      await captured;
      await page.type("#q-Q1 textarea", " with newer detail");
      release();
      await saved(page, "Q1", "Replacement");
      assert.equal(await textOf(page, "#q-Q1 textarea"), "Replacement with newer detail");
      assert.deepEqual(await selected(page, "Q1"), []);
      await page.click("#q-Q1 .send");
      await saved(page, "Q1", "Replacement with newer detail");
      assert.equal(allAnswers(s.run).questions[0].answer.text, "Replacement with newer detail");
    } finally {
      release();
    }
  });
});

test("the browser asks its author and receives a CLI reply without changing candidate answers", async () => {
  await inQuestionPage(async (s, page) => {
    await choose(page, "Q1", "yes");
    await saved(page, "Q1", "Keep");
    const answers = allAnswers(s.run);
    const waiting = waitForAnswers(s.run, { timeoutSeconds: 5, pollMs: 10 });
    // The earlier immediate candidate delivery is consumed separately from the discussion.
    await waiting;
    const discussionWait = waitForAnswers(s.run, { timeoutSeconds: 5, pollMs: 10 });
    await page.waitForSelector('.discussion-status[data-agent-available="true"]');
    await page.click("#q-Q1 .ask-about-question");
    assert.equal(await textOf(page, "#discussion-context"), "Q1");
    const question =
      "Why this boundary? <img src=x onerror=window.ontologyDiscussionInjected=true>";
    await page.type("#discussion-input", question);
    await page.click(".discussion-send");
    const delivered = await discussionWait;
    assert.deepEqual(delivered.answers, []);
    assert.equal(delivered.messages[0].text, question);
    assert.equal(delivered.messages[0].context.questionId, "Q1");
    assert.deepEqual(allAnswers(s.run), answers);
    const responseFile = path.join(s.run, "author-reply.txt");
    const reply =
      "This boundary owns its own business rules. The question does not change your selected answer.";
    writeFileSync(responseFile, reply);
    const command = Bun.spawn(
      [
        process.execPath,
        path.resolve(import.meta.dir, "../scripts/ontology-ask.mjs"),
        "reply",
        s.run,
        delivered.messages[0].messageId,
        "--text-file",
        responseFile,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    assert.equal(await command.exited, 0, await new Response(command.stderr).text());
    await page.waitForFunction(
      (reply) => document.querySelector(".discussion-reply-text")?.textContent === reply,
      {},
      reply,
    );
    assert.equal(await page.$$eval(".discussion-question-text img", (items) => items.length), 0);
    assert.equal(await page.evaluate(() => window.ontologyDiscussionInjected), undefined);
    assert.deepEqual(await selected(page, "Q1"), ["yes"]);
    assert.deepEqual(allAnswers(s.run), answers);
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".discussion-reply-text");
    assert.equal(await page.$eval(".discussion-question-text", (p) => p.textContent), question);
    assert.equal(await page.$eval(".discussion-reply-text", (p) => p.textContent), reply);
    const evidenceDir = process.env.ONTOLOGY_ASK_EVIDENCE_DIR;
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({
        path: path.join(evidenceDir, "question-discussion-desktop.png"),
        fullPage: true,
      });
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.click(".show-discussion");
    assert.equal(await page.evaluate(() => document.activeElement.id), "discussion-input");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    if (evidenceDir)
      await page.screenshot({
        path: path.join(evidenceDir, "question-discussion-mobile.png"),
        fullPage: true,
      });
  });
});

test("a failed answer save says so on its card and sends the same answer again once", async () => {
  await inQuestionPage(async (s, page, intercept) => {
    const sent = [];
    let fail = true;
    intercept((request) => {
      if (!request.url().endsWith("/api/answer")) return request.continue();
      const body = JSON.parse(request.postData());
      sent.push(body.optionId ?? body.text);
      if (!fail) return request.continue();
      fail = false;
      return request.abort("failed");
    });
    const failure = (id) =>
      page.waitForFunction(
        (id) =>
          /send the same answer again/.test(
            document.querySelector(`#q-${id} .answer-draft`).textContent,
          ),
        {},
        id,
      );
    const answers = () => readEvents(s.files.answers).filter((e) => e.type === "answer");

    await choose(page, "Q1", "yes");
    await failure("Q1");
    assert.deepEqual(await selected(page, "Q1"), ["yes"]);
    assert.equal(
      allAnswers(s.run).questions[0].answer,
      null,
      "a failed save is not shown as saved",
    );
    await page.click("#q-Q1 .send");
    await saved(page, "Q1", "Keep");
    assert.deepEqual(sent, ["yes", "yes"]);
    assert.deepEqual(
      answers().map((e) => e.optionId),
      ["yes"],
    );

    fail = true;
    await page.type("#q-Q2 textarea", "A written basis");
    await page.click("#q-Q2 .send");
    await failure("Q2");
    assert.equal(await textOf(page, "#q-Q2 textarea"), "A written basis");
    await page.click("#q-Q2 .send");
    await saved(page, "Q2", "A written basis");
    assert.deepEqual(
      answers().map((e) => e.optionId ?? e.text),
      ["yes", "A written basis"],
    );
  });
});

test("a lost chat receipt preserves input and retry recovers one user message", async () => {
  await inQuestionPage(async (s, page, intercept) => {
    const identities = [];
    let loseReceipt = true;
    intercept(async (request) => {
      if (!request.url().endsWith("/api/discussion")) return request.continue();
      const body = JSON.parse(request.postData());
      identities.push(body.messageId);
      if (!loseReceipt) return request.continue();
      loseReceipt = false;
      await fetch(request.url(), {
        method: "POST",
        headers: { Origin: s.origin, "Content-Type": "application/json" },
        body: request.postData(),
      });
      return request.abort("failed");
    });
    await page.type("#discussion-input", "What is a saved workflow?");
    await page.click(".discussion-send");
    await page.waitForFunction(() => !document.querySelector(".discussion-error").hidden);
    assert.equal(await textOf(page, "#discussion-input"), "What is a saved workflow?");
    assert.equal(discussionMessages(s.run).messages.length, 1);
    await page.click(".discussion-send");
    await page.waitForFunction(() => document.querySelector("#discussion-input").value === "");
    assert.equal(identities.length, 2);
    assert.equal(identities[0], identities[1]);
    assert.equal(discussionMessages(s.run).messages.length, 1);
    assert.equal(await page.$$eval(".discussion-thread", (items) => items.length), 1);
    assert.ok(allAnswers(s.run).questions.every((q) => q.answer === null));
  });
});

test("a failed older chat receipt preserves a newer draft and does not label it as the old retry", async () => {
  await inQuestionPage(async (s, page, intercept) => {
    let release, accepted;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const stored = new Promise((resolve) => {
      accepted = resolve;
    });
    let hold = true;
    intercept(async (request) => {
      if (!hold || !request.url().endsWith("/api/discussion")) return request.continue();
      hold = false;
      await fetch(request.url(), {
        method: "POST",
        headers: { Origin: s.origin, "Content-Type": "application/json" },
        body: request.postData(),
      });
      accepted();
      await gate;
      return request.abort("failed");
    });
    try {
      await page.type("#discussion-input", "First question");
      await page.click(".discussion-send");
      await stored;
      await page.type("#discussion-input", " with a different context");
      await page.select("#discussion-context", "Q2");
      release();
      await page.waitForFunction(() => !document.querySelector(".discussion-error").hidden);
      assert.equal(
        await textOf(page, "#discussion-input"),
        "First question with a different context",
      );
      assert.equal(await textOf(page, "#discussion-context"), "Q2");
      assert.equal(await page.$eval(".discussion-send", (b) => b.textContent), "Send question");
      await page.click(".discussion-send");
      await page.waitForFunction(() => document.querySelector("#discussion-input").value === "");
      const messages = discussionMessages(s.run).messages;
      assert.equal(messages.length, 2);
      assert.notEqual(messages[0].messageId, messages[1].messageId);
      assert.equal(messages[1].context.questionId, "Q2");
    } finally {
      release();
    }
  });
});

test("closed questions fold to their answer while open answered ones stay editable", async () => {
  await inQuestionPage(async (s, page) => {
    await choose(page, "Q1", "yes");
    await saved(page, "Q1", "Keep");
    const folded = (id) =>
      page.$eval(`#q-${id}`, (card) => card.classList.contains("is-collapsed"));
    const visible = (selector) =>
      page.$eval(
        selector,
        (node) => node.getClientRects().length > 0 && getComputedStyle(node).display !== "none",
      );
    assert.equal(await folded("Q1"), false, "an open answered question can still change");
    assert.equal(await visible("#q-Q1 textarea"), true);
    assert.equal(await visible("#q-Q1 .card-toggle"), false);

    const next = structuredClone(QUESTIONS);
    next.questions[0].closed = true;
    next.agent = { message: "Q1 settled." };
    writeFileSync(s.files.questions, JSON.stringify(next));
    await page.waitForFunction(() =>
      document.querySelector("#q-Q1").classList.contains("is-collapsed"),
    );
    assert.equal(await visible("#q-Q1 textarea"), false, "a folded card hides its controls");
    assert.equal(await visible("#q-Q1 .answer"), true, "a folded card keeps its answer visible");
    assert.equal(await folded("Q2"), false, "an unanswered question stays open");
    assert.equal(
      await page.$eval("#q-Q1 .card-toggle", (b) => b.getAttribute("aria-expanded")),
      "false",
    );

    await page.click("#q-Q1 .card-toggle");
    assert.equal(await folded("Q1"), false, "the reader can reopen a closed card");
    assert.equal(await page.$eval("#q-Q1 textarea", (t) => t.disabled), true, "it stays read-only");
    await new Promise((resolve) => setTimeout(resolve, 1300));
    assert.equal(await folded("Q1"), false, "a refresh keeps the reader's choice");
    await page.click("#q-Q1 .card-toggle");
    assert.equal(await folded("Q1"), true);
  });
});
