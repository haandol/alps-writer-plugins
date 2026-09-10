import assert from "node:assert/strict";
import { test } from "node:test";
import { ALPS_PROFILE, LITE_ALPS_PROFILE } from "../src/profiles.js";
import { TemplateController } from "../src/tools/templates/controller.js";
import { TemplateService } from "../src/tools/templates/service.js";

function tableRows(text: string): string[][] {
  return text
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

function between(text: string, start: string, end?: string): string {
  const from = text.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = end ? text.indexOf(end, from + start.length) : text.length;
  assert.ok(to > from, `missing ${end}`);
  return text.slice(from, to);
}

test("the sign-up example keeps password and lockout rules identical in acceptance criteria", () => {
  const service = new TemplateService();
  const template = service.getSection(7, true);
  const technical = between(template, "7.x.3 Technical Description", "7.x.4 Edge Cases");
  const acceptance = between(template, "7.x.6 Acceptance Criteria");
  const password = technical.match(/A password is at least (\d+) characters/);
  const lockout = technical.match(
    /(\d+) consecutive failed sign-in attempts lock the account for (\d+) minutes/,
  );
  assert.ok(password && lockout);
  assert.equal(acceptance.match(/Password must be at least (\d+) characters/)?.[1], password[1]);
  assert.equal(
    acceptance.match(
      /A (\d+)(?:st|nd|rd|th) consecutive failed sign-in locks the account for (\d+) minutes/,
    )?.[1],
    lockout[1],
  );
  assert.equal(acceptance.match(/locks the account for (\d+) minutes/)?.[1], lockout[2]);
  assert.equal(/special character/i.test(acceptance), /special character/i.test(technical));
  assert.doesNotMatch(
    acceptance,
    /unverified.*deleted/i,
    "the Section 6 example excludes email verification",
  );
  assert.doesNotMatch(service.getSection(7), /A 5th consecutive/, "examples remain opt-in");
});

test("NFR examples preserve the daily-user unit and the latency condition in their checks", () => {
  const service = new TemplateService();
  const nfr = tableRows(service.getSection(6, true)).find((row) => row[0] === "NF2");
  const thresholds = tableRows(between(service.getSection(8, true), "8.2 Success Thresholds"));
  const workload = thresholds.find((row) => row[0].includes("NF2"));
  assert.ok(nfr && workload);
  const unit = nfr[1].match(/([\d,]+) (daily active|concurrent) users/);
  assert.ok(unit);
  assert.ok(workload[2].includes(`${unit[1]} ${unit[2]} users`));
  assert.match(nfr[1], /NF3/);
  assert.match(workload[2], /NF3/);
  assert.ok(
    thresholds.some((row) => row[0].includes("NF1") && /no plaintext passwords/.test(row[2])),
  );
  assert.ok(thresholds.some((row) => row[0].includes("NF3") && /3 seconds \(p95\)/.test(row[2])));
});

test("the metrics guide checks both NF1 obligations and carries Section 2 KPI units", () => {
  const service = new TemplateService();
  const nfr = tableRows(service.getSectionGuide(6)).find((row) => row[0] === "NF1");
  assert.ok(nfr);
  const concurrency = nfr[1].match(/[\d,]+ concurrent users/)?.[0];
  const seconds = nfr[1].match(/within (\d+) seconds/)?.[1];
  assert.ok(concurrency && seconds);
  const metrics = tableRows(between(service.getSectionGuide(8), "### 8.2 Success Thresholds"));
  assert.ok(metrics.some((row) => row[0].includes("NF1") && row[2].includes(concurrency)));
  assert.ok(metrics.some((row) => row[0].includes("NF1") && row[2] === `≤ ${seconds} seconds`));
  const goals = service.getSectionGuide(2);
  const minutes = goals.match(/under (\d+) minutes/)?.[1];
  const rate = goals.match(/(\d+)% or higher/)?.[1];
  assert.ok(minutes && rate);
  assert.ok(
    metrics.some((row) => /writing time/.test(row[0]) && row[2].includes(`${minutes} minutes`)),
  );
  assert.ok(metrics.some((row) => /context retention/.test(row[0]) && row[2].includes(`${rate}%`)));
});

test("both overview responses distinguish new documents from resume in their own authoring order", () => {
  for (const profile of [ALPS_PROFILE, LITE_ALPS_PROFILE]) {
    const controller = new TemplateController(
      new TemplateService(profile),
      profile.sectionGuideTool,
    );
    const response = controller.getAlpsOverview();
    assert.match(response, /get_alps_document_status/);
    assert.match(response, /New document:/);
    assert.match(response, /Resume:.*first incomplete required section/);
    assert.ok(response.includes(profile.authoringOrder.join(" → ")));
    assert.match(response, /Do not restart a completed, unchanged section/);
    assert.doesNotMatch(response, /\*\*REQUIRED\*\*: Call `[^`]+\(1\)`/);
  }
});

test("Full examples do not invent a stack or a technical-debt roadmap", () => {
  const service = new TemplateService();
  const navigation = between(service.getSectionGuide(5), "<example>", "</example>");
  const roadmap = between(service.getSectionGuide(9), "<example>", "</example>");
  assert.doesNotMatch(navigation, /Chainlit|Claude|React|Express/);
  assert.doesNotMatch(roadmap, /S3|ECS|Phase [23]|coverage/i);
  const template = service.getSection(9, true);
  assert.match(template, /No product behavior was explicitly deferred/);
  assert.match(template, /No known technical debt/);
  assert.doesNotMatch(template, /coverage to 80%/);
  assert.match(service.getSectionGuide(9), /Section 9 remains a required approval unit/);
});
