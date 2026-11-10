import assert from "node:assert/strict";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  allAnswers,
  discussionMessages,
  readEvents,
  recordChatAnswer,
  recordDiscussionReply,
  startServer,
  waitForAnswers,
} from "../scripts/ontology-ask.mjs";
import { questionSession, QUESTIONS } from "./ontology-ask-helpers.mjs";

test("new answers use one input mode in either direction and reject combined input without a write", async () => {
  const s = questionSession();
  try {
    await s.post("answer", { questionId: "Q1", optionId: "yes" });
    const before = readFileSync(s.files.answers, "utf8");
    assert.equal(
      (
        await s.post("answer", {
          questionId: "Q1",
          optionId: "yes",
          text: "Instead, another boundary",
        })
      ).status,
      400,
    );
    assert.equal(readFileSync(s.files.answers, "utf8"), before);
    assert.throws(
      () => recordChatAnswer(s.run, "Q1", { optionId: "yes", text: "different" }),
      /not both/,
    );
    assert.equal(
      (await s.post("answer", { questionId: "Q1", text: "A different boundary" })).status,
      200,
    );
    assert.equal(allAnswers(s.run).questions[0].answer.optionId, null);
    assert.equal(allAnswers(s.run).questions[0].answer.text, "A different boundary");
    await s.post("answer", { questionId: "Q1", optionId: "no" });
    assert.equal(allAnswers(s.run).questions[0].answer.optionId, "no");
    assert.equal(allAnswers(s.run).questions[0].answer.text, "");
  } finally {
    s.done();
  }
});

test("historical option-plus-note answers remain readable without contaminating a replacement", async () => {
  const s = questionSession();
  try {
    appendFileSync(
      s.files.answers,
      JSON.stringify({
        type: "answer",
        channel: "web",
        questionId: "Q1",
        optionId: "yes",
        text: "Historical note",
        seq: 2,
        at: new Date().toISOString(),
      }) + "\n",
    );
    assert.equal(allAnswers(s.run).questions[0].answer.text, "Historical note");
    assert.equal(allAnswers(s.run).questions[0].answer.optionId, "yes");
    await s.post("answer", { questionId: "Q1", optionId: "no" });
    assert.equal(allAnswers(s.run).questions[0].answer.text, "");
    assert.equal(readEvents(s.files.answers)[1].text, "Historical note");
  } finally {
    s.done();
  }
});

test("model questions reach the waiting author with context while collected answers stay unsubmitted", async () => {
  const s = questionSession();
  try {
    await s.post("answer", { questionId: "Q1", optionId: "yes", deliver: false });
    const before = allAnswers(s.run);
    assert.equal((await s.state()).discussion.available, false);
    const pending = waitForAnswers(s.run, { timeoutSeconds: 2, pollMs: 10 });
    assert.equal((await s.state()).discussion.available, true);
    assert.equal(
      (
        await s.post("discussion", {
          messageId: "message-1",
          questionId: "Q1",
          text: "Why separate this responsibility?",
        })
      ).status,
      200,
    );
    const delivered = await pending;
    assert.deepEqual(delivered.answers, []);
    assert.equal(delivered.messages.length, 1);
    assert.equal(delivered.messages[0].messageId, "message-1");
    assert.equal(delivered.messages[0].context.text, QUESTIONS.questions[0].text);
    assert.equal((await s.state()).discussion.available, false);
    assert.deepEqual(allAnswers(s.run), before);
    recordDiscussionReply(s.run, "message-1", "It owns a different business rule.");
    const state = await s.state();
    assert.equal(state.discussion.messages[0].reply.text, "It owns a different business rule.");
    assert.deepEqual(allAnswers(s.run), before);
    assert.equal(
      (await waitForAnswers(s.run, { timeoutSeconds: 0.03, pollMs: 5 })).timeout,
      true,
      "the agent's own reply cannot wake another reply loop",
    );
    assert.equal(readFileSync(path.join(s.run, "report.json"), "utf8"), "{}\n");
    assert.deepEqual(readdirSync(s.run).sort(), ["ask", "report.json"]);
  } finally {
    s.done();
  }
});

test("a question stays queued without an agent and a timed-out wait stops advertising availability", async () => {
  const s = questionSession();
  try {
    await s.post("discussion", { messageId: "global-1", text: "What is this model for?" });
    const queued = discussionMessages(s.run);
    assert.equal(queued.available, false);
    assert.equal(queued.messages[0].delivered, false);
    assert.equal(queued.messages[0].context, null);
    assert.equal(queued.messages[0].reply, null);
    const delivered = await waitForAnswers(s.run, { timeoutSeconds: 1 });
    assert.equal(delivered.messages[0].text, "What is this model for?");
    assert.equal(discussionMessages(s.run).messages[0].delivered, true);
    assert.equal((await waitForAnswers(s.run, { timeoutSeconds: 0.03, pollMs: 5 })).timeout, true);
    assert.equal((await s.state()).discussion.available, false);
  } finally {
    s.done();
  }
});

