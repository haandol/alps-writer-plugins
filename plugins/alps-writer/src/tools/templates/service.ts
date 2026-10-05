import fs from "fs";
import path from "path";
import { ALPS_PROFILE, type DocumentProfile } from "../../profiles.js";

export class TemplateService {
  constructor(readonly profile: DocumentProfile = ALPS_PROFILE) {}

  private xmlToMarkdown(content: string, includeExamples: boolean): string {
    const lines: string[] = [];
    this.renderXml(content, lines, 2, includeExamples);
    return lines.join("\n").trim();
  }

  private renderXml(xml: string, lines: string[], level: number, includeExamples: boolean): void {
    // Match top-level tags iteratively
    const tagRe =
      /<(section|subsection|template|description|example|header)(\s[^>]*)?>([^]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(xml)) !== null) {
      const [, tag, attrs, inner] = match;
      if (tag === "example") {
        if (includeExamples) lines.push(`\n**Example:**\n${inner.trim()}\n`);
        continue;
      }
      if (tag === "description") {
        lines.push(`\n${inner.trim()}\n`);
        continue;
      }
      if (tag === "header") {
        lines.push(`\n> ${inner.trim()}\n`);
        continue;
      }
      // section / subsection / template
      const titleMatch = attrs?.match(/title="([^"]*)"/);
      const idMatch = attrs?.match(/id="([^"]*)"/);
      const title = titleMatch?.[1] ?? "";
      const id = idMatch?.[1] ?? "";
      const optional = attrs?.match(/\brequired="false"/) ? " (Optional)" : "";
      if (title) {
        lines.push(
          id
            ? `${"#".repeat(level)} ${id} ${title}${optional}\n`
            : `${"#".repeat(level)} ${title}${optional}\n`,
        );
      }
      this.renderXml(inner, lines, level + 1, includeExamples);
    }
  }

  getOverview(): string {
    return fs.readFileSync(path.join(this.profile.templatesDir, "overview.md"), "utf-8");
  }

  listSections(): { section: number; filename: string }[] {
    return fs
      .readdirSync(this.profile.chaptersDir)
      .filter((f) => f.endsWith(".xml"))
      .sort()
      .map((f) => ({
        section: parseInt(f.split("-")[0], 10),
        filename: f,
      }));
  }

  getSection(section: number, includeExamples = false): string {
    const prefix = String(section).padStart(2, "0") + "-";
    const file = fs
      .readdirSync(this.profile.chaptersDir)
      .find((f) => f.startsWith(prefix) && f.endsWith(".xml"));
    if (!file) return `Section ${section} not found.`;
    return this.xmlToMarkdown(
      fs.readFileSync(path.join(this.profile.chaptersDir, file), "utf-8"),
      includeExamples,
    );
  }

  getFullTemplate(includeExamples = false): string {
    const parts = [this.getOverview(), "\n---\n"];
    for (const f of fs
      .readdirSync(this.profile.chaptersDir)
      .filter((f) => f.endsWith(".xml"))
      .sort()) {
      parts.push(
        this.xmlToMarkdown(
          fs.readFileSync(path.join(this.profile.chaptersDir, f), "utf-8"),
          includeExamples,
        ),
      );
      parts.push("\n---\n");
    }
    return parts.join("\n");
  }

  getSectionGuide(section: number): string {
    const guidePath = path.join(this.profile.guidesDir, `${String(section).padStart(2, "0")}.md`);
    if (!fs.existsSync(guidePath)) return `Section ${section} not found.`;

    const guide = fs.readFileSync(guidePath, "utf-8");
    const refs = this.profile.sectionReferences[section];
    if (refs) {
      const refNames = refs.map((r) => `Section ${r} (${this.profile.sectionTitles[r]})`);
      const readCalls = refs.map((r) => `read_alps_section(doc_path, ${r})`).join(", ");
      return `⚠️ REQUIRED: This section depends on ${refNames.join(", ")}.
Before proceeding, you MUST:
1. Call ${readCalls} to review every referenced section
2. Summarize key points from referenced section(s) in your response
3. If a referenced section is empty, STOP and author it first (per the recommended authoring order) — do not fabricate its content, then return here

${guide}`;
    }
    return guide;
  }
}
