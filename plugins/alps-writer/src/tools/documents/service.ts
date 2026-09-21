import fs from "fs";
import os from "os";
import path from "path";
import { NOT_STARTED } from "../../constants.js";
import {
  ALPS_PROFILE,
  DOCUMENT_PROFILES,
  LITE_ALPS_PROFILE,
  type DocumentProfile,
  type DocumentProfileId,
  type InitializableDocumentProfileId,
  isLiteProfile,
  sectionNumbers,
  sectionRange,
} from "../../profiles.js";
import { attribute, decodeXml, escapeXmlAttribute, escapeXmlText } from "../../xml.js";
import { TemplateRegistry } from "../templates/registry.js";
import {
  buildGlossary,
  glossaryKey,
  glossaryMarkdown,
  parseGlossary,
  type GlossaryEntry,
} from "./glossary.js";

// Subsection IDs sort by their numeric components ("7.10" after "7.9"), not
// lexically. Used wherever subsections are rendered in order.
const bySubsectionId = ([a]: [string, unknown], [b]: [string, unknown]) =>
  a.localeCompare(b, undefined, { numeric: true });

const ALLOWED_ARCHITECTURE_DIAGRAMS = new Set(["C4Context", "C4Container"]);

function mermaidDiagramTypes(content: string): string[] {
  return [...content.matchAll(/```mermaid\s*\r?\n([\s\S]*?)```/g)]
    .map(
      (match) =>
        match[1]
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("%%"))
          ?.split(/\s+/)[0],
    )
    .filter((type): type is string => Boolean(type));
}

function architectureDiagramError(content: string): string | null {
  const diagramTypes = mermaidDiagramTypes(content);

  for (const required of ALLOWED_ARCHITECTURE_DIAGRAMS) {
    if (!diagramTypes.includes(required)) {
      return `Section 4.1 requires a Mermaid ${required} diagram.`;
    }
  }

  const disallowed = diagramTypes.find((type) => !ALLOWED_ARCHITECTURE_DIAGRAMS.has(type));
  if (disallowed) {
    return `Section 4.1 allows only Mermaid C4Context and C4Container diagrams; found ${disallowed}.`;
  }

  return null;
}

function liteProductContextDiagramError(content: string): string | null {
  const diagramTypes = mermaidDiagramTypes(content);
  const contextCount = diagramTypes.filter((type) => type === "C4Context").length;
  if (contextCount !== 1) {
    return "Lite ALPS Section 2.1 requires exactly one Mermaid C4Context diagram.";
  }

  const disallowed = diagramTypes.find((type) => type.startsWith("C4") && type !== "C4Context");
  if (disallowed) {
    return `Lite ALPS Section 2.1 allows only Mermaid C4Context diagrams; found ${disallowed}.`;
  }

  return null;
}

type LoadedDocument =
  | { content: string; profile: DocumentProfile }
  | {
      error: string;
    };

export class DocumentService {
  private workingDoc: string | null = null;
  private readonly templates: Readonly<Record<DocumentProfileId, TemplateRegistry>>;

  constructor(
    alpsTemplates = new TemplateRegistry(),
    liteTemplates = new TemplateRegistry(
      LITE_ALPS_PROFILE.chaptersDir,
      LITE_ALPS_PROFILE.dynamicSection?.section ?? null,
    ),
  ) {
    this.templates = {
      alps: alpsTemplates,
      lite: liteTemplates,
    };
  }

  private attribute(attributes: string, name: string): string | null {
    return attribute(attributes, name);
  }

  private isNotStarted(sectionContent: string): boolean {
    return !sectionContent || sectionContent.includes(NOT_STARTED);
  }

