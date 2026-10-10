import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync, existsSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  validateReport,
  renderHtml,
  renderMarkdown,
} from "../skills/report-writer/scripts/render-report.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");
const sample = () => ({
  title: "A retry keeps one settlement",
  language: "en",
  summary: ["The duplicate path preserves one charge.", "Provider recovery remains unverified."],
  requiredEvidenceIds: ["R1", "T1"],
  review: {
    status: "reviewed",
    basis: "The source contract, executed test, and final explanation were reviewed.",
    limitations: "Provider recovery was not executed.",
  },
  sections: [
    {
      id: "payments",
      title: "Payments",
      domain: "Payments",
      scope: "Repeated settlement requests",
      paragraphs: ["A repeated key returns the stored result."],
      children: [
        {
          id: "settlement",
          title: "Settlement boundary",
          domain: "Payments",
          scope: "One stored completion",
          diagram: {
            source:
              "sequenceDiagram\nparticipant U as Caller\nparticipant P as Settlement\nparticipant S as Stored result\nU->>P: Retry\nP->>S: Read key\nS-->>P: Existing completion\nP-->>U: Same result",
            explanation: "The repeated request returns through the stored-result path.",
          },
          evidence: [
            {
              id: "R1",
              label: "Contract",
              source: "contract.md",
              excerpt: "A completed key is not charged again.",
            },
            {
              id: "T1",
              label: "Executed test",
              source: "test.txt",
              excerpt: "observed charge count: 1",
            },
          ],
        },
      ],
    },
  ],
});

