import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, "../..");

function textContent(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const text = result.content.find((item) => item.type === "text");
  assert.ok(text && text.type === "text", "tool result must contain text");
  return text.text;
}

test("stdio MCP server exposes schemas and enforces document validation", async (context) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-mcp-test-"));
  const target = path.join(dir, "integration.alps.xml");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.join(PACKAGE_ROOT, "src/index.ts")],
    cwd: PACKAGE_ROOT,
    stderr: "pipe",
  });
  const client = new Client({ name: "alps-writer-test", version: "1.0.0" });

  context.after(async () => {
    await client.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "export_alps_markdown",
    "get_alps_document_status",
    "get_alps_overview",
    "get_alps_section_context",
    "get_lite_alps_overview",
    "get_lite_alps_section_context",
    "init_alps_document",
    "init_lite_alps_document",
    "load_alps_document",
    "read_alps_section",
    "save_alps_section",
  ]);

  const sectionContextTool = listed.tools.find((tool) => tool.name === "get_alps_section_context");
  assert.deepEqual(sectionContextTool?.inputSchema.required, ["section"]);

  const sectionContext = await client.callTool({
    name: "get_alps_section_context",
    arguments: { section: 1, include_examples: false },
  });
  const sectionContextText = textContent(sectionContext);
  assert.ok(
    sectionContextText.indexOf("<section_guide") < sectionContextText.indexOf("## 1 Overview"),
    "the conversation guide must precede the template",
  );
  assert.doesNotMatch(sectionContextText, /\*\*Example:\*\*/);

  const sectionContextWithExamples = await client.callTool({
    name: "get_alps_section_context",
    arguments: { section: 1, include_examples: true },
  });
  assert.match(textContent(sectionContextWithExamples), /\*\*Example:\*\*/);

  const liteSectionContext = await client.callTool({
    name: "get_lite_alps_section_context",
    arguments: { section: 1 },
  });
  const liteSectionContextText = textContent(liteSectionContext);
  assert.ok(
    liteSectionContextText.indexOf("<section_guide") <
      liteSectionContextText.indexOf("## 1 Overview"),
    "the Lite conversation guide must precede the template",
  );

  const saveTool = listed.tools.find((tool) => tool.name === "save_alps_section");
  assert.deepEqual(saveTool?.inputSchema.required?.sort(), [
    "content",
    "section",
    "subsection_id",
    "title",
  ]);

  const initialized = await client.callTool({
    name: "init_alps_document",
    arguments: { project_name: "integration", output_path: target },
  });
  assert.match(textContent(initialized), /Created ALPS document/);

  const beforeInvalidContext = fs.readFileSync(target, "utf8");
  for (const [name, section] of [
    ["get_alps_section_context", 0],
    ["get_alps_section_context", 1.5],
    ["get_alps_section_context", 10],
    ["get_lite_alps_section_context", 0],
    ["get_lite_alps_section_context", 1.5],
    ["get_lite_alps_section_context", 5],
  ] as const) {
    const invalidContext = await client.callTool({
      name,
      arguments: { section },
    });
    assert.equal(invalidContext.isError, true, `${name} must reject section ${section}`);
  }
  assert.equal(fs.readFileSync(target, "utf8"), beforeInvalidContext);

  const rejected = await client.callTool({
    name: "save_alps_section",
    arguments: {
      section: 1,
      subsection_id: "1",
      title: "Wrong title",
      content: "must not be saved",
    },
  });
  assert.match(textContent(rejected), /Title for 1\.1 must be "Purpose"/);

  const saved = await client.callTool({
    name: "save_alps_section",
    arguments: {
      section: 1,
      subsection_id: "1",
      title: "Purpose",
      content: "saved through MCP",
    },
  });
  assert.match(textContent(saved), /Saved 1\.1/);
  assert.doesNotMatch(textContent(saved), /saved through MCP/);
  assert.match(fs.readFileSync(target, "utf8"), /saved through MCP/);

  const liteTarget = path.join(dir, "integration.lite.alps.xml");
  const liteInitialized = await client.callTool({
    name: "init_lite_alps_document",
    arguments: { project_name: "lite integration", output_path: liteTarget },
  });
  assert.match(textContent(liteInitialized), /Created Lite ALPS document/);

  const liteSaved = await client.callTool({
    name: "save_alps_section",
    arguments: {
      section: 1,
      subsection_id: "1",
      title: "Target User and Core Problem",
      content: "Lite product",
    },
  });
  assert.match(textContent(liteSaved), /Saved 1\.1/);
  assert.match(fs.readFileSync(liteTarget, "utf8"), /profile="lite"/);
});

test("shipping instructions and docs contain only the public Section context tool names", () => {
  const shippingFiles = [
    path.join(PACKAGE_ROOT, "src/index.ts"),
    path.join(PACKAGE_ROOT, "skills/alps-init/SKILL.md"),
    path.join(PACKAGE_ROOT, "skills/lite-alps-init/SKILL.md"),
    path.join(PACKAGE_ROOT, "src/templates/overview.md"),
    path.join(PACKAGE_ROOT, "src/templates/lite/overview.md"),
    path.join(PACKAGE_ROOT, "dist/index.js"),
    path.join(PACKAGE_ROOT, "dist/templates/overview.md"),
    path.join(PACKAGE_ROOT, "dist/templates/lite/overview.md"),
    path.join(REPOSITORY_ROOT, "docs/mcp-server.md"),
    path.join(REPOSITORY_ROOT, "docs/adr-process.md"),
  ];
  const shippingText = shippingFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const removedToolNames = [
    "list_alps_sections",
    "list_lite_alps_sections",
    "get_alps_full_template",
    "get_lite_alps_full_template",
    "get_alps_section",
    "get_lite_alps_section",
    "get_alps_section_guide",
    "get_lite_alps_section_guide",
  ];

  for (const toolName of removedToolNames) {
    assert.doesNotMatch(shippingText, new RegExp(`\\b${toolName}\\b`), toolName);
  }
  assert.match(shippingText, /\bget_alps_section_context\b/);
  assert.match(shippingText, /\bget_lite_alps_section_context\b/);
});
