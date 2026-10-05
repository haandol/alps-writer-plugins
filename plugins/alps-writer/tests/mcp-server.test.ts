import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function textContent(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const text = result.content.find((item) => item.type === "text");
  assert.ok(text && text.type === "text", "tool result must contain text");
  return text.text;
}

async function connectServer(context: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-mcp-test-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args:
      process.env.ALPS_TEST_BUNDLE === "1"
        ? [path.join(PACKAGE_ROOT, "dist/index.js")]
        : ["--import", "tsx", path.join(PACKAGE_ROOT, "src/index.ts")],
    cwd: PACKAGE_ROOT,
    env: { ...process.env, ALPS_OUTPUT_DIR: dir } as Record<string, string>,
    stderr: "pipe",
  });
  const client = new Client({ name: "alps-writer-test", version: "1.0.0" });

  context.after(async () => {
    await client.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await client.connect(transport);
  return { client, dir };
}

test("stdio MCP server exposes schemas and enforces document validation", async (context) => {
  const { client, dir } = await connectServer(context);
  const target = path.join(dir, "integration.alps.xml");
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
    "doc_path",
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
      doc_path: target,
      section: 1,
      subsection_id: "1",
      title: "Wrong title",
      content: "must not be saved",
    },
  });
  assert.equal(rejected.isError, true);
  assert.match(textContent(rejected), /Title for 1\.1 must be "Purpose"/);

  const saved = await client.callTool({
    name: "save_alps_section",
    arguments: {
      doc_path: target,
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
    textContent(
      await client.callTool({ name: "read_alps_glossary", arguments: { doc_path: target } }),
    ),
    /No glossary/,
  );
  const glossaryBefore = fs.readFileSync(target, "utf8");
  const blankDefinition = await client.callTool({
    name: "save_alps_glossary_entry",
    arguments: { doc_path: target, term: "PO", definition: " " },
  });
  assert.equal(blankDefinition.isError, true);
  assert.equal(fs.readFileSync(target, "utf8"), glossaryBefore);
  assert.match(
    textContent(
      await client.callTool({
        name: "save_alps_glossary_entry",
        arguments: {
          doc_path: target,
          term: "PO",
          definition: "Issued purchase order, excluding drafts",
        },
      }),
    ),
    /Saved glossary term: PO/,
  );
  assert.match(
    textContent(
      await client.callTool({ name: "export_alps_markdown", arguments: { doc_path: target } }),
    ),
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
      doc_path: liteTarget,
      section: 1,
      subsection_id: "1",
      title: "Target User and Core Problem",
      content: "Lite product",
    },
  });
  assert.match(textContent(liteSaved), /Saved 1\.1/);
  assert.match(fs.readFileSync(liteTarget, "utf8"), /profile="lite"/);
  assert.match(
    textContent(
      await client.callTool({ name: "read_alps_glossary", arguments: { doc_path: liteTarget } }),
    ),
    /No glossary/,
  );
  await client.callTool({
    name: "save_alps_glossary_entry",
    arguments: { doc_path: liteTarget, term: "셀러", definition: "입점 승인된 판매 사업자" },
  });
  assert.match(
    textContent(
      await client.callTool({ name: "read_alps_glossary", arguments: { doc_path: liteTarget } }),
    ),
    /입점 승인된 판매 사업자/,
  );
  assert.doesNotMatch(fs.readFileSync(target, "utf8"), /셀러/);
});

test("MCP document operations require a target and never fall back after invalid selection", async (context) => {
  const { client, dir } = await connectServer(context);
  const target = path.join(dir, "target.alps.xml");
  await client.callTool({
    name: "init_alps_document",
    arguments: { project_name: "Target", output_path: target },
  });
  const before = fs.readFileSync(target, "utf8");
  const operations = [
    {
      name: "save_alps_section",
      arguments: { section: 1, subsection_id: "1", title: "Purpose", content: "must not write" },
    },
    { name: "read_alps_section", arguments: { section: 1 } },
    { name: "save_alps_glossary_entry", arguments: { term: "PO", definition: "must not write" } },
    { name: "read_alps_glossary", arguments: {} },
    { name: "get_alps_document_status", arguments: {} },
    { name: "export_alps_markdown", arguments: { output_path: path.join(dir, "forbidden.md") } },
  ];
  const malformed = path.join(dir, "malformed.alps.xml");
  fs.writeFileSync(malformed, "not a document");
  for (const operation of operations) {
    for (const args of [
      operation.arguments,
      { ...operation.arguments, doc_path: " " },
      { ...operation.arguments, doc_path: path.join(dir, "missing.alps.xml") },
      { ...operation.arguments, doc_path: malformed },
    ]) {
      const result = await client.callTool({ name: operation.name, arguments: args });
      assert.equal(result.isError, true, operation.name);
      assert.equal(fs.readFileSync(target, "utf8"), before);
      assert.equal(fs.readFileSync(malformed, "utf8"), "not a document");
      assert.equal(fs.existsSync(path.join(dir, "forbidden.md")), false);
    }
  }
});

