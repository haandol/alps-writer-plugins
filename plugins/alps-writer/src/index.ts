#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FIRST_SECTION, LAST_SECTION, LITE_LAST_SECTION } from "./constants.js";
import { LITE_ALPS_PROFILE } from "./profiles.js";
import { TemplateService } from "./tools/templates/service.js";
import { TemplateController } from "./tools/templates/controller.js";
import { DocumentService } from "./tools/documents/service.js";
import { DocumentController } from "./tools/documents/controller.js";

const server = new McpServer(
  // Keep in lockstep with every manifest version (package.json, the two
  // plugin.json files, marketplace.json). tests/version-consistency.test.ts
  // fails the build when they drift — this literal silently reported 0.4.20
  // to MCP clients for two releases after a manifest-only version bump.
  { name: "alps-writer", version: "0.15.1" },
  {
    instructions: `You are an intelligent product owner helping users create ALPS and Lite ALPS product documents.

ALPS defines each feature as a vertical slice — a single feature that cuts through all layers (UI → API → Data) end-to-end, so it can be developed, tested, and delivered independently. When writing feature specs (Section 7), always describe each user action as a vertical slice tracing from UI to API to data store. Write for a junior developer seeing the Feature for the first time: use plain language, explain unfamiliar acronyms and domain or technical terms on first use, and make the actor, action, conceptual data, and user-visible result clear without requiring code knowledge. When multiple participants or layers make a flow easier to understand visually, recommend a concise Mermaid diagram; prefer \`sequenceDiagram\` for request, data, and response flow across UI, API, data stores, and external systems. The diagram is optional and its absence never blocks approval, saving, or completion. Keep diagrams at product-requirement resolution and out of modules, classes, functions, schemas, libraries, and algorithms. End each Feature's Acceptance Criteria with one Demo checkpoint that states its role in the Section 3 end-to-end demo and its observable completion result; do not duplicate the Feature's flow, errors, or acceptance rules in a separate demo subsection.

Lite ALPS is a four-section, product-level simplification of Full ALPS for a minimum PoC. It uses the same conversational approval pattern as Full ALPS while working backward from the user's desired business impact: explain the current section, ask one focused question when protected context is missing, integrate the user's answer, present an approval digest, and save only after confirmation. Lite reduces the template to Target User and Core Problem, Desired Business Impact, an AI-proposed Solution Strategy with exactly one product-level Mermaid \`C4Context\`, Essential User Experiences, optional Explicit Exclusions, and one AI-proposed Demo Scenario. Essential User Experiences define the user-visible experiences the PoC must not omit and their business-impact contribution; Demo Scenario proposes the concrete starting state, input, actions, and visible results that demonstrate every approved experience. Its document state and lifecycle remain independent from Full ALPS, and Lite support does not alter Full ALPS prompts and guides.

<TRIGGER>
MUST use this server's tools when the user wants to:
- Write, create, or edit a PRD (Product Requirements Document)
- Write a product specification or product spec
- Create an ALPS (Agentic Lean Product Spec) document
- Create a Lite ALPS document for a mockup or PoC
- Draft product requirements, feature specs, or product plans
Keywords: PRD, ALPS, Lite ALPS, 기획서, 기획 문서, 제품 요구사항, 제품 스펙, 프로덕트 스펙, 요구사항 문서, 목업, PoC
</TRIGGER>

<WORKFLOW>
Every operation on an existing document requires doc_path; init requires output_path. Use the source path returned by init/load on every read, save, glossary, status, and export call. There is no active-document fallback; missing or invalid paths fail without selecting another document.
1. Full ALPS: alps_document(action: 'init', profile: 'full', project_name, output_path) or alps_document(action: 'load', doc_path)
   Lite ALPS: alps_document(action: 'init', profile: 'lite', project_name, output_path) or alps_document(action: 'load', doc_path)
2. Full ALPS: alps_template(action: 'overview', profile: 'full')
   Lite ALPS: alps_template(action: 'overview', profile: 'lite')
   The matching overview MUST be called first to get the conversation guide.
3. Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly requests it or supplies a complete structured source covering multiple sections.
   Full ALPS order: 1, 2, 3, 4, 6, 5, 7, 8, 9.
   Lite ALPS order: 1, 2, 3, 4. Section 3 is optional.
   For Full ALPS, author Requirements (6) before Design (5), because Design reuses the Feature IDs defined in Section 6.1.
   For each section:
   a. Call the matching alps_template(action: 'guide', profile: 'full', section: N) or alps_template(action: 'guide', profile: 'lite', section: N)
   b. Call the matching alps_template(action: 'section', profile: 'full', section: N) or alps_template(action: 'section', profile: 'lite', section: N)
   c. Follow conversation guide from overview
   d. Present a concise plain-text approval digest and get explicit user confirmation
   e. alps_section(action: 'save', doc_path, section, subsection_id, title, content) — one call per X.n subsection; Full ALPS Section 7 uses one call per Feature — only AFTER confirmation
   f. Move to the next section only after this one is confirmed
4. In batch mode, keep every section and dynamic Feature as a separately labeled
   approval unit and persist each with its own alps_section(action: 'save', doc_path, section, subsection_id, title, content) call. Never merge,
   skip, or infer a Feature.
5. alps_export(doc_path) for final output
6. After the selected document's required Sections are approved and saved (Full: all nine; Lite: 1, 2, and 4), verify written completion with alps_document(action: 'status', doc_path) and ask once whether the user wants an optional deep-research review of the ALPS items' evidence and errors. Lite's unwritten optional Section 3 does not block this invitation. Reuse an explicit review request or an answered choice in the current conversation. An unanswered invitation, decline, deferral, or research failure never changes document completion. Do not start research without a request. If requested, use the bundled alps-research skill: prefer actual available built-in deep research; otherwise investigate with the agent's web search and source-reading tools. If web search is unavailable or fails, use connected DuckDuckGo MCP and disclose that fallback and its reason. If neither works, report the external evidence gaps and continue accessible source and internal checks. Tie findings to the original items, distinguish factual errors from unsupported hypotheses and chosen goals/policies, verify source passages, and present corrections for existing Section/Feature approval before saving. Research alone never authorizes document changes.
</WORKFLOW>

<RULES>
- Before grouping an existing project, distinguish repository organization (monorepo/multirepo) from execution/deployment shape (monolith/microservices/hybrid), using accessible evidence and marking unknown scope. Group product features by bounded context (business meaning and rule ownership) and vertical user story by default. Never divide Features by frontend/backend/database layers or assume service boundaries are business boundaries. Reuse confirmed grouping; propose grounded candidates and clarify material ambiguity. Preserve Full/Lite sections and their permitted C4 levels.
- In both profiles, require clear meanings for user jargon, uncommon terms/acronyms, or expressions that cannot be written out plainly. Read existing definitions with alps_glossary(action: 'read', doc_path); reuse meanings already supplied by the user. Ask at first use when the meaning is unclear and wait before finalizing dependent content. Never invent the meaning.
- Include new or changed definitions in the current section's approval digest, then save each with alps_glossary(action: 'save', doc_path, term, definition). Do not add a separate approval or interview stage. Check missing definitions before completion. The optional Glossary Appendix appears after all numbered sections only when needed; ordinary-language documents need no glossary. Do not require DDD or domain classification for glossary maintenance, or move requirement rules out of their owning sections.
- MUST call the overview tool matching the selected document profile first
- NEVER proceed without user confirmation
- ALWAYS confirm progress at the SECTION level. Lite Section 3 is optional; when no explicit exclusions were provided and the approved boundary is not materially ambiguous, state that and skip it without a dedicated question.
- Approval digests MUST remain readable as raw text and include every contract-bearing value, rule, permission, state, transition, scope boundary, and success condition. Omit repeated explanation, examples, Markdown decoration, and implementation detail. Do not name omitted implementation details or add an exclusion list for them.
- NEVER save a requirement contract that was absent from the approval digest. Show the full pending content when the user requests it.
- Batch approval requires explicit opt-in or a complete structured source; each section and Feature remains a separate save unit.
- For Section 7, each Feature 7.x is one approval and save unit. Its 7.x.1-7.x.6 fields stay together.
- If a Section 7 Feature's comprehension load is 8/10 or higher, suggest up to three independently demonstrable user-behavior splits before approval. The suggestion never blocks approval or saving, and the user may keep the original Feature.
- Section 7 must be understandable to a junior developer seeing the Feature for the first time. Explain unfamiliar terms on first use. Recommend Mermaid when it materially clarifies a multi-participant or multi-layer flow, prefer \`sequenceDiagram\` for data flow, and never make a diagram an approval, save, or completion requirement.
- Lite ALPS has four fixed Sections: Overview, Solution and Essential User Experiences, optional Out of Scope, and Demo Scenario.
- Lite ALPS follows Full ALPS's conversation pattern: when context is missing, ask one focused question at a time, or at most two closely related questions, and integrate the user's answer before approval.
- Section 1 has only Target User and Core Problem and Desired Business Impact. Do not ask for a solution, screen, starting state, user-action sequence, or demo procedure there. Section 2 has only Solution Strategy and Essential User Experiences. Section 3 has one optional Explicit Exclusions list. Section 4 has one 4.1 Demo Scenario.
- Work backward from the approved Desired Business Impact and propose Section 2 instead of asking the user to design the minimum solution or demo flow. End the text Solution Strategy with exactly one Mermaid \`C4Context\` Product Context Diagram generated from the approved Overview and complete Section 2 draft. Show the target user, PoC system, relevant external systems, and their relationships at product-role level. The text remains independently reviewable. Never generate \`C4Container\`, lower C4 levels, APIs, databases, deployment units, technology stacks, libraries, code structure, or implementation layers. Every Essential User Experience has a distinct name, user-observable result, and contribution to the Desired Business Impact. Starting states and sequential user actions belong to Section 4. Do not use implementation functions, internal state, technical layers, or subjective impressions as completion results.
- Section 4 proposes the shortest Demo Scenario that demonstrates every approved Essential User Experience. Propose the concrete starting state, representative input, sequential user actions, and visible results instead of asking the user to supply them. Show the complete scenario, experience coverage, and business-impact connection before approval. Every step or execution block names the experience it demonstrates, and the overall result passes only when every experience is observable.
- Ask only when a choice would change money, permissions, law or regulation, privacy or safety, irreversible data meaning, an external promise, or the acceptance boundary. If experiences cannot be connected without such an unapproved product contract, keep separate execution blocks inside the same Demo Scenario. Do not add a separate Learning Check or present a passing demo as proof of actual business impact or market validity.
- Do not add architecture questions or content beyond the required product-level \`C4Context\`. Do not add NFR, implementation-detail, or ADR-handoff questions to Lite ALPS.
- Do not invent exclusions or require optional Section 3.
- Lite and Full keep independent document state and completion; Lite is not a transition into Full.
</RULES>`,
  },
);

