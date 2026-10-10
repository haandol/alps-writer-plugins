import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  renderHtml,
  renderMarkdown,
  validateReport,
} from "../skills/report-writer/scripts/render-report.mjs";

const question = (index = 1) => ({
  id: `Q${index}`,
  sectionId: "retries",
  question: `Which retry path is supported (${index})?`,
  options: [
    { id: "A", text: "Completed request.", feedback: "A recorded completion is reused." },
    { id: "B", text: "Unknown outcome.", feedback: "An unknown outcome needs reconciliation." },
    { id: "C", text: "Every request.", feedback: "The evidence has a limited scope." },
    { id: "D", text: "No request.", feedback: "The completed path is supported." },
  ],
  correctOptionId: "A",
  explanation: "Only completed requests have a stored result.",
  evidence: "The completed and unknown child explanations.",
  revisit: index === 1,
});
const report = () => ({
  title: "Retry decision",
  language: "en",
  background: ["The operator needs to decide which payment retries are safe."],
  summary: ["Completed requests reuse a result; unknown outcomes need reconciliation."],
  sections: [
    {
      id: "retries",
      title: "Retry paths",
      domain: "Payments",
      scope: "Recorded or unknown outcomes",
      paragraphs: ["The result already recorded determines which retry path applies."],
      children: [
        {
          id: "completed",
          title: "Completed",
          domain: "Payments",
          scope: "Recorded success",
          preview: "Why a completed payment does not charge again.",
          paragraphs: ["The stored result is returned without charging again."],
        },
        {
          id: "unknown",
          title: "Unknown",
          domain: "Payments",
          scope: "Reconcile before another charge",
          paragraphs: ["A timeout alone does not prove that no charge occurred."],
        },
      ],
      evidence: [
        {
          id: "E1",
          label: "Original retry rule",
          source: "rule.txt",
          excerpt: "Recorded completion is reused.",
        },
      ],
    },
  ],
  comprehensionCheck: { questions: [question()] },
  requiredEvidenceIds: ["E1"],
  review: {
    status: "draft",
    basis: "Authored regression fixture.",
    limitations: "Not a reader study.",
  },
});

