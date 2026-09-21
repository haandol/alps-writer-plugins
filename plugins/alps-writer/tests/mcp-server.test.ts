import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    "get_alps_full_template",
    "get_alps_overview",
    "get_alps_section",
    "get_alps_section_guide",
    "get_lite_alps_full_template",
    "get_lite_alps_overview",
    "get_lite_alps_section",
    "get_lite_alps_section_guide",
    "init_alps_document",
    "init_lite_alps_document",
    "list_alps_sections",
    "list_lite_alps_sections",
    "load_alps_document",
    "read_alps_glossary",
    "read_alps_section",
    "save_alps_glossary_entry",
    "save_alps_section",
  ]);

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

  assert.match(
    textContent(await client.callTool({ name: "read_alps_glossary", arguments: {} })),
    /No glossary/,
  );
  const glossaryBefore = fs.readFileSync(target, "utf8");
  const blankDefinition = await client.callTool({
    name: "save_alps_glossary_entry",
    arguments: { term: "PO", definition: " " },
  });
  assert.equal(blankDefinition.isError, true);
  assert.equal(fs.readFileSync(target, "utf8"), glossaryBefore);
  assert.match(
    textContent(
      await client.callTool({
        name: "save_alps_glossary_entry",
        arguments: { term: "PO", definition: "Issued purchase order, excluding drafts" },
      }),
    ),
    /Saved glossary term: PO/,
  );
  assert.match(
    textContent(await client.callTool({ name: "export_alps_markdown", arguments: {} })),
    /Appendix: Glossary[\s\S]*Issued purchase order/,
  );

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
  assert.match(
    textContent(await client.callTool({ name: "read_alps_glossary", arguments: {} })),
    /No glossary/,
  );
  await client.callTool({
    name: "save_alps_glossary_entry",
    arguments: { term: "셀러", definition: "입점 승인된 판매 사업자" },
  });
  assert.match(
    textContent(await client.callTool({ name: "read_alps_glossary", arguments: {} })),
    /입점 승인된 판매 사업자/,
  );
  assert.doesNotMatch(fs.readFileSync(target, "utf8"), /셀러/);
});