test("MCP preserves significant whitespace in a relative document target", async (context) => {
  const { client, dir } = await connectServer(context);
  const doc_path = " leading.alps.xml";
  await client.callTool({
    name: "init_alps_document",
    arguments: { project_name: "Leading", output_path: doc_path },
  });
  const result = await client.callTool({
    name: "save_alps_section",
    arguments: {
      doc_path,
      section: 1,
      subsection_id: "1",
      title: "Purpose",
      content: "Exact path",
    },
  });
  assert.notEqual(result.isError, true);
  assert.ok(fs.readFileSync(path.join(dir, doc_path), "utf8").includes("Exact path"));
  assert.equal(fs.existsSync(path.join(dir, doc_path.trim())), false);
});

test("MCP interleaved Full and Lite operations use only their explicit targets, including after reconnect", async (context) => {
  const first = await connectServer(context);
  const full = path.join(first.dir, "full.alps.xml");
  const lite = path.join(first.dir, "lite.lite.alps.xml");
  await first.client.callTool({
    name: "init_alps_document",
    arguments: { project_name: "Full", output_path: full },
  });
  await first.client.callTool({
    name: "init_lite_alps_document",
    arguments: { project_name: "Lite", output_path: lite },
  });
  await first.client.callTool({ name: "load_alps_document", arguments: { doc_path: full } });
  await first.client.callTool({ name: "load_alps_document", arguments: { doc_path: lite } });
  const interleaved = await first.client.callTool({
    name: "save_alps_section",
    arguments: {
      doc_path: full,
      section: 1,
      subsection_id: "1",
      title: "Purpose",
      content: "Prepared for Full before loading Lite",
    },
  });
  assert.notEqual(interleaved.isError, true);
  assert.ok(fs.readFileSync(full, "utf8").includes("Prepared for Full before loading Lite"));
  assert.ok(!fs.readFileSync(lite, "utf8").includes("Prepared for Full before loading Lite"));
  // This second server has never loaded either document.
  const { client } = await connectServer(context);
  for (const [doc_path, title, content] of [
    [full, "Purpose", "Full body"],
    [lite, "Target User and Core Problem", "Lite body"],
  ]) {
    const saved = await client.callTool({
      name: "save_alps_section",
      arguments: { doc_path, section: 1, subsection_id: "1", title, content },
    });
    assert.notEqual(saved.isError, true);
    const glossary = await client.callTool({
      name: "save_alps_glossary_entry",
      arguments: { doc_path, term: "Scope", definition: content },
    });
    assert.notEqual(glossary.isError, true);
  }
  const fullBefore = fs.readFileSync(full, "utf8"),
    liteBefore = fs.readFileSync(lite, "utf8");
  const rejected = await client.callTool({
    name: "save_alps_section",
    arguments: {
      doc_path: lite,
      section: 1,
      subsection_id: "1",
      title: "Purpose",
      content: "wrong profile",
    },
  });
  assert.equal(rejected.isError, true);
  for (const [doc_path, expected, forbidden] of [
    [full, "Full body", "Lite body"],
    [lite, "Lite body", "Full body"],
  ]) {
    for (const name of ["read_alps_section", "read_alps_glossary", "export_alps_markdown"]) {
      const result = await client.callTool({
        name,
        arguments: { doc_path, ...(name === "read_alps_section" ? { section: 1 } : {}) },
      });
      assert.notEqual(result.isError, true);
      assert.ok(textContent(result).includes(expected));
      assert.ok(!textContent(result).includes(forbidden));
    }
    const status = textContent(
      await client.callTool({ name: "get_alps_document_status", arguments: { doc_path } }),
    );
    assert.ok(status.includes(doc_path));
    const output_path = path.join(first.dir, expected + ".md");
    await client.callTool({ name: "export_alps_markdown", arguments: { doc_path, output_path } });
    assert.ok(fs.readFileSync(output_path, "utf8").includes(expected));
    assert.ok(!fs.readFileSync(output_path, "utf8").includes(forbidden));
  }
  assert.equal(fs.readFileSync(full, "utf8"), fullBefore);
  assert.equal(fs.readFileSync(lite, "utf8"), liteBefore);
});

test("MCP resume leaves missing required features incomplete and restores completion after the missing feature is saved", async (context) => {
  const { client, dir } = await connectServer(context);
  const doc_path = path.join(dir, "coverage.alps.xml");
  await client.callTool({
    name: "init_alps_document",
    arguments: { project_name: "Coverage", output_path: doc_path },
  });
  const save = (section: number, subsection_id: string, title: string, content: string) =>
    client.callTool({
      name: "save_alps_section",
      arguments: { doc_path, section, subsection_id, title, content },
    });
  await save(6, "1", "Core Features (Functional Requirements)", "- F1: Login\n- F2: Logout");
  await save(7, "1", "Login", "Login behavior; may lead to F2.");
  await save(7, "3", "Export", "Export behavior.");
  const before = fs.readFileSync(doc_path, "utf8");
  const resumed = await client.callTool({ name: "load_alps_document", arguments: { doc_path } });
  assert.match(textContent(resumed), /Section 7 .*In progress \(1\/2 features\).*missing: F2/);
  assert.equal(fs.readFileSync(doc_path, "utf8"), before);
  await save(7, "2", "Logout", "Logout behavior.");
  assert.match(
    textContent(
      await client.callTool({ name: "get_alps_document_status", arguments: { doc_path } }),
    ),
    /Section 7 .*Written \(2\/2 features\)/,
  );
});
