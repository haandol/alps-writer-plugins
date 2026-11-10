import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { browserPath } from "./browser.mjs";
import { questionSession, QUESTIONS } from "../tests/ontology-ask-helpers.mjs";
import { allAnswers, discussionMessages, waitForAnswers } from "../scripts/ontology-ask.mjs";

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve("@mermaid-js/mermaid-cli"));
const { default: puppeteer } = await import(cliRequire.resolve("puppeteer"));
let browser, profileDir;
before(async () => {
  profileDir = mkdtempSync(path.join(tmpdir(), "ontology-question-browser-"));
  browser = await puppeteer.launch({
    headless: true,
    executablePath: browserPath(),
    userDataDir: path.join(profileDir, "question-review-session"),
    args: process.env.CI ? ["--no-sandbox"] : [],
  });
});
after(async () => {
  await browser?.close();
  if (profileDir) rmSync(profileDir, { recursive: true, force: true });
});

async function inQuestionPage(fn) {
  const s = questionSession();
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
    await page.waitForSelector("#q-Q1 input[type=radio]");
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
