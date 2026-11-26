import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";
import { liteDerivationRules } from "../lib/lite-derivation.mjs";

// Status as the server prints it when the recorded Lite source is no longer complete.
const STATUS = `
alps_document(action: 'load', doc_path: '/work/prd/cart.alps.xml')는 다음 상태를 보고했다.

ALPS Document: cart
Location: /work/prd/cart.alps.xml

Section 1 (Overview): ✅ Written (7/7 subsections)
Section 2 (MVP Goals and Key Metrics): ✅ Written (2/2 subsections)
Section 3 (Demo Scenario): ✅ Written (1/1 subsections)
Section 4 (High-Level Architecture): ✅ Written (2/2 subsections)
Section 5 (Requirements Summary): ⬜ Not started
Section 6 (Design Specification): ⬜ Not started
Section 7 (Feature-Level Specification): ⬜ Not started
Section 8 (MVP Metrics): ⬜ Not started
Section 9 (Out of Scope): ⬜ Not started

Lite source: cart.lite.alps.xml
Lite source path: /work/prd/cart.lite.alps.xml
Lite source incomplete: undefined requirement references: FR-3. Lite coverage is unverified.
Completion: 🟡 Incomplete — Sections not complete: 5, 6, 7, 8, 9; Lite source incomplete
Next steps:
- Complete the remaining Sections in section order, starting with Section 5 (Requirements Summary).
- Complete the Lite source through Lite Section approval: load it with alps_document(action: 'load', doc_path: '/work/prd/cart.lite.alps.xml'), then define each referenced ID in its owning subsection (FR-3 in 3.1), or correct or remove the reference. Then check this document's status again; resume, saves and export keep working meanwhile.

동료가 Full을 파생한 뒤 Lite 8.1 Demo Scenario에 "쿠폰을 적용하면 할인이 보인다 (FR-3)" 단계를 추가했지만, Lite 3.1에는 FR-1과 FR-2만 정의되어 있다.
`;

export const obligations = [
  {
    id: "explain",
    text: "Explain plainly that the Lite source is currently incomplete because its Demo Scenario references FR-3, which Lite 3.1 never defines, so Lite coverage cannot be verified and the Full document will not be marked complete. Do not stop at saying the source is unavailable or unusable.",
  },
  {
    id: "next",
    text: "Give the concrete next action: open the Lite at /work/prd/cart.lite.alps.xml and, through Lite Section approval, either define FR-3 in Lite 3.1 or correct or remove the FR-3 reference, then check the Full status again. Offer to do that next (for example by proposing the Lite change), and say that Full work such as Section 5 can continue meanwhile or let the user choose the order.",
  },
  {
    id: "boundary",
    text: "Do not decide what FR-3 means inside Full, do not add a coupon rule or FR-3 to Full content, and do not claim the Full document is complete. Do not invoke tools or save.",
  },
];

export default {
  name: "alps-full-relays-unusable-source-next-steps",
  description:
    "A derived Full ALPS whose Lite source became incomplete explains the reason and relays the concrete next action instead of stopping at an unavailable state.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      liteDerivationRules(),
      `\n---\n\n# This run`,
      `사용자가 Lite에서 파생한 Full ALPS 작성을 재개했다. Sections 1-4는 승인되어 저장되었다.`,
      STATUS,
      `사용자: "이어서 진행해줘."`,
      `정상적인 다음 응답을 한국어로 작성하라. 도구를 호출하거나 저장하지 마라.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