const tc = new TemplateController(new TemplateService());
const liteTc = new TemplateController(new TemplateService(LITE_ALPS_PROFILE));
const dc = new DocumentController(new DocumentService());
// A relative path is resolved inside the document directory, not the working
// directory, so "prd/x.alps.xml" would land in prd/prd/. Say so where paths are given.
const PATH_BASE =
  "An absolute or ~ path is used as given. A relative path is resolved inside the document directory (ALPS_OUTPUT_DIR, default <cwd>/prd/), so give a bare file name or an absolute path, not a path that starts with that directory.";

const documentPath = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "Document path must not be blank")
  .describe(
    "Required source document path. Always pass the path returned by init/load; another call never selects it for this request.",
  );

/** Required fields are also allowed; callers name only the additional optional fields. */
function actionFields(
  input: Record<string, unknown>,
  context: z.RefinementCtx,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const allowed = new Set(["action", ...required, ...optional]);
  for (const key of required) {
    if (input[key] === undefined)
      context.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is required for ${input.action}`,
      });
  }
  for (const key of Object.keys(input)) {
    if (input[key] !== undefined && !allowed.has(key))
      context.addIssue({
        code: "custom",
        path: [key],
        message: `${key} does not apply to ${input.action}`,
      });
  }
}

const profile = z.enum(["full", "lite"]);
const sectionNumber = z.number().int().min(FIRST_SECTION).max(LAST_SECTION);
const response = (text: string) => ({ content: [{ type: "text" as const, text }] });

server.registerTool(
  "alps_template",
  {
    description:
      "Read Full/Lite authoring material: overview, sections (list), section, full (all sections), or guide. Read overview after init/load and the section guide before drafting. section/guide require section; include_examples applies only to section/full and defaults to false.",
    inputSchema: z
      .strictObject({
        action: z.enum(["overview", "sections", "section", "full", "guide"]),
        profile,
        section: sectionNumber.optional(),
        include_examples: z.boolean().optional(),
      })
      .superRefine((input, ctx) => {
        const required = [
          "profile",
          ...(["section", "guide"].includes(input.action) ? ["section"] : []),
        ];
        actionFields(
          input,
          ctx,
          required,
          ["section", "full"].includes(input.action) ? ["include_examples"] : [],
        );
        if (
          input.profile === "lite" &&
          input.section !== undefined &&
          input.section > LITE_LAST_SECTION
        )
          ctx.addIssue({
            code: "custom",
            path: ["section"],
            message: `Lite sections end at ${LITE_LAST_SECTION}`,
          });
      }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  ({ action, profile, section, include_examples }) => {
    const controller = profile === "lite" ? liteTc : tc;
    switch (action) {
      case "overview":
        return response(controller.getAlpsOverview());
      case "sections":
        return response(JSON.stringify(controller.listAlpsSections()));
      case "section":
        return response(controller.getAlpsSection(section!, include_examples ?? false));
      case "full":
        return response(controller.getAlpsFullTemplate(include_examples ?? false));
      case "guide":
        return response(controller.getAlpsSectionGuide(section!));
    }
  },
);

server.registerTool(
  "alps_document",
  {
    description:
      "Manage a document: init requires profile, project_name and output_path; load/status require doc_path and detect the profile from the source. After loading, follow that profile's overview and guide; obtain section approval before saving.",
    inputSchema: z
      .strictObject({
        action: z.enum(["init", "load", "status"]),
        profile: profile.optional(),
        project_name: z.string().min(1).optional(),
        output_path: z.string().min(1).describe(PATH_BASE).optional(),
        doc_path: documentPath.optional(),
      })
      .superRefine((input, ctx) =>
        actionFields(
          input,
          ctx,
          input.action === "init" ? ["profile", "project_name", "output_path"] : ["doc_path"],
        ),
      ),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  ({ action, profile, project_name, output_path, doc_path }) => {
    switch (action) {
      case "init":
        return response(
          profile === "lite"
            ? dc.initLiteAlpsDocument(project_name!, output_path!)
            : dc.initAlpsDocument(project_name!, output_path!),
        );
      case "load":
        return response(dc.loadAlpsDocument(doc_path!));
      case "status":
        return response(dc.getAlpsDocumentStatus(doc_path!));
    }
  },
);

server.registerTool(
  "alps_section",
  {
    description:
      "Read or save one section/subsection of doc_path. read optionally takes subsection_id. save requires subsection_id, title and content; present a contract-complete plain-text approval digest and obtain explicit user confirmation first. Fixed titles match the template; each Full Section 7 Feature is one save unit.",
    inputSchema: z
      .strictObject({
        action: z.enum(["read", "save"]),
        doc_path: documentPath,
        section: sectionNumber,
        subsection_id: z
          .string()
          .min(1)
          .describe(
            'Part after the section number: "1" stores N.1; Full Section 7 uses the positive Feature number.',
          )
          .optional(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      })
      .superRefine((input, ctx) =>
        actionFields(
          input,
          ctx,
          input.action === "save"
            ? ["doc_path", "section", "subsection_id", "title", "content"]
            : ["doc_path", "section"],
          input.action === "read" ? ["subsection_id"] : [],
        ),
      ),
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  ({ action, doc_path, section, subsection_id, title, content }) =>
    response(
      action === "read"
        ? dc.readAlpsSection(doc_path, section, subsection_id)
        : dc.saveAlpsSection(doc_path, section, subsection_id!, title!, content!),
    ),
);

server.registerTool(
  "alps_glossary",
  {
    description:
      "Read definitions or save one confirmed term in doc_path's optional trailing Glossary Appendix. save requires term/definition approved with the current section; reuse supplied meanings and resolve conflicts first. Reading creates nothing.",
    inputSchema: z
      .strictObject({
        action: z.enum(["read", "save"]),
        doc_path: documentPath,
        term: z.string().trim().min(1).optional(),
        definition: z.string().trim().min(1).optional(),
      })
      .superRefine((input, ctx) =>
        actionFields(
          input,
          ctx,
          input.action === "save" ? ["doc_path", "term", "definition"] : ["doc_path"],
        ),
      ),
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  ({ action, doc_path, term, definition }) =>
    response(
      action === "read"
        ? dc.readAlpsGlossary(doc_path)
        : dc.saveAlpsGlossaryEntry(doc_path, term!, definition!),
    ),
);

server.registerTool(
  "alps_export",
  {
    description:
      "Return doc_path as Markdown, or write it to output_path. The source document is preserved; an output path aliasing it is rejected.",
    inputSchema: z.strictObject({
      doc_path: documentPath,
      output_path: z.string().min(1).describe(PATH_BASE).optional(),
    }),
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  ({ doc_path, output_path }) => response(dc.exportAlpsMarkdown(doc_path, output_path)),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