test("report hierarchy preserves complete evidence and renders HTML/Markdown without dependencies", () => {
  const doc = sample();
  assert.deepEqual(validateReport(doc), {
    nodes: 2,
    evidence: 2,
    warnings: [],
    semanticReview: "reviewed",
  });
  const html = renderHtml(doc),
    markdown = renderMarkdown(doc);
  assert.match(html, /data-report|report-writer-policy/);
  assert.match(html, /data-render-state="pending"/);
  assert.match(html, /window.reportDiagramsReady/);
  assert.match(html, /observed charge count: 1/);
  assert.match(markdown, /## Payments/);
  assert.match(markdown, /### Settlement boundary/);
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /\[Contract\]\(<contract\.md>\)/);
  assert.match(markdown, /observed charge count: 1/);
  doc.sections[0].children[0].children = [];
  doc.sections[0].children[0].expanded = true;
  assert.equal(validateReport(doc).nodes, 2);
  assert.match(renderHtml(doc), /id="settlement" open/);
});

test("the installed CLI runs through a symlinked project path", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "report-cli-"));
  try {
    const alias = path.join(temp, "installed-skill");
    symlinkSync(path.join(ROOT, "plugins/adr-writer/skills/report-writer"), alias, "dir");
    const input = path.join(temp, "report.json"),
      output = path.join(temp, "report.html");
    writeFileSync(input, JSON.stringify(sample()));
    const result = spawnSync(
      process.execPath,
      [path.join(alias, "scripts/render-report.mjs"), input, "--out", output],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(output), true, "CLI must create the requested report");
    assert.match(readFileSync(output, "utf8"), /observed charge count: 1/);
    assert.equal(JSON.parse(result.stdout).evidence, 2);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("five peer units, missing evidence and hidden headings fail instead of truncating", () => {
  const tooMany = sample();
  tooMany.sections = Array.from({ length: 5 }, (_, i) => ({
    ...tooMany.sections[0],
    id: `domain-${i}`,
  }));
  assert.throws(() => renderHtml(tooMany), /one to four/);
  const missing = sample();
  missing.requiredEvidenceIds.push("R2");
  assert.throws(() => renderMarkdown(missing), /missing=R2/);
  const duplicate = sample();
  duplicate.sections[0].children[0].evidence[1].id = "R1";
  assert.throws(() => validateReport(duplicate), /unique/);
  const hidden = sample();
  hidden.sections[0].paragraphs = ["## Hidden fifth section"];
  assert.throws(() => validateReport(hidden), /headings and peer lists/);
  const ignored = sample();
  ignored.unlistedFinding = "must not disappear";
  assert.throws(() => validateReport(ignored), /would be lost/);
});

test("semantic paragraphs remain separate without a numeric cap at any reading level", () => {
  const prose = [
    "The caller supplies a request key.",
    "An empty key is rejected before storage access.",
    "A stored result is returned for a completed request.",
    "An unknown outcome requires a provider lookup.",
    "A confirmed failure follows the recovery rule.",
    "The caller receives the final recorded outcome.",
  ];
  for (const paragraphs of [prose, [prose.join("\n\n")]]) {
    const doc = sample();
    doc.background = paragraphs;
    doc.summary = paragraphs;
    doc.sections[0].paragraphs = paragraphs;
    doc.sections[0].children[0].paragraphs = paragraphs;
    assert.equal(validateReport(doc).nodes, 2);
    const html = renderHtml(doc);
    const markdown = renderMarkdown(doc);
    for (const paragraph of prose) {
      assert.equal(html.split(`<p>${paragraph}</p>`).length - 1, 4);
      assert.equal(markdown.split(paragraph).length - 1, 4);
    }
    const tooMany = structuredClone(doc);
    tooMany.sections[0].children = Array.from({ length: 5 }, (_, i) => ({
      id: `child-${i}`,
      title: "Independent scope",
      domain: "Payments",
      scope: "A separate explanation",
      paragraphs: [prose[i]],
    }));
    assert.throws(() => validateReport(tooMany), /one to four/);
  }
  for (const paragraphs of [[""], ["   "], [null], "not an array"]) {
    const doc = sample();
    doc.sections[0].paragraphs = paragraphs;
    assert.throws(() => validateReport(doc), /nonempty strings/);
  }
});

test("supporting evidence does not consume the four explanation branches", () => {
  const doc = sample();
  const parent = doc.sections[0];
  parent.children = Array.from({ length: 4 }, (_, index) => ({
    id: `responsibility-${index}`,
    title: `Responsibility ${index}`,
    domain: "Payments",
    scope: "A distinct responsibility",
    paragraphs: ["Its supported behavior."],
  }));
  parent.evidence = sample().sections[0].children[0].evidence;
  assert.equal(validateReport(doc).nodes, 5);
  assert.ok(renderHtml(doc).includes("observed charge count: 1"));
  parent.children = parent.children.slice(0, 2);
  assert.equal(validateReport(doc).evidence, 2);
});

test("Markdown preserves parent evidence ownership, node anchors and known render failures", () => {
  const doc = sample();
  const parent = doc.sections[0],
    child = parent.children[0];
  parent.evidence = [child.evidence.shift()];
  parent.evidence[0].source = "#settlement";
  child.title = "Request replay";
  child.diagram.source = "unknownDiagram\n```";
  child.diagram.required = false;
  const markdown = renderMarkdown(doc);
  assert.ok(markdown.indexOf("[Contract]") > markdown.indexOf("### Request replay"));
  assert.ok(markdown.includes("**Payments · Evidence**"));
  assert.match(markdown, /<a id="settlement"><\/a>/);
  assert.match(markdown, /\[Contract\]\(<#settlement>\)/);
  assert.match(markdown, /Diagram not rendered/);
  assert.match(markdown, /````mermaid\nunknownDiagram\n```\n````/);
  parent.evidence[0].source = "#missing";
  assert.throws(() => renderHtml(doc), /Unknown report fragment/);
  assert.throws(() => renderMarkdown(doc), /Unknown report fragment/);
});

test("source text cannot execute markup and unsupported diagrams are never labeled rendered", () => {
  const doc = sample();
  doc.title = "<script>alert(1)</script>";
  doc.sections[0].paragraphs = ["<img src=x onerror=alert(1)>"];
  const html = renderHtml(doc);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  const evidence = doc.sections[0].children[0].evidence[0];
  evidence.source = "javascript:alert(1)";
  assert.throws(() => renderHtml(doc), /safe nonempty/);
  evidence.source = "contract.md";
  const diagram = doc.sections[0].children[0].diagram;
  diagram.source = "unknownDiagram\nx";
  assert.throws(() => renderHtml(doc), /required diagram/);
  diagram.required = false;
  assert.match(renderHtml(doc), /data-rendered="false"/);
  doc.review.status = "draft";
  assert.match(renderHtml(doc), /editorial review is not complete/);
});

test("installing both plugins exposes one report skill and one report directive per session event", () => {
  const check = spawnSync(process.execPath, ["scripts/sync-report-skill.mjs", "--check"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const temp = mkdtempSync(path.join(os.tmpdir(), "report-hook-"));
  try {
    let reportSkills = 0;
    const directives = { startup: 0, resume: 0, clear: 0, compact: 0 };
    for (const plugin of ["adr-writer", "alps-writer"]) {
      const base = `plugins/${plugin}`;
      const installedSkill = existsSync(path.join(ROOT, base, "skills/report-writer"));
      assert.equal(installedSkill, plugin === "adr-writer");
      if (installedSkill) reportSkills++;
      const manifest = JSON.parse(read(`${base}/.codex-plugin/plugin.json`));
      const configPath = path.join(ROOT, base, "hooks/hooks.json");
      if (plugin === "alps-writer") {
        assert.equal(manifest.hooks, undefined);
        assert.equal(existsSync(configPath), false, "Claude must not auto-discover a report hook");
        assert.doesNotMatch(JSON.stringify(manifest), /report/i);
        continue;
      }
      assert.equal(manifest.hooks, "./hooks/hooks.json");
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      for (const source of Object.keys(directives)) {
        for (const entry of config.hooks.SessionStart) {
          if (!new RegExp(`^(?:${entry.matcher})$`).test(source)) continue;
          for (const hook of entry.hooks) {
            if (!hook.command.includes("surface-report-context")) continue;
            const out = spawnSync(hook.command, {
              shell: true,
              cwd: temp,
              env: { ...process.env, PLUGIN_ROOT: path.join(ROOT, base) },
              input: JSON.stringify({ hook_event_name: "SessionStart", source }),
              encoding: "utf8",
            });
            assert.equal(out.status, 0, out.stderr);
            const text = JSON.parse(out.stdout).hookSpecificOutput.additionalContext;
            assert.match(text, /Report-writing directive/);
            assert.match(text, /report-writer[/\\]SKILL\.md/);
            assert.doesNotMatch(text, /ADR-first directive/);
            directives[source]++;
          }
        }
      }
    }
    assert.equal(reportSkills, 1);
    assert.deepEqual(directives, { startup: 1, resume: 1, clear: 1, compact: 1 });
    assert.equal(existsSync(path.join(temp, "docs/adr")), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("report entrypoints route to the shared English skill without changing native schemas", () => {
  const skill = read("shared/report-writer/SKILL.md");
  assert.match(skill, /editorial-review\.md/);
  assert.match(skill, /format-and-layout\.md/);
  assert.doesNotMatch(skill, /\p{Script=Hangul}/u);
  const editorial = read("shared/report-writer/references/editorial-review.md");
  assert.match(editorial, /latest whole/);
  assert.match(editorial, /High and Medium/);
  assert.match(editorial, /hypothetical/);
  assert.match(editorial, /6 \/ 8 = 75%/);
  assert.match(editorial, /system being reported/);
  for (const name of [
    "adr-new",
    "adr-review",
    "adr-sync",
    "adr-rollup",
    "adr-impl",
    "adr-impl-review",
    "adr-impl-refactor",
  ])
    assert.match(read(`plugins/adr-writer/skills/${name}/SKILL.md`), /\[report-writer\]/);
  for (const name of ["alps-init", "lite-alps-init", "feature-to-adr"])
    assert.doesNotMatch(read(`plugins/alps-writer/skills/${name}/SKILL.md`), /report-writer/);
});

test("reports with no diagrams retain their explanation and evidence in both formats", () => {
  for (const diagram of [undefined, null]) {
    const doc = sample();
    doc.sections[0].diagram = diagram;
    doc.sections[0].children[0].diagram = diagram;
    assert.deepEqual(validateReport(doc), {
      nodes: 2,
      evidence: 2,
      warnings: [],
      semanticReview: "reviewed",
    });
    const html = renderHtml(doc),
      markdown = renderMarkdown(doc);
    assert.match(html, /A repeated key returns the stored result/);
    assert.match(html, /observed charge count: 1/);
    assert.doesNotMatch(html, /<figure/);
    assert.match(markdown, /Settlement boundary/);
    assert.match(markdown, /observed charge count: 1/);
    assert.doesNotMatch(markdown, /```mermaid/);
    doc.requiredEvidenceIds.push("missing");
    for (const render of [validateReport, renderHtml, renderMarkdown])
      assert.throws(() => render(doc), /Evidence coverage mismatch/);
  }
});

test("the CLI delivers diagram-free reports and preserves files on invalid evidence", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "report-optional-figures-"));
  try {
    const input = path.join(temp, "report.json"),
      output = path.join(temp, "report.out"),
      cli = path.join(ROOT, "plugins/adr-writer/skills/report-writer/scripts/render-report.mjs");
    const doc = sample();
    delete doc.sections[0].children[0].diagram;
    const run = (format) =>
      spawnSync(process.execPath, [cli, input, "--out", output, "--format", format], {
        encoding: "utf8",
      });
    for (const [format, render] of [
      ["html", renderHtml],
      ["markdown", renderMarkdown],
    ]) {
      writeFileSync(input, JSON.stringify(doc));
      const result = run(format);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(output, "utf8"), render(doc));
      doc.requiredEvidenceIds.push("missing");
      writeFileSync(input, JSON.stringify(doc));
      const rejected = run(format);
      assert.equal(rejected.status, 2);
      assert.match(rejected.stderr, /Evidence coverage mismatch/);
      assert.equal(
        readFileSync(output, "utf8"),
        render({ ...doc, requiredEvidenceIds: ["R1", "T1"] }),
      );
      rmSync(output);
      assert.equal(run(format).status, 2);
      assert.equal(existsSync(output), false);
      doc.requiredEvidenceIds.pop();
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("CLI and API preserve output and diagnostics for optional figures at any depth", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "report-figure-parity-"));
  try {
    const input = path.join(temp, "report.json"),
      output = path.join(temp, "report.out"),
      cli = path.join(ROOT, "plugins/adr-writer/skills/report-writer/scripts/render-report.mjs");
    const diagrams = [
      undefined,
      null,
      { source: "flowchart TD\nU[Caller] --> P[Payments]" },
      { source: "sequenceDiagram\nCaller->>Payments: Request" },
      { source: "unknownDiagram\nx", required: false },
      { source: "unknownDiagram\nx", required: true },
      { source: "unknownDiagram\nx" },
    ];
    for (const diagram of diagrams) {
      for (const depth of [0, 1]) {
        const doc = sample();
        delete doc.sections[0].children[0].diagram;
        const node = depth === 0 ? doc.sections[0] : doc.sections[0].children[0];
        node.diagram = diagram && { ...diagram, explanation: "The caller reaches payments." };
        writeFileSync(input, JSON.stringify(doc));
        const invalid = diagram?.source.startsWith("unknownDiagram") && diagram.required !== false;
        const warnings = diagram?.required === false ? 1 : 0;
        for (const [format, render] of [
          ["html", renderHtml],
          ["markdown", renderMarkdown],
        ]) {
          writeFileSync(output, "Previous report");
          const result = spawnSync(
            process.execPath,
            [cli, input, "--out", output, "--format", format],
            { encoding: "utf8" },
          );
          if (invalid) {
            for (const check of [validateReport, render])
              assert.throws(() => check(doc), /required diagram: No diagram type detected/);
            assert.equal(result.status, 2);
            assert.match(result.stderr, /required diagram: No diagram type detected/);
            assert.equal(readFileSync(output, "utf8"), "Previous report");
          } else {
            const validation = validateReport(doc);
            assert.equal(validation.warnings.length, warnings);
            assert.equal(result.status, 0, result.stderr);
            assert.equal(readFileSync(output, "utf8"), render(doc));
            assert.deepEqual(JSON.parse(result.stdout), { output, ...validation });
            if (warnings) assert.match(render(doc), /Diagram not rendered/);
          }
        }
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
