import { TemplateService } from "./service.js";

export class TemplateController {
  constructor(
    private service: TemplateService,
    private sectionContextTool = "get_alps_section_context",
  ) {}

  /**
   * Appends the required next action to the profile overview so authoring
   * always enters through the guide-first Section context contract.
   */
  getAlpsOverview(): string {
    return (
      this.service.getOverview() +
      `

---
## Next Step

**REQUIRED**: Call \`${this.sectionContextTool}(1)\` to begin interactive writing.
Do NOT write any section without going through the guide's Q&A process first.`
    );
  }

  /**
   * Returns the complete authoring context for one Section so callers cannot
   * skip the conversation guide. The guide stays first to surface prerequisite
   * reads before the template skeleton that the caller will fill.
   */
  getAlpsSectionContext(section: number, includeExamples = false): string {
    return `${this.service.getSectionGuide(section)}

---
## Section Template

${this.service.getSection(section, includeExamples)}`;
  }
}