test("background and answer remain distinct with optional authored titles and legacy text intact", () => {
  for (const language of ["en", "ko"]) {
    const doc = { ...report(), language, summaryTitle: "Decision <with conditions>" };
    const before = structuredClone(doc);
    const html = renderHtml(doc),
      markdown = renderMarkdown(doc);
    const header = html.match(/<header>([\s\S]*?)<\/header>/)[1];
    assert.ok(header.includes(doc.background[0]));
    assert.ok(!header.includes(doc.summary[0]));
    assert.ok(html.indexOf(doc.summary[0]) > html.indexOf("</header>"));
    assert.ok(html.indexOf(doc.summary[0]) < html.indexOf("<nav"));
    assert.ok(markdown.indexOf(doc.background[0]) < markdown.indexOf("## Decision"));
    assert.ok(markdown.indexOf("## Decision") < markdown.indexOf(doc.summary[0]));
    assert.ok(html.includes("Decision &lt;with conditions&gt;"));
    assert.deepEqual(doc, before);
  }
  const legacy = report();
  delete legacy.background;
  const html = renderHtml(legacy),
    markdown = renderMarkdown(legacy);
  assert.ok(html.includes(legacy.summary[0]));
  assert.ok(markdown.includes(legacy.summary[0]));
  assert.doesNotMatch(html, /<h2>Background and goals<\/h2>/);
  assert.doesNotMatch(markdown, /## Background and goals/);
  assert.doesNotMatch(renderHtml(report()), /<section class="report-answer"><h2>/);
});

test("collapsible branches expose an authored preview or existing scope without duplicating body text", () => {
  const doc = report();
  doc.sections[0].children[0].preview = "<script>Explain stored completion</script>";
  const html = renderHtml(doc),
    markdown = renderMarkdown(doc);
  const summaries = [
    ...html.matchAll(/<details class="report-node"[^>]+>\s*<summary>([\s\S]*?)<\/summary>/g),
  ].map((x) => x[1]);
  assert.equal(summaries.length, 2);
  assert.ok(summaries[0].includes("&lt;script&gt;Explain stored completion&lt;/script&gt;"));
  assert.ok(summaries[1].includes("Reconcile before another charge"));
  assert.ok(!summaries[0].includes(doc.sections[0].children[0].paragraphs[0]));
  assert.ok(markdown.includes("Explain stored completion"));
  assert.doesNotMatch(html, /<script>Explain/);
});

test("explanations start open while optional evidence stays folded and explicit choices remain supported", () => {
  const doc = report();
  const child = doc.sections[0].children[0];
  child.diagram = {
    source: "flowchart LR\nA[Repeated request] --> B[Stored result]",
    explanation: "The request reuses its recorded result.",
  };
  child.children = [{ ...child, id: "completion-detail", expanded: true }];
  const before = structuredClone(doc);
  const html = renderHtml(doc);
  const details = [...html.matchAll(/<details\b([^>]*)>/g)].map((match) => match[1]);
  assert.equal(details.filter((attrs) => attrs.includes('class="report-node"')).length, 3);
  assert.ok(
    details
      .filter((attrs) => attrs.includes('class="report-node"'))
      .every((attrs) => /\bopen(?:\s|$)/.test(attrs)),
  );
  assert.ok(
    details
      .filter(
        (attrs) =>
          !attrs.includes('class="report-node"') && !attrs.includes('class="diagram-source"'),
      )
      .every((attrs) => !/\bopen(?:\s|$)/.test(attrs)),
  );
  assert.ok(
    details
      .filter((attrs) => attrs.includes('class="diagram-source"'))
      .every((attrs) => /\bopen(?:\s|$)/.test(attrs)),
    "source stays available while rendering is pending",
  );
  assert.deepEqual(doc, before, "rendering must not rewrite saved presentation choices");

  child.expanded = false;
  const collapsed = renderHtml(doc);
  const heading = collapsed.match(/<details\b[^>]*id="completed"[^>]*>/)[0];
  assert.doesNotMatch(heading, /\bopen\b/);
  assert.match(collapsed, /id="completion-detail" open/);
  assert.match(collapsed, /id="unknown" open/);
  assert.ok(collapsed.includes(child.paragraphs[0]), "collapsed content is retained in the HTML");
});

test("necessary evidence opens its enclosing group without expanding unrelated sources", () => {
  const doc = report();
  const required = doc.sections[0].evidence[0];
  required.expanded = true;
  doc.requiredEvidenceIds.push("E2");
  doc.sections[0].evidence.push({
    id: "E2",
    label: "Raw log",
    source: "raw.txt",
    excerpt: "Complete optional log",
  });
  const html = renderHtml(doc);
  assert.match(html, /<details class="evidence-group" open data-print-expanded="true">/);
  assert.match(
    html,
    /<details class="evidence" open data-print-expanded="true"><summary>Original retry rule/,
  );
  assert.match(html, /<details class="evidence"><summary>Raw log/);
  assert.ok(html.includes("Complete optional log"));
  assert.ok(renderMarkdown(doc).includes("Complete optional log"));
  required.expanded = "yes";
  assert.throws(() => renderHtml(doc), /E1: expanded must be boolean/);
});

test("printing expands explanations and necessary evidence without unfolding optional sources", () => {
  const elements = [
    { kind: "report-node", open: false },
    { kind: "report-node", open: true },
    { kind: "evidence-group", open: false },
    { kind: "evidence", open: false },
    { kind: "diagram-source", open: false },
    { kind: "evidence-group", open: false, printExpanded: true },
    { kind: "evidence", open: false, printExpanded: true },
    { kind: "evidence", open: true },
  ];
  const events = new Map();
  const document = {
    querySelectorAll(selector) {
      if (
        selector ===
        'details.report-node:not([open]),details[data-print-expanded="true"]:not([open])'
      )
        return elements.filter(
          (node) => !node.open && (node.kind === "report-node" || node.printExpanded),
        );
      if (['a[href^="#"]', ".diagram__viewport", ".quiz"].includes(selector)) return [];
      throw new Error(`Unexpected document query: ${selector}`);
    },
  };
  const script = renderHtml(report()).match(/<script>([\s\S]*?)<\/script>/)[1];
  runInNewContext(script, {
    document,
    window: { addEventListener: (name, handler) => events.set(name, handler) },
  });
  const initial = elements.map((node) => node.open);
  events.get("afterprint")();
  assert.deepEqual(
    elements.map((node) => node.open),
    initial,
  );
  for (let pass = 0; pass < 2; pass++) {
    events.get("beforeprint")();
    events.get("beforeprint")();
    assert.deepEqual(
      elements.map((node) => node.open),
      [true, true, false, false, false, true, true, true],
    );
    events.get("afterprint")();
    assert.deepEqual(
      elements.map((node) => node.open),
      initial,
    );
  }
});

test("both formats teach child cases before the parent's quiz and explicitly owned source evidence", () => {
  const doc = report();
  delete doc.background;
  delete doc.sections[0].children[0].preview;
  const html = renderHtml(doc),
    markdown = renderMarkdown(doc);
  for (const child of doc.sections[0].children) {
    assert.ok(html.indexOf(child.paragraphs[0]) < html.indexOf('<article class="quiz">'));
    assert.ok(markdown.indexOf(child.paragraphs[0]) < markdown.indexOf("**Q1."));
    assert.ok(
      html.includes(`href="#${child.id}"`),
      "quiz offers a path back to prerequisite explanations",
    );
  }
  assert.ok(markdown.indexOf("**Q1.") < markdown.indexOf("[Original retry rule]"));
  assert.ok(html.indexOf('<article class="quiz">') < html.indexOf("Original retry rule"));
  assert.ok(markdown.includes("**Retry paths · Evidence**"));
  assert.ok(markdown.includes("**Retry paths · Check your understanding**"));
});

test("four branches can retain many sources and all five questions without inventing more explanation levels", () => {
  const doc = report();
  delete doc.background;
  delete doc.sections[0].children[0].preview;
  const parent = doc.sections[0];
  parent.children = Array.from({ length: 4 }, (_, i) => ({
    ...parent.children[0],
    id: `path-${i}`,
  }));
  parent.evidence = Array.from({ length: 7 }, (_, i) => ({
    id: `E${i}`,
    label: `Source ${i}`,
    source: `source-${i}.txt`,
    excerpt: `Verbatim evidence ${i}`,
  }));
  doc.requiredEvidenceIds = parent.evidence.map((e) => e.id);
  doc.comprehensionCheck.questions = Array.from({ length: 5 }, (_, i) => question(i + 1));
  assert.equal(validateReport(doc).nodes, 5);
  for (const output of [renderHtml(doc), renderMarkdown(doc)])
    for (const e of parent.evidence) assert.ok(output.includes(e.excerpt));
  parent.children.push({ ...parent.children[0], id: "fifth" });
  assert.throws(() => validateReport(doc), /one to four/);
  parent.children.pop();
  parent.evidence[1].id = parent.evidence[0].id;
  assert.throws(() => validateReport(doc), /unique/);
});

test("new presentation fields fail explicitly on invalid values rather than being silently dropped", () => {
  for (const [change, error] of [
    [
      (d) => {
        d.background = [];
      },
      /background/,
    ],
    [
      (d) => {
        d.summaryTitle = {};
      },
      /summaryTitle/,
    ],
    [
      (d) => {
        d.sections[0].children[0].preview = 1;
      },
      /preview/,
    ],
  ]) {
    const doc = report();
    change(doc);
    assert.throws(() => renderHtml(doc), error);
  }
});
