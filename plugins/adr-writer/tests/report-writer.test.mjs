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
  assert.match(html, /data-rendered="true"/);
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
  const paragraphDump = sample();
  paragraphDump.sections[0].paragraphs = ["one\n\ntwo\n\nthree\n\nfour\n\nfive"];
  assert.throws(() => validateReport(paragraphDump), /0..4/);
});

test("mixed child and evidence disclosures cannot exceed four peers", () => {
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
  assert.throws(() => renderHtml(doc), /together exceed four/);
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
  assert.ok(markdown.indexOf("[Contract]") < markdown.indexOf("### Request replay"));
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
            assert.match(text, /at most four/);
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
