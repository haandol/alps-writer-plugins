import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { launch } from "./browser.mjs";
import { CLI, EXAMPLE, cli } from "../tests/ontology-helpers.mjs";
import { commitAll, initRepo, write, writeAdrFiles } from "../tests/helpers.mjs";
import { MAPPING } from "../tests/ontology-lifecycle-helpers.mjs";
import {
  publishAlignmentPrompt,
  recordDiscussionReply,
  waitForAnswers,
} from "../scripts/ontology-ask.mjs";

test("decision screen shows pending questions across processes and keeps verification in the terminal", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "alignment-web-"));
  const project = path.join(dir, "project");
  mkdirSync(path.join(project, "docs/ontology"), { recursive: true });
  const file = path.join(project, "docs/ontology/model.ttl");
  writeFileSync(file, EXAMPLE);
  initRepo(project);
  write(project, "docs/adr/.mapping.json", JSON.stringify(MAPPING));
  writeAdrFiles(project, MAPPING);
  commitAll(project, "seed the process and its realizing contracts");
  const child = Bun.spawn(
    [
      process.execPath,
      CLI,
      "align",
      "--ui",
      "--process",
      "payment.take-payment",
      "--no-open",
      "--lang",
      "ko",
    ],
    { cwd: project, stdout: "pipe", stderr: "pipe" },
  );
  let browser;
  try {
    const reader = child.stdout.getReader();
    let text = "";
    while (!/ALIGN_RUN [^\n]+\n/.test(text)) {
      const { value, done } = await reader.read();
      if (done)
        throw new Error(
          "Alignment session did not start: " + text + (await new Response(child.stderr).text()),
        );
      text += new TextDecoder().decode(value);
    }
    const url = /ALIGN_SESSION (\S+)/.exec(text)[1],
      run = /ALIGN_RUN ([^\n]+)/.exec(text)[1];
    const reused = Bun.spawnSync(
      [process.execPath, CLI, "align", "--ui", "--no-open", "--process", "ordering.place-order"],
      { cwd: project },
    );
    assert.equal(reused.exitCode, 0, reused.stderr.toString());
    assert.ok(
      reused.stdout.toString().includes(`ALIGN_SESSION ${url}\nALIGN_RUN ${run}\nALREADY_OPEN`),
    );
    if (process.platform !== "win32") {
      const indexAlias = path.join("docs", "adr", "index-alias.json");
      symlinkSync(".mapping.json", path.join(project, indexAlias));
      const alias = Bun.spawnSync(
        [
          process.execPath,
          CLI,
          "align",
          "--ui",
          "--no-open",
          "--process",
          "ordering.place-order",
          "--index",
          indexAlias,
        ],
        { cwd: project, timeout: 5000 },
      );
      assert.equal(alias.exitCode, 0, alias.stderr.toString());
      assert.ok(
        alias.stdout.toString().includes(`ALIGN_SESSION ${url}\nALIGN_RUN ${run}\nALREADY_OPEN`),
      );
    }
    browser = await launch(path.join(dir, "isolated-browser"));
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#history");
    assert.equal(await page.$("#request"), null);
    const request = (id, process) =>
      Bun.spawnSync(
        [
          processExec,
          path.join(path.dirname(CLI), "ontology-ask.mjs"),
          "request",
          run,
          id,
          "--process",
          process,
        ],
        { cwd: project },
      );
    const processExec = process.execPath;
    assert.equal(request("payment", "payment.take-payment").exitCode, 0);
    const second = (await waitForAnswers(run, { timeoutSeconds: 5 })).messages[0];
    publishAlignmentPrompt(run, second.messageId, {
      id: "payment-intent",
      kind: "question",
      question: "결제가 언제 완료된 것으로 볼까요?",
    });
    const questionBox = ".result:has(h3) textarea";
    await page.waitForSelector(questionBox);
    await page.type(questionBox, "전액 수납");
    assert.equal(request("sibling", "ordering.place-order").exitCode, 0);
    publishAlignmentPrompt(run, "sibling", {
      id: "order-intent",
      kind: "question",
      question: "주문은 언제 확인할까요?",
    });
    await page.waitForFunction(() => document.querySelectorAll("#requests .result").length === 2);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "TEXTAREA");
    await page.keyboard.type(" 시 완료합니다.");
    await waitForAnswers(run, { timeoutSeconds: 5, pollMs: 50 });
    const answer = waitForAnswers(run, { timeoutSeconds: 10, pollMs: 50 });
    await page.evaluate(() =>
      [...document.querySelectorAll(".result")]
        .find((card) => card.querySelector("h3").textContent === "payment.take-payment")
        .querySelector(".align-turn button")
        .click(),
    );
    assert.equal((await answer).responses[0].text, "전액 수납 시 완료합니다.");
    publishAlignmentPrompt(run, second.messageId, {
      id: "first-detail",
      kind: "question",
      question: "어떤 금액을 확인할까요?",
    });
    publishAlignmentPrompt(run, second.messageId, {
      id: "second-detail",
      kind: "question",
      question: "부분 수납의 결과는 무엇인가요?",
    });
    const amountEditors = () =>
      [...document.querySelectorAll(".result")]
        .find((card) => card.querySelector("h3").textContent === "payment.take-payment")
        ?.querySelectorAll("textarea").length === 2;
    await page.waitForFunction(amountEditors);
    for (const [id, text] of [
      ["first-detail", "100"],
      ["second-detail", "pending"],
    ]) {
      const answer = Bun.spawnSync(
        [
          process.execPath,
          path.join(path.dirname(CLI), "ontology-ask.mjs"),
          "respond",
          run,
          second.messageId,
          id,
          "answer",
          "--text-file",
          write(project, `answer-${id}.txt`, text),
        ],
        { cwd: project },
      );
      assert.equal(answer.exitCode, 0, answer.stderr.toString());
    }
    assert.deepEqual(
      (await waitForAnswers(run, { timeoutSeconds: 5 })).responses.map((r) => r.promptId),
      ["first-detail", "second-detail"],
    );
    const entry = write(
      project,
      "payment.mjs",
      'console.log(Number(process.argv[2]) > 0 ? "settled" : "pending");\n',
    );
    const after = 'console.log(Number(process.argv[2]) === 100 ? "settled" : "pending");\n';
    publishAlignmentPrompt(run, second.messageId, {
      id: "payment-change",
      kind: "proposal",
      question: "전액 수납 시에만 완료하도록 수정할까요?",
      changes: [
        {
          layer: "code",
          target: "payment.mjs",
          before: "양수 입력이면 수납 완료",
          after: "100 전액 수납 시에만 완료",
        },
      ],
      files: ["payment.mjs"],
      verification: "부분 수납 30은 pending, 전액 수납 100은 settled.",
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".align-turn button")].some(
        (b) => b.textContent === "이 변경안 승인",
      ),
    );
    await page.click(".proposal-baseline summary");
    assert.ok(
      (await page.$eval(".proposal-baseline", (b) => b.textContent)).includes("payment.mjs"),
    );
    const approval = waitForAnswers(run, { timeoutSeconds: 10, pollMs: 50 });
    await page.evaluate(() =>
      [...document.querySelectorAll(".align-turn button")]
        .find((b) => b.textContent === "이 변경안 승인")
        .click(),
    );
    const decision = (await approval).responses[0];
    assert.equal(decision.decision, "approve");
    const owner = Bun.spawnSync(
      [
        process.execPath,
        path.join(path.dirname(CLI), "ontology-ask.mjs"),
        "approved",
        run,
        second.messageId,
        decision.promptId,
      ],
      { cwd: project },
    );
    assert.equal(owner.exitCode, 0, owner.stderr.toString());
    writeFileSync(entry, after);
    for (const [input, expected] of [
      ["30", "pending"],
      ["100", "settled"],
    ]) {
      assert.equal(
        Bun.spawnSync([process.execPath, entry, input], { cwd: project }).stdout.toString().trim(),
        expected,
      );
    }
    // Exercise the real transition used by the agent after its review. The
    // browser receipt itself never grants authority to change process Status.
    const transition = cli(project, [
      "transition",
      "--process",
      second.scope.process,
      "--to",
      "Accepted",
    ]);
    assert.equal(transition.code, 0, transition.out);
    assert.equal((readFileSync(file, "utf8").match(/onto:status "Accepted/g) ?? []).length, 1);
    recordDiscussionReply(
      run,
      second.messageId,
      JSON.stringify({
        outcome: "passed",
        evidence: "Fixture shows the stored result.",
        nextAction: "Inspect the evidence.",
      }),
    );
    await page.waitForFunction(
      () => !document.querySelector("#requests").textContent.includes("payment.take-payment"),
    );
    await page.click("#history");
    await page.waitForFunction(() =>
      document.querySelector("#requests").textContent.includes("Inspect the evidence."),
    );
    assert.match(readFileSync(file, "utf8"), /Accepted/);
    assert.deepEqual(errors, []);
    await page.click("#end");
    assert.equal(await child.exited, 0);
  } finally {
    await browser?.close();
    child.kill();
    await child.exited;
    rmSync(dir, { recursive: true, force: true });
  }
});
