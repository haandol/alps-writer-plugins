import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseMermaid,
  renderMermaid,
  mermaidBlocks,
} from "../scripts/adr-impl-review-diagrams.mjs";

const ui = { diagramFallback: "Cannot render" };
test("official grammar accepts class, C4, nested states, ER attributes and sequence activations", () => {
  for (const source of [
    "classDiagram\nAnimal <|-- Duck\nOwner *-- Pet",
    'C4Context\nPerson(user, "User")',
    "stateDiagram-v2\nA --> B\nstate B {\nC --> D\n}",
    "erDiagram\nUSER {\nstring name\n}\nUSER ||--o{ ORDER : owns",
    "sequenceDiagram\nA->>+B: call\nB-->>-A: done",
    "flowchart LR\nsubgraph Outer\nsubgraph Inner\nA --> B\nend\nend",
    "mindmap\n  root((Topic))\n    Child",
  ]) {
    assert.ok(!parseMermaid(source).error, JSON.stringify(parseMermaid(source)));
    const html = renderMermaid(source, ui);
    assert.match(html, /data-render-state="pending"/);
    assert.match(html, /data-rendered="false"/);
    assert.doesNotMatch(html, /<svg/);
  }
});
test("invalid syntax rejects the whole figure and preserves escaped source", () => {
  for (const source of [
    "unknownDiagram\nx",
    "sequenceDiagram\nA->>B: call\nnot valid syntax",
    "flowchart LR\nA -->",
  ]) {
    assert.ok(parseMermaid(source).error);
    const html = renderMermaid(source, ui);
    assert.match(html, /data-render-state="failed"/);
    assert.doesNotMatch(html, /<svg/);
    assert.match(html, /Cannot render/);
  }
  assert.doesNotMatch(renderMermaid("unknownDiagram\n<script>alert(1)</script>", ui), /<script>/);
});
test("the packaged parser works outside the workspace without installed dependencies", () => {
  const directory = mkdtempSync(join(tmpdir(), "report-mermaid-install-"));
  try {
    const worker = join(directory, "parser.mjs");
    cpSync(
      new URL("../skills/report-writer/scripts/vendor/mermaid-parser.mjs", import.meta.url),
      worker,
    );
    const result = spawnSync(process.execPath, [worker], {
      cwd: directory,
      input: "classDiagram\nAnimal <|-- Duck",
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr.slice(-2000));
    assert.ok(JSON.parse(result.stdout).type);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fence discovery ignores nested Markdown examples and records ownership and review cues", () => {
  const source = `## Context
\`\`\`\`text
## Fake section
\`\`\`mermaid
sequenceDiagram
%% requirement: V99
A->>B: fake
\`\`\`
\`\`\`\`
## Real flow
Read: Caller sends the input.
~~~mermaid
%% requirement: V1
sequenceDiagram
A->>B: real input
~~~
Notice: The response follows the call.`;
  const blocks = mermaidBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].section, "Real flow");
  assert.equal(blocks[0].requirementId, "V1");
  assert.equal(blocks[0].notice, true);
  assert.equal(blocks[0].closed, true);
});
