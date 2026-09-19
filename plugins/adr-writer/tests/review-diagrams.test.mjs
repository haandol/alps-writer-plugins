import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMermaid,
  renderMermaid,
  mermaidBlocks,
} from "../scripts/adr-impl-review-diagrams.mjs";

const ui = { diagramFallback: "Cannot render", stateStart: "Start", stateEnd: "End" };

test("diagram labels wrap at Korean word boundaries before splitting a token", () => {
  const html = renderMermaid(
    "sequenceDiagram\nparticipant A as 12345678901234567890 결제금액\nparticipant B as Result\nA->>B: completion",
    ui,
  );
  const spans = [...html.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((match) => match[1]);
  assert.ok(spans.includes("결제금액"));
  assert.ok(spans.includes("12345678901234567890"));
  assert.ok(!spans.includes("제금액"));
});

test("sequence diagrams retain actors, request order, response style, and conditional branches", () => {
  const source = `sequenceDiagram
participant Caller
participant OpenAI as Provider
alt success
Caller->>OpenAI: request
OpenAI-->>Caller: result
else failure
Note over Caller,OpenAI: no completion
OpenAI-->>Caller: error
end`;
  const parsed = parseMermaid(source);
  assert.equal(parsed.type, "sequenceDiagram");
  assert.deepEqual([...parsed.participants.keys()], ["Caller", "OpenAI"]);
  assert.deepEqual(
    parsed.events[0].branches.map((branch) => branch.label),
    ["success", "failure"],
  );
  const html = renderMermaid(source, ui);
  assert.match(html, /<svg[^>]*role="img"/);
  assert.equal((html.match(/class="sequence__lifeline"/g) || []).length, 2);
  assert.match(html, /data-from="OpenAI" data-to="Caller"/);
  assert.match(html, /stroke-dasharray="6 4"/);
  assert.match(html, /class="sequence__block" data-block="alt"/);
  assert.doesNotMatch(html, /<(?:ol|li)\b/);
});

test("component diagrams share one node per component and preserve system boundaries and chain edges", () => {
  const source = `flowchart LR
subgraph review["Review boundary"]
Writer["Writer: compose"] -->|report| Validator["Validator: inspect"]
end
Validator --> Renderer["Renderer: display"] --> Reader["Reader"]
Writer -.->|evidence| Renderer`;
  const parsed = parseMermaid(source);
  assert.equal(parsed.type, "flowchart");
  assert.equal(parsed.nodes.size, 4);
  assert.equal(parsed.edges.length, 4);
  assert.equal(parsed.nodes.get("Writer").group, "review");
  const html = renderMermaid(source, ui);
  assert.equal((html.match(/class="diagram-node"/g) || []).length, 4);
  assert.equal((html.match(/class="diagram-relationship"/g) || []).length, 4);
  assert.match(html, /data-boundary="review"/);
  assert.match(html, /Review boundary/);
  assert.match(html, /data-from="Renderer" data-to="Reader"/);
  assert.match(html, /data-rendered="true"/);
});

test("unsupported statements and incomplete branches preserve source instead of partial SVG", () => {
  for (const source of [
    "sequenceDiagram\nA->>B: request\ncritical work\nB-->>A: response\nend",
    "sequenceDiagram\nalt success\nA->>B: request",
    "sequenceDiagram\nloop retry\nA->>B: request\nelse invalid\nend",
    "flowchart LR\nA --> B\nclick B callUnsafe",
    "stateDiagram-v2\nA --> B\nstate B {\nC --> D\n}",
  ]) {
    assert.ok(parseMermaid(source).error, source);
    const html = renderMermaid(source, ui);
    assert.match(html, /data-rendered="false"/);
    assert.match(html, /Cannot render/);
    assert.doesNotMatch(html, /<svg/);
  }
});

test("cycles, self messages, localized labels, and untrusted text produce finite escaped SVG", () => {
  for (const source of [
    'flowchart LR\nA["요청 검사"] --> B["결과 확인"]\nB --> A',
    "sequenceDiagram\nA->>A: validate <input>\nNote right of A: <script>unsafe</script>",
    'stateDiagram-v2\nstate "검토 중" as Pending\n[*] --> Pending\nPending --> Pending: retry\nPending --> Done\nDone --> [*]',
    "erDiagram\nUSER ||--o{ ORDER : owns",
  ]) {
    const html = renderMermaid(source, ui);
    assert.match(html, /data-rendered="true"/, source);
    assert.doesNotMatch(html, /NaN|Infinity|<script>/);
    assert.match(html, /<details class="diagram-source">/);
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

test("side notes stay on the requested side of the participant", () => {
  for (const side of ["left", "right"]) {
    const html = renderMermaid(
      `sequenceDiagram\nA->>B: request\nNote ${side} of A: explanation`,
      ui,
    );
    const actorX = Number(html.match(/class="sequence__lifeline" x1="([^"]+)"/)?.[1]);
    const note = html.match(/class="sequence__note"><rect x="([^"]+)" y="[^"]+" width="([^"]+)"/);
    assert.ok(note);
    const x = Number(note[1]),
      width = Number(note[2]);
    assert.ok(x >= 0, "the note remains in the view box");
    assert.ok(side === "left" ? x + width < actorX : x > actorX);
  }
});

test("conflicting component boundaries cannot silently move or duplicate a component", () => {
  const diagram = parseMermaid(
    "flowchart LR\nsubgraph First\nA --> B\nend\nsubgraph Second\nA --> C\nend",
  );
  assert.match(diagram.error, /conflicting subgraphs/);
});
