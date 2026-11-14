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
        : [path.join(PACKAGE_ROOT, "src/index.ts")],
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

test("MCP template examples are opt-in, reachable from the Full guide, and independent of Lite", async (context) => {
  const { client } = await connectServer(context);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, name);
    return textContent(result);
  };
  const workedFeature = "Template-based AI Document Writing";
  const guide = await call("alps_template", { action: "guide", profile: "full", section: 7 });
  assert.match(
    guide,
    /alps_template\(action: 'section', profile: 'full', section: 7, include_examples: true\)/,
  );
  assert.ok(!guide.includes(workedFeature));
  assert.match(
    guide,
    /alps_section\(action: 'read', doc_path, section: 3\), alps_section\(action: 'read', doc_path, section: 6\)/,
  );
  const full = await call("alps_template", { action: "section", profile: "full", section: 7 });
  const lite = await call("alps_template", { action: "section", profile: "lite", section: 4 });
  assert.ok(!full.includes(workedFeature));
  assert.match(full, /7\.x\.6 Evaluation Rubric/);
  assert.match(lite, /4\.1 Demo Scenario/);
  assert.doesNotMatch(lite, /Introduce myself on an overseas business trip/);
  assert.equal(
    await call("alps_template", {
      action: "section",
      profile: "full",
      section: 7,
      include_examples: false,
    }),
    full,
  );
  assert.equal(
    await call("alps_template", {
      action: "section",
      profile: "lite",
      section: 4,
      include_examples: false,
    }),
    lite,
  );

  // Interleave profiles so opting into one cannot change the other's next default response.
  const examples = await call("alps_template", {
    action: "section",
    profile: "full",
    section: 7,
    include_examples: true,
  });
  assert.ok(examples.includes(workedFeature));
  assert.match(examples, /Account creation.*unregistered valid email/);
  assert.match(examples, /Confirmed save.*persisted exactly once/);
  assert.match(examples, /```mermaid\nsequenceDiagram[\s\S]*UI-->>User: Show the question\n```/);
  assert.match(examples, /Draft retention.*retain before 30 days and discard at expiry/);
  assert.match(examples, /9-section limit and 30-day retention/);
  assert.match(
    examples,
    /Demo outcome:.*approved section appears and the next incomplete section becomes active/,
  );
  assert.equal(
    await call("alps_template", { action: "section", profile: "lite", section: 4 }),
    lite,
  );
  const liteExamples = await call("alps_template", {
    action: "section",
    profile: "lite",
    section: 4,
    include_examples: true,
  });
  assert.match(liteExamples, /Introduce myself on an overseas business trip/);
  assert.ok(!liteExamples.includes(workedFeature));
  assert.doesNotMatch(liteExamples, /7\.x|9-section limit|30-day retention/);
  assert.equal(
    await call("alps_template", { action: "section", profile: "full", section: 7 }),
    full,
  );
  assert.equal(
    await call("alps_template", { action: "section", profile: "lite", section: 4 }),
    lite,
  );
  assert.equal(
    await call("alps_template", { action: "guide", profile: "full", section: 7 }),
    guide,
  );

  for (const profile of ["full", "lite"]) {
    const defaultTemplate = await call("alps_template", { action: "full", profile });
    assert.equal(
      await call("alps_template", { action: "full", profile, include_examples: false }),
      defaultTemplate,
    );
    assert.doesNotMatch(defaultTemplate, /\*\*Example:\*\*/);
    assert.ok(!defaultTemplate.includes(workedFeature));
    const withExamples = await call("alps_template", {
      action: "full",
      profile,
      include_examples: true,
    });
    assert.ok(withExamples.includes(workedFeature) === (profile === "full"));
    assert.match(withExamples, /\*\*Example:\*\*/);
    assert.equal(await call("alps_template", { action: "full", profile }), defaultTemplate);
  }
  const liteGuide = await call("alps_template", { action: "guide", profile: "lite", section: 4 });
  assert.match(
    liteGuide,
    /alps_section\(action: 'read', doc_path, section: 1\), alps_section\(action: 'read', doc_path, section: 2\)/,
  );
  assert.doesNotMatch(
    liteGuide,
    /alps_template\(action: 'section', profile: 'full', section: 7|Template-based AI Document Writing/,
  );
  const invalidLite = await client.callTool({
    name: "alps_template",
    arguments: { action: "section", profile: "lite", section: 7, include_examples: true },
  });
  assert.equal(invalidLite.isError, true);
});