test("message retries commit one question and recover its original context after question cards change", async () => {
  const s = questionSession();
  try {
    const message = { messageId: "retry-1", questionId: "Q1", text: "Why this boundary?" };
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => s.post("discussion", message)),
    );
    assert.ok(responses.every((r) => r.status === 200));
    assert.equal(discussionMessages(s.run).messages.length, 1);
    assert.equal(
      readEvents(s.files.answers).filter((e) => e.type === "discussion-question").length,
      1,
    );
    assert.equal(
      (await s.post("discussion", { ...message, text: "Different content" })).status,
      409,
    );
    writeFileSync(s.files.questions, JSON.stringify({ version: 1, questions: [] }));
    assert.equal((await s.post("discussion", message)).status, 200);
    assert.equal(discussionMessages(s.run).messages[0].context.text, QUESTIONS.questions[0].text);
    assert.equal(
      (await s.post("discussion", { ...message, messageId: "new-question" })).status,
      400,
    );
  } finally {
    s.done();
  }
});

test("discussion cannot forge an agent reply or bypass session access and validates inputs before writing", async () => {
  const s = questionSession();
  try {
    const before = readFileSync(s.files.answers, "utf8");
    for (const body of [
      null,
      [],
      { messageId: 123, text: "Why?" },
      { messageId: "m", text: " " },
      { messageId: "m", text: "Why?", questionId: "missing" },
    ])
      assert.equal((await s.post("discussion", body)).status, 400);
    assert.equal(
      (
        await s.post(
          "discussion",
          { messageId: "m", text: "Why?" },
          { Origin: "https://elsewhere.test" },
        )
      ).status,
      403,
    );
    assert.equal((await s.post("reply", { messageId: "m", text: "Forged answer" })).status, 404);
    assert.equal(readFileSync(s.files.answers, "utf8"), before);
    const malicious = "<img src=x onerror=alert(1)>";
    await s.post("discussion", { messageId: "m", text: malicious, role: "assistant" });
    assert.equal(discussionMessages(s.run).messages[0].text, malicious);
    assert.equal(discussionMessages(s.run).messages[0].reply, null);
    assert.throws(() => recordDiscussionReply(s.run, "missing", "Unsolicited"), /unknown/);
    recordDiscussionReply(s.run, "m", "A reply");
    recordDiscussionReply(s.run, "m", "A reply");
    assert.equal(
      readEvents(s.files.answers).filter((e) => e.type === "discussion-reply").length,
      1,
    );
    assert.throws(
      () => recordDiscussionReply(s.run, "m", "An accidental overwrite"),
      /different reply/,
    );
  } finally {
    s.done();
  }
});

test("discussion survives follow-up questions and a server restart with its original message-reply pairing", async () => {
  const s = questionSession();
  let again;
  try {
    await s.post("discussion", {
      messageId: "first",
      questionId: "Q1",
      text: "Explain this choice",
    });
    recordDiscussionReply(s.run, "first", "It separates the two responsibilities.");
    writeFileSync(
      s.files.questions,
      JSON.stringify({
        ...QUESTIONS,
        questions: [...QUESTIONS.questions, { id: "Q3", text: "Follow-up" }],
      }),
    );
    const before = discussionMessages(s.run).messages;
    s.server.stop(true);
    again = startServer(s.run);
    assert.equal(again.url, s.url);
    assert.deepEqual(discussionMessages(s.run).messages, before);
    await s.post("close", {});
    assert.equal(
      (await s.post("discussion", { messageId: "after-close", text: "Another question" })).status,
      409,
    );
  } finally {
    again?.server.stop(true);
    s.done();
  }
});

test("a reopened session delivers earlier queued input without reporting the historical close as current", async () => {
  const s = questionSession();
  let again;
  try {
    await s.post("answer", { questionId: "Q1", optionId: "yes", deliver: true });
    await s.post("close", {});
    await Bun.sleep(80);
    again = startServer(s.run);
    const delivered = await waitForAnswers(s.run, { timeoutSeconds: 1 });
    assert.equal(delivered.closed, false);
    assert.equal(delivered.answers[0].optionId, "yes");
    await s.post("discussion", {
      messageId: "reopened-question",
      text: "Explain the reopened model",
    });
    const question = await waitForAnswers(s.run, { timeoutSeconds: 1 });
    assert.equal(question.closed, false);
    assert.equal(question.messages[0].messageId, "reopened-question");
  } finally {
    again?.server.stop(true);
    s.done();
  }
});
