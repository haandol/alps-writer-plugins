import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectFinding,
  expectNoFinding,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 문서 리뷰 경계

Date: 2026-08-28

## Status

Accepted (2026-08-28)

## Context

ADR 문서 품질과 shipping code 일치 여부는 서로 다른 검토 질문이다.

## Decision Drivers

- 문서 리뷰는 코드 상태와 독립적으로 수행할 수 있어야 한다
- 코드 drift는 별도 경로에서 검증해야 한다
- 깨끗한 문서 리뷰가 코드 일치 판정으로 오해되면 안 된다

## Decision

문서 리뷰는 ADR의 추상화 수준, 계약 보존과 대안 품질만 판정한다.

### Alternatives

- 문서와 코드를 한 번에 검토한다
- 문서 품질과 코드 일치를 분리한다

## Consequences

코드 일치는 별도 동기화 검토가 담당한다.
`;

export default {
  name: "review-document-only-boundary",
  description:
    "Probe the declared document-only boundary; structural-lint integration tests separately exercise the actual command and code-scan exclusion.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/review/0001-document-boundary.md", ADR);
    seedMapping(dir, {
      categories: {
        review: {
          feature: "Document review",
          adrs: [
            {
              path: "docs/adr/review/0001-document-boundary.md",
              status: "Accepted (2026-08-28)",
              summary: "문서 리뷰는 ADR 품질만 판정하고 코드 일치는 별도 검토가 담당한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(dir, "src/review.ts", "export const implementation = 'different';\n");

    return [
      skillText("adr-review"),
      agentText("adr-reviewer"),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `Review docs/adr/review/0001-document-boundary.md through /adr-review.`,
      `Product code exists and may disagree, but this command is the document-quality axis.`,
      `Do not call tools. State the review boundary and route for code reality.`,
      `Use DOCUMENT_ONLY and SYNC_ROUTE as tail tags.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    return [
      expectFinding(tail, /DOCUMENT_ONLY/i, "document review does not inspect product code"),
      expectFinding(tail, /SYNC_ROUTE/i, "implementation reality routes to adr-sync"),
      expectNoFinding(
        tail,
        /OPEN_CODE|CODE_MATCH_VERDICT|IMPLEMENTATION_EXISTS/i,
        "document review does not claim code consistency",
      ),
    ];
  },
};