test("stdio MCP server exposes schemas and enforces document validation", async (context) => {
  const { client, dir } = await connectServer(context);
  const target = path.join(dir, "integration.alps.xml");
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "alps_document",
    "alps_export",
    "alps_glossary",
    "alps_section",
    "alps_template",
  ]);
  // The 19-tool baseline serialized to 10,833 UTF-8 bytes with the same SDK.
  assert.ok(Buffer.byteLength(JSON.stringify(listed.tools)) < 10833);
  const saveTool = listed.tools.find((tool) => tool.name === "alps_section");
  assert.deepEqual(saveTool?.inputSchema.required?.sort(), ["action", "doc_path", "section"]);
  assert.equal(
    listed.tools.find((tool) => tool.name === "alps_template")?.annotations?.readOnlyHint,
    true,
  );
  for (const tool of listed.tools.filter((tool) => tool.name !== "alps_template"))
    assert.equal(tool.annotations?.readOnlyHint, false);

  const initialized = await client.callTool({
    name: "alps_document",
    arguments: {
      action: "init",
      profile: "full",
      project_name: "integration",
      output_path: target,
    },
  });
  assert.match(textContent(initialized), /Created ALPS document/);

  const rejected = await client.callTool({
    name: "alps_section",
    arguments: {
      action: "save",
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
    name: "alps_section",
    arguments: {
      action: "save",
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
      await client.callTool({
        name: "alps_glossary",
        arguments: { action: "read", doc_path: target },
      }),
    ),
    /No glossary/,
  );
  const glossaryBefore = fs.readFileSync(target, "utf8");
  const blankDefinition = await client.callTool({
    name: "alps_glossary",
    arguments: { action: "save", doc_path: target, term: "PO", definition: " " },
  });
  assert.equal(blankDefinition.isError, true);
  assert.equal(fs.readFileSync(target, "utf8"), glossaryBefore);
  assert.match(
    textContent(
      await client.callTool({
        name: "alps_glossary",
        arguments: {
          action: "save",
          doc_path: target,
          term: "PO",
          definition: "Issued purchase order, excluding drafts",
        },
      }),
    ),
    /Saved glossary term: PO/,
  );
  assert.match(
    textContent(await client.callTool({ name: "alps_export", arguments: { doc_path: target } })),
    /Appendix: Glossary[\s\S]*Issued purchase order/,
  );

  const liteTarget = path.join(dir, "integration.lite.alps.xml");
  const liteInitialized = await client.callTool({
    name: "alps_document",
    arguments: {
      action: "init",
      profile: "lite",
      project_name: "lite integration",
      output_path: liteTarget,
    },
  });
  assert.match(textContent(liteInitialized), /Created Lite ALPS document/);

  const liteSaved = await client.callTool({
    name: "alps_section",
    arguments: {
      action: "save",
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
      await client.callTool({
        name: "alps_glossary",
        arguments: { action: "read", doc_path: liteTarget },
      }),
    ),
    /No glossary/,
  );
  await client.callTool({
    name: "alps_glossary",
    arguments: {
      action: "save",
      doc_path: liteTarget,
      term: "셀러",
      definition: "입점 승인된 판매 사업자",
    },
  });
  assert.match(
    textContent(
      await client.callTool({
        name: "alps_glossary",
        arguments: { action: "read", doc_path: liteTarget },
      }),
    ),
    /입점 승인된 판매 사업자/,
  );
  assert.doesNotMatch(fs.readFileSync(target, "utf8"), /셀러/);
});

test("MCP document operations require a target and never fall back after invalid selection", async (context) => {
  const { client, dir } = await connectServer(context);
  const target = path.join(dir, "target.alps.xml");
  await client.callTool({
    name: "alps_document",
    arguments: { action: "init", profile: "full", project_name: "Target", output_path: target },
  });
  const before = fs.readFileSync(target, "utf8");
  const operations = [
    {
      name: "alps_section",
      arguments: {
        action: "save",
        section: 1,
        subsection_id: "1",
        title: "Purpose",
        content: "must not write",
      },
    },
    { name: "alps_section", arguments: { action: "read", section: 1 } },
    {
      name: "alps_glossary",
      arguments: { action: "save", term: "PO", definition: "must not write" },
    },
    { name: "alps_glossary", arguments: { action: "read" } },
    { name: "alps_document", arguments: { action: "status" } },
    { name: "alps_export", arguments: { output_path: path.join(dir, "forbidden.md") } },
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
    name: "alps_document",
    arguments: { action: "init", profile: "full", project_name: "Leading", output_path: doc_path },
  });
  const result = await client.callTool({
    name: "alps_section",
    arguments: {
      action: "save",
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
    name: "alps_document",
    arguments: { action: "init", profile: "full", project_name: "Full", output_path: full },
  });
  await first.client.callTool({
    name: "alps_document",
    arguments: { action: "init", profile: "lite", project_name: "Lite", output_path: lite },
  });
  await first.client.callTool({
    name: "alps_document",
    arguments: { action: "load", doc_path: full },
  });
  await first.client.callTool({
    name: "alps_document",
    arguments: { action: "load", doc_path: lite },
  });
  const interleaved = await first.client.callTool({
    name: "alps_section",
    arguments: {
      action: "save",
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
      name: "alps_section",
      arguments: { action: "save", doc_path, section: 1, subsection_id: "1", title, content },
    });
    assert.notEqual(saved.isError, true);
    const glossary = await client.callTool({
      name: "alps_glossary",
      arguments: { action: "save", doc_path, term: "Scope", definition: content },
    });
    assert.notEqual(glossary.isError, true);
  }
  const fullBefore = fs.readFileSync(full, "utf8"),
    liteBefore = fs.readFileSync(lite, "utf8");
  const rejected = await client.callTool({
    name: "alps_section",
    arguments: {
      action: "save",
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
    for (const name of ["alps_section", "alps_glossary", "alps_export"]) {
      const result = await client.callTool({
        name,
        arguments: {
          doc_path,
          ...(name === "alps_export" ? {} : { action: "read" }),
          ...(name === "alps_section" ? { section: 1 } : {}),
        },
      });
      assert.notEqual(result.isError, true);
      assert.ok(textContent(result).includes(expected));
      assert.ok(!textContent(result).includes(forbidden));
    }
    const status = textContent(
      await client.callTool({ name: "alps_document", arguments: { action: "status", doc_path } }),
    );
    assert.ok(status.includes(doc_path));
    const output_path = path.join(first.dir, expected + ".md");
    await client.callTool({ name: "alps_export", arguments: { doc_path, output_path } });
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
    name: "alps_document",
    arguments: { action: "init", profile: "full", project_name: "Coverage", output_path: doc_path },
  });
  const save = (section: number, subsection_id: string, title: string, content: string) =>
    client.callTool({
      name: "alps_section",
      arguments: { action: "save", doc_path, section, subsection_id, title, content },
    });
  await save(6, "1", "Core Features (Functional Requirements)", "- F1: Login\n- F2: Logout");
  await save(7, "1", "Login", "Login behavior; may lead to F2.");
  await save(7, "3", "Export", "Export behavior.");
  const before = fs.readFileSync(doc_path, "utf8");
  const resumed = await client.callTool({
    name: "alps_document",
    arguments: { action: "load", doc_path },
  });
  assert.match(textContent(resumed), /Section 7 .*In progress \(1\/2 features\).*missing: F2/);
  assert.equal(fs.readFileSync(doc_path, "utf8"), before);
  await save(7, "2", "Logout", "Logout behavior.");
  assert.match(
    textContent(
      await client.callTool({ name: "alps_document", arguments: { action: "status", doc_path } }),
    ),
    /Section 7 .*Written \(2\/2 features\)/,
  );
});

test("MCP path inputs say that a relative path is resolved inside the document directory", async (context) => {
  const { client, dir } = await connectServer(context);
  const { tools } = await client.listTools();
  for (const [tool, field] of [
    ["alps_document", "output_path"],
    ["alps_export", "output_path"],
  ]) {
    const schema = tools.find((t) => t.name === tool)?.inputSchema as
      | { properties?: Record<string, { description?: string }> }
      | undefined;
    assert.match(schema?.properties?.[field]?.description ?? "", /ALPS_OUTPUT_DIR/, tool);
  }
  await client.callTool({
    name: "alps_document",
    arguments: {
      action: "init",
      profile: "lite",
      project_name: "Relative",
      output_path: "relative.lite.alps.xml",
    },
  });
  assert.ok(fs.existsSync(path.join(dir, "relative.lite.alps.xml")));
});

test("MCP Markdown export preserves the source when an output path aliases it", async (context) => {
  const { client, dir } = await connectServer(context);
  for (const lite of [false, true]) {
    const filename = lite ? "export.lite.alps.xml" : "export.alps.xml";
    const doc_path = path.join(dir, filename);
    const created = await client.callTool({
      name: "alps_document",
      arguments: {
        action: "init",
        profile: lite ? "lite" : "full",
        project_name: "Export safety",
        output_path: doc_path,
      },
    });
    assert.notEqual(created.isError, true);
    const original = fs.readFileSync(doc_path, "utf8");
    const alias = path.join(dir, `${filename}.link`);
    fs.symlinkSync(doc_path, alias);
    for (const output_path of [doc_path, `./${filename}`, alias]) {
      const rejected = await client.callTool({
        name: "alps_export",
        arguments: { doc_path, output_path },
      });
      assert.equal(rejected.isError, true, output_path);
      assert.match(textContent(rejected), /must not replace the source/);
      assert.equal(fs.readFileSync(doc_path, "utf8"), original);
      assert.ok(fs.lstatSync(alias).isSymbolicLink());
    }
    const output_path = path.join(dir, "markdown", `${filename}.md`);
    const exported = await client.callTool({
      name: "alps_export",
      arguments: { doc_path, output_path },
    });
    assert.notEqual(exported.isError, true);
    assert.match(fs.readFileSync(output_path, "utf8"), /^# Export safety/);
    assert.equal(fs.readFileSync(doc_path, "utf8"), original);
    const loaded = await client.callTool({
      name: "alps_document",
      arguments: { action: "load", doc_path },
    });
    assert.notEqual(loaded.isError, true);
  }
});

test("grouped MCP actions reject missing, unrelated and unknown inputs without writing", async (context) => {
  const { client, dir } = await connectServer(context);
  const doc_path = path.join(dir, "validation.alps.xml");
  await client.callTool({
    name: "alps_document",
    arguments: {
      action: "init",
      profile: "full",
      project_name: "Validation",
      output_path: doc_path,
    },
  });
  const original = fs.readFileSync(doc_path, "utf8");
  const cases = [
    { name: "alps_template", arguments: { action: "overview" } },
    { name: "alps_template", arguments: { action: "unknown", profile: "full" } },
    { name: "alps_template", arguments: { action: "section", profile: "full" } },
    {
      name: "alps_template",
      arguments: { action: "guide", profile: "full", section: 1, include_examples: true },
    },
    { name: "alps_template", arguments: { action: "section", profile: "lite", section: 5 } },
    {
      name: "alps_document",
      arguments: {
        action: "init",
        project_name: "Missing profile",
        output_path: path.join(dir, "forbidden.alps.xml"),
      },
    },
    { name: "alps_document", arguments: { action: "load", doc_path, profile: "lite" } },
    { name: "alps_document", arguments: { doc_path } },
    {
      name: "alps_section",
      arguments: { action: "save", doc_path, section: 1, subsection_id: "1", title: "Purpose" },
    },
    {
      name: "alps_section",
      arguments: { action: "read", doc_path, section: 1, content: "must not write" },
    },
    { name: "alps_glossary", arguments: { action: "save", doc_path, term: "PO" } },
    { name: "alps_glossary", arguments: { action: "read", doc_path, term: "unused" } },
    { name: "alps_export", arguments: { doc_path, typo_path: "unused.md" } },
  ];
  for (const request of cases) {
    const result = await client.callTool(request);
    assert.equal(result.isError, true, JSON.stringify(request));
    assert.equal(fs.readFileSync(doc_path, "utf8"), original);
  }
  assert.equal(fs.existsSync(path.join(dir, "forbidden.alps.xml")), false);
  const removed = await client.callTool({ name: "save_alps_section", arguments: {} });
  assert.equal(removed.isError, true, "a removed name must not survive as an extra public alias");

  for (const profile of ["full", "lite"]) {
    for (const action of ["overview", "sections"]) {
      const result = await client.callTool({
        name: "alps_template",
        arguments: { profile, action },
      });
      assert.notEqual(result.isError, true);
      if (action === "sections")
        assert.equal(JSON.parse(textContent(result)).length, profile === "full" ? 9 : 4);
      else assert.match(textContent(result), /alps_template/);
    }
  }
});
