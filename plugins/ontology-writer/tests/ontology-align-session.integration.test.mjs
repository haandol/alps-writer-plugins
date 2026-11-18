import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseQuestions, sessionFiles, waitForAnswers } from "../scripts/ontology-ask.mjs";
import { questionSession } from "./ontology-ask-helpers.mjs";

const script = path.join(import.meta.dir, "../scripts/ontology-ask.mjs");
const criterion = (id) => ({
  criterion: id,
  startCondition: "The case is ready",
  observedResult: "The result is present",
});
const alignment = {
  processes: [
    {
      id: "ordering",
      label: "Order processing",
      status: "Proposed",
      criteria: [criterion("ordering.submit"), criterion("ordering.confirm")],
    },
    {
      id: "shipping",
      label: "Shipping",
      status: "Accepted (2026-11-18)",
      criteria: [criterion("shipping.ship")],
    },
  ],
};
const document = { version: 1, questions: [], alignment };
const agent = (run, command, ...args) =>
  spawnSync(process.execPath, [script, command, run, ...args], { encoding: "utf8" });

const requestFromTerminal = (run, { messageId, process, criteria }) =>
  agent(run, "request", messageId, "--process", process, "--criteria", JSON.stringify(criteria));

test("the live alignment session delivers selected scopes and shows only the agent's corresponding results", async () => {
  const run = mkdtempSync(path.join(tmpdir(), "ontology-align-requests-"));
  const files = sessionFiles(run);
  mkdirSync(files.dir);
  writeFileSync(files.questions, JSON.stringify(document));
  const opened = Bun.spawn([process.execPath, script, "open", run, "--no-open", "--lang", "en"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    const reader = opened.stdout.getReader();
    const { value } = await reader.read();
    const receipt = new TextDecoder().decode(value);
    assert.match(receipt, /^ALIGN_SESSION /);
    const url = new URL(receipt.trim().slice("ALIGN_SESSION ".length));
    assert.equal(url.hostname, "127.0.0.1");
    const state = async () => (await fetch(new URL("api/state", url))).json();
    const post = (route, body, origin = url.origin) =>
      fetch(new URL("api/" + route, url), {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(body),
      });
    assert.deepEqual((await state()).alignment, alignment);
    assert.equal((await state()).discussion.available, false);
    const reopen = agent(run, "open", "--no-open");
    assert.equal(reopen.status, 0, reopen.stderr);
    assert.ok(reopen.stdout.includes(receipt.trim()) && reopen.stdout.includes("ALREADY_OPEN"));

    const scope = { process: "ordering", criteria: ["ordering.confirm", "ordering.submit"] };
    const request = { messageId: "selected", ...scope };
    const reordered = {
      ...request,
      criteria: ["ordering.submit", "ordering.confirm", "ordering.submit"],
    };
    const responses = [requestFromTerminal(run, request), requestFromTerminal(run, reordered)];
    assert.deepEqual(
      responses.map((r) => r.status),
      [0, 0],
    );
    assert.notEqual(requestFromTerminal(run, { ...request, criteria: [] }).status, 0);
    assert.equal((await state()).discussion.messages.length, 1);
    const firstWait = agent(run, "wait", "--timeout", "1");
    assert.equal(firstWait.status, 0, firstWait.stderr);
    const first = JSON.parse(firstWait.stdout);
    assert.deepEqual(first.answers, []);
    assert.deepEqual(
      first.messages.map((m) => m.scope),
      [scope],
    );
    assert.deepEqual(JSON.parse(first.messages[0].text), scope);

    const waiting = Bun.spawn([process.execPath, script, "wait", run, "--timeout", "4"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const until = Date.now() + 2500;
    while (!(await state()).discussion.available && Date.now() < until) await Bun.sleep(10);
    assert.equal((await state()).discussion.available, true);
    const whole = { messageId: "whole", process: "shipping", criteria: [] };
    assert.equal(requestFromTerminal(run, whole).status, 0);
    assert.equal(await waiting.exited, 0);
    assert.deepEqual(
      JSON.parse(await new Response(waiting.stdout).text()).messages.map((m) => m.scope),
      [{ process: "shipping", criteria: [] }],
    );
    const invalid = agent(
      run,
      "reply",
      "whole",
      "--text",
      '{"outcome":"passed","nextAction":"Finish"}',
    );
    assert.notEqual(invalid.status, 0);
    const result = {
      outcome: "blocked",
      evidence: "Shipping entry point is unavailable",
      nextAction: "Restore the local entry point.",
    };
    const resultFile = path.join(run, "outcome.json");
    writeFileSync(resultFile, JSON.stringify(result, null, 2));
    const reply = agent(run, "reply", "whole", "--text-file", resultFile);
    assert.equal(reply.status, 0, reply.stderr);
    assert.equal(agent(run, "reply", "whole", "--text", JSON.stringify(result)).status, 0);
    assert.notEqual(
      agent(run, "reply", "whole", "--text", JSON.stringify({ ...result, outcome: "passed" }))
        .status,
      0,
    );
    const selectedResult = {
      outcome: "passed",
      evidence: "Both selected CLI scenarios returned their expected results.",
      nextAction: "Review the remaining process gates.",
    };
    assert.equal(
      agent(run, "reply", "selected", "--text", JSON.stringify(selectedResult)).status,
      0,
    );
    const messages = (await state()).discussion.messages;
    assert.deepEqual(
      messages.map((m) => [m.messageId, m.scope, m.reply.result, m.delivered]),
      [
        ["selected", scope, selectedResult, true],
        ["whole", { process: "shipping", criteria: [] }, result, true],
      ],
    );
    assert.deepEqual(JSON.parse(agent(run, "messages").stdout).messages, messages);
    assert.equal((await post("close", {})).status, 200);
    assert.equal(await opened.exited, 0);
  } finally {
    if (opened.exitCode === null) {
      opened.kill();
      await opened.exited;
    }
    rmSync(run, { recursive: true, force: true });
  }
});

test("alignment accepts only catalogue scopes, protects the local session and exposes no browser result or save route", async () => {
  const s = questionSession(document);
  try {
    const initial = readFileSync(s.files.answers, "utf8");
    const basic = { messageId: "request-1", process: "ordering", criteria: [] };
    assert.equal((await fetch(new URL("/", s.url))).status, 404);
    assert.equal(
      (await s.post("verify", basic, { Origin: "https://example.invalid" })).status,
      403,
    );
    assert.notEqual(requestFromTerminal(s.run, { ...basic, process: "unknown" }).status, 0);
    assert.notEqual(
      requestFromTerminal(s.run, { ...basic, criteria: ["shipping.ship"] }).status,
      0,
    );
    for (const route of [
      "verify",
      "answer",
      "deliver",
      "discussion",
      "reply",
      "apply",
      "transition",
    ])
      assert.equal((await s.post(route, basic)).status, 404);
    assert.equal(readFileSync(s.files.answers, "utf8"), initial);
    const html = await fetch(s.url);
    assert.match(html.headers.get("content-type"), /text\/html/);
    assert.ok((await html.text()).includes("app.js"));
    for (const [name, mime] of [
      ["app.js", "javascript"],
      ["app.css", "css"],
    ]) {
      const asset = await fetch(new URL(name, s.url));
      assert.equal(asset.status, 200);
      assert.ok(asset.headers.get("content-type").includes(mime));
    }
    assert.deepEqual((await s.state()).alignment, alignment);
    assert.deepEqual((await s.state()).discussion.messages, []);
  } finally {
    s.done();
  }
});

test("the catalogue preserves valid long ontology identifiers and rejects ambiguous selections", () => {
  const process = { ...alignment.processes[0], id: "orders." + "long-process-component".repeat(4) };
  assert.equal(
    parseQuestions(JSON.stringify({ version: 1, alignment: { processes: [process] } })).ok,
    true,
  );
  for (const invalid of [
    { processes: [process, process] },
    { processes: [{ ...process, criteria: [criterion("same"), criterion("same")] }] },
    { processes: [{}] },
    {},
  ])
    assert.equal(parseQuestions(JSON.stringify({ ...document, alignment: invalid })).ok, false);
});

test("overlapping agent waits claim one verification once and an unanswered delivery stays readable", async () => {
  const s = questionSession(document);
  try {
    const wait = () => waitForAnswers(s.run, { timeoutSeconds: 0.12, pollMs: 5 });
    const waits = [wait(), wait()];
    assert.equal(
      requestFromTerminal(s.run, { messageId: "verify-once", process: "ordering", criteria: [] })
        .status,
      0,
    );
    const results = await Promise.all(waits);
    assert.deepEqual(
      results.flatMap((result) => result.messages).map((m) => m.messageId),
      ["verify-once"],
    );
    assert.equal(results.filter((r) => r.timeout).length, 1);
    const { messages } = JSON.parse(agent(s.run, "messages").stdout);
    assert.deepEqual(
      messages.map((m) => [m.messageId, m.delivered, m.reply]),
      [["verify-once", true, null]],
    );
  } finally {
    s.done();
  }
});
