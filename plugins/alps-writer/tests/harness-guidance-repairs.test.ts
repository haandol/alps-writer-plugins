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
  const acceptance = between(template, "7.x.6 Evaluation Rubric");
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

test("the rendered authoring example carries declared caps, expiry and approval into evaluable rows", () => {
  const guide = new TemplateService().getSectionGuide(7);
  const declared = between(guide, "Values the result must honor:", "#### 7.1.6 Evaluation Rubric");
  const acceptance = between(guide, "#### 7.1.6 Evaluation Rubric", "</example>");
  const cap = declared.match(/capped at (\d+) sections/)?.[1];
  const days = declared.match(/kept for (\d+) days/)?.[1];
  assert.ok(cap && days);
  const rows = tableRows(acceptance).filter(
    (row) => row[0] !== "Case and use" && !row[0].startsWith("-"),
  );
  assert.ok(rows.every((row) => row.length === 4 && row.every((cell) => cell.length > 0)));
  const count = rows.find((row) => row[0] === "Section-count limit");
  const retention = rows.find((row) => row[0] === "Draft retention");
  assert.ok(count && retention);
  assert.ok(count[1].includes(`${cap}-section`));
  assert.ok(
    count[3].includes(`${cap} sections`) && count[3].includes(`${Number(cap) + 1}th section`),
  );
  assert.ok(retention[1].includes(`${days}-day`));
  assert.ok(
    retention[3].includes(`before ${days} days`) && retention[3].includes("discard at expiry"),
  );
  assert.ok(
    rows.some(
      (row) =>
        row[0] === "Approval before persistence" &&
        /no section save occurs before confirmation/.test(row[3]),
    ),
  );
  assert.ok(
    rows.some((row) => row[0] === "Incomplete draft" && row[2].includes("completion state")),
  );
});

test("the Feature template exposes a criterion form separately from its opt-in examples", () => {
  const service = new TemplateService();
  const form = between(service.getSection(7), "7.x.6 Evaluation Rubric");
  const withExamples = between(service.getSection(7, true), "7.x.6 Evaluation Rubric");
  const expectedHeader = ["Case and use", "Given / input", "Observe", "Evaluator and rule"];
  const formRows = tableRows(form);
  const exampleRows = tableRows(withExamples);
  assert.ok(formRows.some((row) => JSON.stringify(row) === JSON.stringify(expectedHeader)));
  assert.ok(!formRows.some((row) => row[0] === "Account creation"));
  const creation = exampleRows.find((row) => row[0] === "Account creation");
  const arrival = exampleRows.find((row) => row[0] === "Authenticated arrival");
  assert.ok(creation && arrival);
  assert.equal(creation.length, 4);
  assert.equal(arrival.length, 4);
  assert.ok(
    arrival[1].includes("sign-up screen") && arrival[2].includes("authenticated user state"),
  );
});

test("rubric cases remain independently evaluable and paired metrics retain their populations and use", () => {
  const text = between(new TemplateService().getSection(7, true), "7.x.6 Evaluation Rubric");
  const example = text.slice(
    text.indexOf("**Ideal Cases — all cases in this example are required.**"),
  );
  const ideal = between(example, "**Ideal Cases", "**Edge Cases");
  const edges = between(example, "**Edge Cases", "**Automated Evaluation Metrics");
  const metrics = between(example, "**Automated Evaluation Metrics");
  const idealRows = tableRows(ideal);
  const edgeRows = tableRows(edges);
  const metricRows = tableRows(metrics);
  assert.ok(idealRows.some((row) => row[0] === "Account creation"));
  assert.ok(idealRows.some((row) => row[0] === "Authenticated arrival"));
  for (const name of [
    "Password minimum",
    "Email format",
    "Account lockout",
    "Duplicate rejection",
    "Retry after network timeout",
    "Server-error guidance",
  ]) {
    assert.ok(
      edgeRows.some((row) => row[0] === name),
      name,
    );
  }
  const pair = metricRows.find((row) => row[0].startsWith("Valid signup success rate"));
  assert.ok(pair);
  assert.equal(pair.length, 4);
  assert.match(pair[0], /completed valid signups \/ evaluated valid signup attempts/);
  assert.match(
    pair[1],
    /invalid signup attempts incorrectly accepted \/ evaluated invalid signup attempts/,
  );
  assert.match(pair[2], /ideal cases.*edge cases/);
  assert.match(pair[3], /monitoring summaries, not new target thresholds/);
  assert.match(metrics, /empty cohort.*unmeasured, not 0 or success/);
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
