import { TemplateService } from "./service.js";

export class TemplateController {
  constructor(private service: TemplateService) {}

  /**
   * Explain how to enter the profile without restarting an already written document.
   * The caller uses document status and the profile order, so this controller stays stateless.
   */
  getAlpsOverview(): string {
    const { sectionGuideTool, authoringOrder } = this.service.profile;
    return (
      this.service.getOverview() +
      `

---
## Next Step

Read \`get_alps_document_status()\` after initializing or loading the document.
- New document: begin with \`${sectionGuideTool}(1)\`.
- Resume: use the first incomplete required section in this order: ${authoringOrder.join(" → ")}. Do not restart a completed, unchanged section.
- Follow the profile's optional-section rules; an unwritten optional section does not force a restart.
Call \`${sectionGuideTool}(N)\` for the selected section. Reuse supplied context, ask only for missing information, and obtain approval before saving.`
    );
  }

  listAlpsSections(): { section: number; filename: string }[] {
    return this.service.listSections();
  }

  getAlpsSection(section: number, includeExamples = false): string {
    return this.service.getSection(section, includeExamples);
  }

  getAlpsFullTemplate(includeExamples = false): string {
    return this.service.getFullTemplate(includeExamples);
  }

  getAlpsSectionGuide(section: number): string {
    return this.service.getSectionGuide(section);
  }
}