  private parseSections(content: string): Map<number, string> {
    const sections = new Map<number, string>();
    const re = /<section\b([^>]*)>\s*([\s\S]*?)<\/section>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const id = this.attribute(match[1], "id");
      if (id && /^\d+$/.test(id)) {
        sections.set(Number.parseInt(id, 10), match[2].trim());
      }
    }
    return sections;
  }

  private parseSectionHeaders(content: string): { id: number; title: string | null }[] {
    const headers: { id: number; title: string | null }[] = [];
    const re = /<section\b([^>]*)>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const id = this.attribute(match[1], "id");
      const title = this.attribute(match[1], "title");
      if (id && /^\d+$/.test(id)) {
        headers.push({ id: Number.parseInt(id, 10), title });
      }
    }
    return headers;
  }

  private parseSubsections(
    sectionContent: string,
    sectionId: number,
  ): Map<string, { title: string; content: string }> {
    const subsections = new Map<string, { title: string; content: string }>();
    const re = /<subsection\b([^>]*)>\s*([\s\S]*?)\s*<\/subsection>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(sectionContent)) !== null) {
      const id = this.attribute(match[1], "id");
      const title = this.attribute(match[1], "title");
      if (!id || title == null || !id.startsWith(`${sectionId}.`)) continue;
      subsections.set(id, { title, content: decodeXml(match[2].trim()) });
    }
    return subsections;
  }

  private hasUnparsedContent(sectionContent: string): boolean {
    const remainder = sectionContent
      .replace(/<subsection\b[^>]*>\s*[\s\S]*?\s*<\/subsection>/g, "")
      .replace(/<!--\s*Not started\s*-->/g, "")
      .trim();
    return remainder.length > 0;
  }

  private fixedSubsectionError(
    profile: DocumentProfile,
    section: number,
    sectionContent: string,
  ): string | null {
    if (section === profile.dynamicSection?.section) return null;
    if (this.hasUnparsedContent(sectionContent)) {
      return `Lite ALPS Section ${section} contains unrecognized content.`;
    }

    const seen = new Set<string>();
    const subsectionRe = /<subsection\b([^>]*)>\s*[\s\S]*?\s*<\/subsection>/g;
    let subsectionMatch: RegExpExecArray | null;
    while ((subsectionMatch = subsectionRe.exec(sectionContent)) !== null) {
      const id = this.attribute(subsectionMatch[1], "id");
      const title = this.attribute(subsectionMatch[1], "title");
      const prefix = `${section}.`;
      if (!id || title == null || !id.startsWith(prefix)) {
        return `Lite ALPS Section ${section} contains a subsection with an invalid id or title.`;
      }
      if (seen.has(id)) {
        return `Lite ALPS subsection ${id} must appear exactly once.`;
      }
      seen.add(id);

      const validation = this.templates[profile.id].validateSubsection(
        section,
        id.slice(prefix.length),
        title,
      );
      if (!validation.ok) return `Lite ALPS ${validation.message}`;
    }
    return null;
  }

  private featureNames(
    sectionContent: string,
    sectionId: number,
    subsectionId: string,
  ): Map<number, string> {
    const source = this.parseSubsections(sectionContent, sectionId).get(subsectionId);
    const features = new Map<number, string>();
    if (!source) return features;

    for (const line of source.content.split(/\r?\n/)) {
      const table = line.match(/^\s*\|?\s*F(\d+)\s*\|\s*([^|]+?)\s*(?:\||$)/i);
      const list = line.match(/^\s*(?:[-*]\s*)?F(\d+)\s*:\s*(.+?)\s*$/i);
      const match = table ?? list;
      if (!match) continue;
      features.set(Number.parseInt(match[1], 10), match[2].trim());
    }
    return features;
  }

  private liteFeatureError(
    profile: DocumentProfile,
    sections: Map<number, string>,
    subsectionId: string,
    title: string,
  ): string | null {
    const dynamic = profile.dynamicSection;
    if (!dynamic) return null;

    const features = this.featureNames(
      sections.get(dynamic.sourceSection) || "",
      dynamic.sourceSection,
      dynamic.sourceSubsectionId,
    );
    const featureNumber = Number.parseInt(subsectionId, 10);
    const featureName = features.get(featureNumber);
    if (!featureName) {
      return `Lite ALPS Feature F${featureNumber} must be declared with a name in Section ${dynamic.sourceSubsectionId} before Section ${dynamic.section} can save it.`;
    }

    const expectedTitle = `F${featureNumber}: ${featureName}`;
    return title.trim() === expectedTitle
      ? null
      : `Lite ALPS Feature ${dynamic.section}.${featureNumber} title must be "${expectedTitle}".`;
  }

  private buildSubsection(subId: string, title: string, content: string): string {
    return `<subsection id="${escapeXmlAttribute(subId)}" title="${escapeXmlAttribute(title)}">\n${escapeXmlText(content)}\n</subsection>`;
  }

  private buildSection(profile: DocumentProfile, sectionId: number, content: string): string {
    return `<section id="${sectionId}" title="${escapeXmlAttribute(profile.sectionTitles[sectionId])}">\n${content}\n</section>`;
  }

  /** Rebuild numbered sections while preserving the optional trailing term definitions. */
  private buildDocument(
    profile: DocumentProfile,
    projectName: string,
    sections: Map<number, string>,
    glossary: readonly GlossaryEntry[] = [],
  ): string {
    const profileAttribute = profile.rootProfile
      ? ` profile="${escapeXmlAttribute(profile.rootProfile)}"`
      : "";
    const lines = [
      `<alps-document project="${escapeXmlAttribute(projectName)}"${profileAttribute}>`,
    ];
    for (const section of sectionNumbers(profile)) {
      lines.push(this.buildSection(profile, section, sections.get(section) || NOT_STARTED));
    }
    if (glossary.length > 0) lines.push(buildGlossary(glossary));
    lines.push("</alps-document>");
    return lines.join("\n\n");
  }

  private extractProjectName(content: string): string {
    const root = content.match(/<(?:alps-document|prd-document)\b([^>]*)>/);
    if (root) {
      const project = this.attribute(root[1], "project");
      if (project) return project;
    }
    const match = content.match(/^# (.+?) (?:Lite )?(?:ALPS|PRD)/m);
    return match ? match[1] : "Untitled";
  }

  /** Validate the active profile and glossary before selecting or mutating a document. */
  private inspectDocument(content: string): { profile: DocumentProfile } | { error: string } {
    const root = content.match(/^\s*<(alps-document|prd-document)\b([^>]*)>/);
    if (!root) return { error: "Missing <alps-document> root element." };
    if (!new RegExp(`</${root[1]}>\\s*$`).test(content)) {
      return { error: `Missing closing </${root[1]}> element.` };
    }
    try {
      parseGlossary(content);
    } catch (error) {
      return { error: (error as Error).message };
    }

    const profileValue = this.attribute(root[2], "profile");
    const headers = this.parseSectionHeaders(content);
    let profile: DocumentProfile | null = null;
    if (profileValue == null || profileValue === "" || profileValue === "alps") {
      profile = ALPS_PROFILE;
    } else if (profileValue === LITE_ALPS_PROFILE.rootProfile) {
      const headerIds = headers.map(({ id }) => id);
      const currentIds = sectionNumbers(LITE_ALPS_PROFILE);
      if (
        currentIds.length === headerIds.length &&
        currentIds.every((section, index) => section === headerIds[index])
      ) {
        profile = LITE_ALPS_PROFILE;
      } else {
        return {
          error: "Lite ALPS documents must contain Sections 1-4 exactly once and in order.",
        };
      }
    }
    if (!profile) return { error: `Unknown ALPS document profile: ${profileValue}.` };

    const sections = this.parseSections(content);
    if (sections.size === 0) return { error: "Document contains no valid sections." };
    if (isLiteProfile(profile)) {
      const expected = sectionNumbers(profile);
      if (
        expected.length !== headers.length ||
        expected.some((section, index) => section !== headers[index]?.id)
      ) {
        return {
          error: `Lite ALPS documents must contain Sections ${sectionRange(profile)} exactly once and in order.`,
        };
      }
      const titleMismatch = expected.find(
        (section, index) => headers[index]?.title !== profile.sectionTitles[section],
      );
      if (titleMismatch != null) {
        return {
          error: `Lite ALPS Section ${titleMismatch} title must be "${profile.sectionTitles[titleMismatch]}".`,
        };
      }
      for (const section of expected) {
        const subsectionError = this.fixedSubsectionError(
          profile,
          section,
          sections.get(section) || "",
        );
        if (subsectionError) return { error: subsectionError };
      }
      const dynamic = profile.dynamicSection;
      if (dynamic) {
        const savedFeatureIds = new Set<string>();
        const subsectionRe = /<subsection\b([^>]*)>/g;
        let subsectionMatch: RegExpExecArray | null;
        while (
          (subsectionMatch = subsectionRe.exec(sections.get(dynamic.section) || "")) !== null
        ) {
          const id = this.attribute(subsectionMatch[1], "id");
          const title = this.attribute(subsectionMatch[1], "title");
          if (!id || !new RegExp(`^${dynamic.section}\\.[1-9]\\d*$`).test(id)) {
            return {
              error: `Lite ALPS Feature subsection ${id ?? "(missing id)"} must use ${dynamic.section}.x with a positive number.`,
            };
          }
          if (savedFeatureIds.has(id)) {
            return { error: `Lite ALPS Feature subsection ${id} must appear exactly once.` };
          }
          savedFeatureIds.add(id);
          const featureNumber = id.slice(`${dynamic.section}.`.length);
          const featureError = this.liteFeatureError(profile, sections, featureNumber, title ?? "");
          if (featureError) return { error: featureError };
        }
      }
    }
    return { profile };
  }

  private readWorkingDocument(): LoadedDocument {
    if (!this.workingDoc) {
      return {
        error:
          "No document loaded. Call init_alps_document(), init_lite_alps_document(), or load_alps_document() first.",
      };
    }

    let content: string;
    try {
      content = fs.readFileSync(this.workingDoc, "utf-8");
    } catch (error) {
      return { error: `Unable to read ${this.workingDoc}: ${(error as Error).message}` };
    }

    const inspection = this.inspectDocument(content);
    return "error" in inspection
      ? { error: `Invalid ALPS document at ${this.workingDoc}: ${inspection.error}` }
      : { content, profile: inspection.profile };
  }

  private writeAtomic(filepath: string, content: string): void {
    const temporary = `${filepath}.tmp-${process.pid}-${Date.now()}`;
    try {
      fs.writeFileSync(temporary, content, "utf-8");
      fs.renameSync(temporary, filepath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  private expandHome(value: string): string {
    return value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
  }

  private get outputDir(): string {
    const dir =
      process.env.ALPS_OUTPUT_DIR || process.env.PRD_OUTPUT_DIR || path.join(process.cwd(), "prd");
    return this.expandHome(dir);
  }

  private expandPath(value: string): string {
    if (value.startsWith("~")) return this.expandHome(value);
    if (path.isAbsolute(value)) return value;
    return path.resolve(this.outputDir, value);
  }

  private pathError(filepath: string, profile: DocumentProfile): string | null {
    const lower = filepath.toLowerCase();
    if (isLiteProfile(profile)) {
      return lower.endsWith(profile.filenameSuffix)
        ? null
        : `Invalid document path: ${filepath}. Lite ALPS documents must use the ${profile.filenameSuffix} extension.`;
    }
    if (
      !lower.endsWith(profile.filenameSuffix) ||
      lower.endsWith(LITE_ALPS_PROFILE.filenameSuffix)
    ) {
      return `Invalid document path: ${filepath}. ALPS documents must use the ${profile.filenameSuffix} extension.`;
    }
    return null;
  }

  initDocument(
    projectName: string,
    outputPath: string,
    profileId: InitializableDocumentProfileId = "alps",
  ): string {
    this.workingDoc = null;
    const profile = DOCUMENT_PROFILES[profileId];
    let filepath = this.expandPath(outputPath);
    if (!path.extname(filepath)) filepath += profile.filenameSuffix;

    const pathError = this.pathError(filepath, profile);
    if (pathError) return pathError;
    if (fs.existsSync(filepath)) {
      return `Document already exists at ${filepath}. Use load_alps_document() to resume.`;
    }

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    try {
      fs.writeFileSync(filepath, this.buildDocument(profile, projectName, new Map()), {
        encoding: "utf-8",
        flag: "wx",
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        return `Document already exists at ${filepath}. Use load_alps_document() to resume.`;
      }
      throw error;
    }
    this.workingDoc = filepath;
    return `Created ${profile.label} document at ${filepath}`;
  }

  /**
   * Keeps resume guidance aligned with each profile's authoring contract.
   * Full ALPS remains question-first, while Lite asks only for missing or
   * protected context and preserves proposal-first Sections 2 and 4.
   */
  private resumeGuidance(profile: DocumentProfile): string {
    const steps = isLiteProfile(profile)
      ? `1. Call ${profile.sectionGuideTool}(N) before working on any section
2. Follow the guide: ask only for missing user-owned or protected context, but propose Sections 2 and 4 before asking the user to design them
3. Wait for a user response only when the guide requires a focused question; otherwise present the proposal for approval
4. Get explicit "yes" confirmation before calling save_alps_section()`
      : `1. Call ${profile.sectionGuideTool}(N) before working on any section
2. Reuse supplied context. Ask 1-2 focused questions at a time only for missing information. DO NOT auto-generate content that invents missing product decisions
3. Wait when a question needs an answer; otherwise present the section's approval digest
4. Get explicit "yes" confirmation before calling save_alps_section()`;

    return `⚠️ CONVERSATION MODE REQUIRED:
${steps}
Read read_alps_glossary() when terminology is needed. Require the user's meaning for undefined jargon or acronyms before finalizing dependent content; reuse supplied definitions. Save confirmed definitions with save_alps_glossary_entry() under the current section approval. The optional appendix stays after the numbered sections and is absent when unnecessary.
NEVER save generated content without user approval.`;
  }

  /**
   * Selects only structurally valid ALPS documents and returns the matching
   * profile's conversation rules so resume cannot cross document boundaries.
   */
  loadDocument(docPath: string): string {
    this.workingDoc = null;
    const filepath = this.expandPath(docPath);
    if (!filepath.toLowerCase().endsWith(ALPS_PROFILE.filenameSuffix)) {
      return `Invalid document path: ${filepath}. ALPS documents must use the .alps.xml extension.`;
    }
    if (!fs.existsSync(filepath)) return `Document not found at ${filepath}`;

    let content: string;
    try {
      content = fs.readFileSync(filepath, "utf-8");
    } catch (error) {
      return `Unable to read ${filepath}: ${(error as Error).message}`;
    }

    const inspection = this.inspectDocument(content);
    if ("error" in inspection) return `Invalid ALPS document at ${filepath}: ${inspection.error}`;
    const pathError = this.pathError(filepath, inspection.profile);
    if (pathError) return pathError;

    this.workingDoc = filepath;
    return `${this.getStatus()}

---
${this.resumeGuidance(inspection.profile)}`;
  }

  /** Save one approved subsection without dropping definitions collected elsewhere in the document. */
  saveSection(section: number, subsectionId: string, title: string, content: string): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;

    const { profile } = document;
    if (!(section in profile.sectionTitles)) {
      return `Invalid section number: ${section}. Must be ${sectionRange(profile)} for ${profile.label}.`;
    }

    const subsection = this.templates[profile.id].validateSubsection(section, subsectionId, title);
    if (!subsection.ok) return `Invalid subsection: ${subsection.message}`;
    if (profile.id === "alps" && subsection.fullId === "4.1") {
      const diagramError = architectureDiagramError(content);
      if (diagramError) return `Invalid subsection content: ${diagramError}`;
    }
    if (profile.id === "lite" && subsection.fullId === "2.1") {
      const diagramError = liteProductContextDiagramError(content);
      if (diagramError) return `Invalid subsection content: ${diagramError}`;
    }

    const projectName = this.extractProjectName(document.content);
    const sections = this.parseSections(document.content);
    if (isLiteProfile(profile) && section === profile.dynamicSection?.section) {
      const featureError = this.liteFeatureError(profile, sections, subsectionId, title);
      if (featureError) return `Invalid subsection: ${featureError}`;
    }
    const sectionContent = sections.get(section) || "";
    if (this.hasUnparsedContent(sectionContent)) {
      return `Cannot safely update Section ${section}: it contains unrecognized content. Export or migrate it before saving a subsection.`;
    }

    const existing = this.parseSubsections(sectionContent, section);
    existing.set(subsection.fullId, { title, content });
    const parts = [...existing.entries()]
      .sort(bySubsectionId)
      .map(([id, value]) => this.buildSubsection(id, value.title, value.content));
    sections.set(section, parts.join("\n"));

    this.writeAtomic(
      this.workingDoc!,
      this.buildDocument(profile, projectName, sections, parseGlossary(document.content)),
    );
    return `Saved ${subsection.fullId}. ${title}`;
  }

  /**
   * Save one user-confirmed meaning while preserving all other entries and section content.
   * Semantic confirmation belongs to the conversation; blank input is rejected without a write.
   */
  saveGlossaryEntry(term: string, definition: string): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    term = term.trim();
    definition = definition.trim();
    if (!term || !definition) return "Glossary term and definition must both be non-empty.";

    const entries = parseGlossary(document.content);
    const existing = entries.find((entry) => glossaryKey(entry.term) === glossaryKey(term));
    if (existing?.definition === definition) return `Glossary unchanged: ${existing.term}`;
    if (existing) existing.definition = definition;
    else entries.push({ term, definition });

    const glossary = buildGlossary(entries);
    const content = document.content.includes("<glossary>")
      ? document.content.replace(/<glossary>[\s\S]*?<\/glossary>/, () => glossary)
      : document.content.replace(
          /<\/(?:alps-document|prd-document)>\s*$/,
          (closing) => `${glossary}\n\n${closing}`,
        );
    this.writeAtomic(this.workingDoc!, content);
    return `Saved glossary term: ${existing?.term ?? term}`;
  }

  /** Return definitions for reuse without creating an appendix or changing completion state. */
  readGlossary(): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    const entries = parseGlossary(document.content);
    return entries.length
      ? glossaryMarkdown(entries)
      : "No glossary: no term definitions recorded.";
  }

  readSection(section: number, subsectionId?: string): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;
    if (!(section in document.profile.sectionTitles)) return `Section ${section} not found.`;

    const sections = this.parseSections(document.content);
    const content = sections.get(section) || "";
    if (subsectionId != null) {
      const subId = `${section}.${subsectionId}`;
      const subsection = this.parseSubsections(content, section).get(subId);
      if (subsection) return `### ${subId}. ${subsection.title}\n\n${subsection.content}`;
      return `Subsection ${subId} not found.`;
    }

    const display = this.sectionIsUnwritten(content, section)
      ? "*Not yet written*"
      : this.contentToMarkdown(content, section);
    return `## Section ${section}. ${document.profile.sectionTitles[section]}\n\n${display}`;
  }

  /**
   * Count required entries with an actual body, not merely saved XML tags.
   * Empty saves still clear content, but cannot make a section complete on resume.
   * Reading status never rewrites older documents containing empty entries.
   */
  getStatus(): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;

    const { content: docContent, profile } = document;
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);
    const registry = this.templates[profile.id];
    const lines = [`${profile.label} Document: ${projectName}`, `Location: ${this.workingDoc}`, ""];

    for (const [number, title] of Object.entries(profile.sectionTitles)) {
      const section = Number.parseInt(number, 10);
      const content = sections.get(section) || "";
      const savedSubsections = this.parseSubsections(content, section);
      const subsections = new Map(
        [...savedSubsections].filter(([, subsection]) => subsection.content.trim().length > 0),
      );
      let status: string;

      if (subsections.size === 0 && (savedSubsections.size > 0 || this.isNotStarted(content))) {
        status = profile.optionalSections.includes(section)
          ? "⬜ Optional — not written"
          : "⬜ Not started";
      } else if (section === profile.dynamicSection?.section) {
        const expectedItems = this.countFeatureIds(sections, profile);
        if (expectedItems > 0 && subsections.size >= expectedItems) {
          status = `✅ Written (${subsections.size}/${expectedItems} features)`;
        } else if (expectedItems > 0) {
          status = `🟡 In progress (${subsections.size}/${expectedItems} features)`;
        } else {
          status = `🟡 In progress (${subsections.size} dynamic feature${subsections.size === 1 ? "" : "s"} saved)`;
        }
      } else {
        const expected = registry
          .expectedSubsections(section)
          .filter((definition) => definition.required);
        const written = expected.filter((definition) => subsections.has(definition.id)).length;
        if (expected.length === 0 && profile.optionalSections.includes(section)) {
          status = `✅ Written (${subsections.size} optional subsection${subsections.size === 1 ? "" : "s"})`;
        } else {
          status =
            expected.length > 0 && written === expected.length
              ? `✅ Written (${written}/${expected.length} subsections)`
              : `🟡 In progress (${written}/${expected.length} subsections)`;
        }
      }
      lines.push(`Section ${number} (${title}): ${status}`);
    }
    const glossary = parseGlossary(docContent);
    if (glossary.length > 0) lines.push(`Appendix (Glossary): ${glossary.length} defined terms`);
    return lines.join("\n");
  }

  private countFeatureIds(sections: Map<number, string>, profile: DocumentProfile): number {
    const dynamic = profile.dynamicSection;
    if (!dynamic) return 0;
    const source = this.parseSubsections(
      sections.get(dynamic.sourceSection) || "",
      dynamic.sourceSection,
    ).get(dynamic.sourceSubsectionId);
    if (!source) return 0;
    const ids = source.content.match(/\bF(?:\d+|(?:-[A-Z0-9]+)+)\b/gi) ?? [];
    return new Set(ids.map((id) => id.toUpperCase())).size;
  }

  private contentToMarkdown(content: string, section: number): string {
    const subsections = this.parseSubsections(content, section);
    if (subsections.size === 0) return content;
    return [...subsections.entries()]
      .sort(bySubsectionId)
      .map(([id, data]) => `### ${id}. ${data.title}\n\n${data.content}`)
      .join("\n\n");
  }

  /**
   * Keep reads and exports consistent with completion after an empty save.
   * Meaningful legacy prose is preserved even when it has no structured entries.
   */
  private sectionIsUnwritten(content: string, section: number): boolean {
    if (this.isNotStarted(content)) return true;
    const subsections = this.parseSubsections(content, section);
    return (
      subsections.size > 0 &&
      [...subsections.values()].every((subsection) => subsection.content.trim().length === 0)
    );
  }

  /** Export numbered content followed by the glossary only when actual definitions exist. */
  exportMarkdown(outputPath?: string): string {
    const document = this.readWorkingDocument();
    if ("error" in document) return document.error;

    const { content: docContent, profile } = document;
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);
    const lines = [`# ${projectName} ${profile.markdownTitle}\n`];

    for (const section of sectionNumbers(profile)) {
      const content = sections.get(section) || "";
      const unwritten = this.sectionIsUnwritten(content, section);
      if (profile.optionalSections.includes(section) && unwritten) continue;
      const markdown = unwritten ? "*Not yet written*" : this.contentToMarkdown(content, section);
      lines.push(
        `## Section ${section}. ${profile.sectionTitles[section]}\n\n${markdown}\n\n---\n`,
      );
    }
    const glossary = parseGlossary(docContent);
    if (glossary.length > 0) lines.push(glossaryMarkdown(glossary));

    const result = lines.join("\n");
    if (outputPath) {
      const out = this.expandPath(outputPath);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      this.writeAtomic(out, result);
      return `Exported to ${out}`;
    }
    return result;
  }
}
