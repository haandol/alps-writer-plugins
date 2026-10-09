import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases as executionCases } from "../regression/cases.mjs";
import { sha, confined, listFiles } from "../regression/workspace.mjs";
import { responseObligations } from "./response-contract.mjs";
import { reportCases } from "./report-cases.mjs";
import { reportScopeCases } from "./report-scope-cases.mjs";
import { reportArtifactCases } from "./report-artifact-cases.mjs";
import { importExecutionCases } from "./import-execution.mjs";
import { importPrerequisiteCases } from "./import-prerequisites.mjs";
import { encbirdRollupCases } from "./encbird-rollup-cases.mjs";

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const ROOT = path.resolve(PLUGIN, "../..");

// These are task expectations, not descriptions copied into the routing prompt.
export const routingCases = [
  {
    id: "routing-project-import",
    title: "기존 프로젝트에 ADR 도입",
    prompt:
      "기획 문서 없이 기존 프로젝트의 코드를 읽어 기능별 ADR로 정리하고, 빠진 의도는 리포트로 모아 물어봐줘.",
    required: ["adr-import"],
    allowed: ["adr-import", "adr-new", "report-writer"],
  },
  {
    id: "routing-product-handoff",
    title: "기획 기능의 계약 이전",
    prompt: "승인된 Full ALPS 문서의 Feature들을 ADR로 이전해줘.",
    required: ["feature-to-adr"],
    allowed: ["feature-to-adr", "adr-new", "report-writer"],
  },
  {
    id: "routing-document-review",
    title: "문서만 검토",
    prompt: "ADR 문서의 요구값 누락과 추상화 수준만 검토해줘. 코드나 문서를 수정하지 마.",
    required: ["adr-review"],
    allowed: ["adr-review", "report-writer"],
  },
  {
    id: "routing-sync",
    title: "구현과 문서 대조",
    prompt: "배포된 코드와 ADR의 결정이 맞는지 확인하고 입증된 문서 차이를 고쳐줘.",
    required: ["adr-sync"],
    allowed: ["adr-sync", "report-writer"],
  },
  {
    id: "routing-lite",
    title: "Lite 문서 시작",
    prompt: "새 제품의 Lite ALPS 문서를 시작하자. 문제와 비즈니스 임팩트부터 정리하고 싶어.",
    required: ["lite-alps-init"],
    allowed: ["lite-alps-init"],
  },
  {
    id: "routing-full",
    title: "Full 문서 시작",
    prompt: "새 제품의 Full ALPS PRD 작성을 시작해줘.",
    required: ["alps-init"],
    allowed: ["alps-init"],
  },
  {
    id: "routing-rollup",
    title: "같은 결정 정리",
    prompt:
      "같은 결정의 변경 이력이 여러 ADR에 흩어졌어. 현재 결정 하나로 합치고 큰 전환은 이력에 남겨줘.",
    required: ["adr-rollup"],
    allowed: ["adr-rollup", "report-writer"],
  },
  {
    id: "routing-implementation",
    title: "기록된 결정 구현",
    prompt: "이미 승인한 Proposed ADR을 코드로 구현하고 테스트와 완료 리뷰까지 진행해줘.",
    required: ["adr-impl"],
    allowed: ["adr-impl", "adr-impl-refactor", "adr-impl-review", "report-writer"],
  },
  {
    id: "routing-arithmetic",
    title: "일반 계산",
    prompt: "17 더하기 25는 얼마야?",
    required: [],
    allowed: [],
  },
  {
    id: "routing-typo",
    title: "단순 오탈자",
    prompt: "README의 'teh' 오타를 'the'로 고쳐줘. 제품 동작 변경은 없어.",
    required: [],
    allowed: [],
  },
].map((item) => ({
  ...item,
  type: "routing",
  group: item.required.length ? "필요한 호출" : "불필요한 호출",
}));

/** Read shipped metadata, deduplicating identical shared skills rather than manufacturing router hints. */
export function skillCatalog(roots = [PLUGIN, path.join(ROOT, "plugins/alps-writer")]) {
  const found = new Map();
  for (const root of roots) {
    if (!existsSync(path.join(root, "skills"))) continue;
    for (const dir of readdirSync(path.join(root, "skills")).sort()) {
      const file = path.join(root, "skills", dir, "SKILL.md");
      if (!existsSync(file)) continue;
      const source = readFileSync(file, "utf8");
      const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const name = header?.[1].match(/^name:\s*(.+)$/m)?.[1].trim();
      const description = header?.[1].match(/^description:\s*(.+)$/m)?.[1].trim();
      if (!name || !description) throw new Error(`Missing skill name or description: ${file}`);
      const previous = found.get(name);
      if (previous && previous.description !== description)
        throw new Error(`Conflicting skill metadata: ${name}`);
      found.set(name, { name, description, source, file, hash: sha(source) });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Load the existing corpus intact; real-repository opt-in cases remain visible and fail preparation if unset. */
export async function catalog() {
  const folder = path.join(PLUGIN, "evals/scenarios");
  const classification = [];
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".mjs"))
    .sort()) {
    const {
      default: scenario,
      obligations,
      deterministicScore,
    } = await import(path.join(folder, file));
    const authoredObligations = obligations ?? scenario.obligations;
    const localScore = deterministicScore ?? scenario.deterministicScore;
    classification.push({
      ...scenario,
      score: localScore ?? scenario.score,
      id: scenario.name,
      title: scenario.description,
      type: "classification",
      file,
      scorerHash: sha(readFileSync(path.join(folder, file), "utf8")),
      semanticObligations: authoredObligations ?? responseObligations(scenario),
      // An explicit semantic scorer must not also invoke its legacy LLM judge.
      supplementalChecks: Boolean(localScore) || !authoredObligations,
      group: scenario.name.split("-")[0],
    });
  }
  return [
    ...classification,
    ...reportCases,
    ...reportScopeCases,
    ...reportArtifactCases,
    ...routingCases,
    ...[
      ...executionCases,
      ...importExecutionCases,
      ...importPrerequisiteCases,
      ...encbirdRollupCases,
    ].map((c) => ({
      ...c,
      type: "execution",
      group: c.skill,
    })),
  ];
}

/** Validate literal required plugin references before a paid call; fixtures and optional example paths are not instructions. */
export function checkReferences(prompt, pluginRoot) {
  for (const match of prompt.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s`"'<>]+\.md)/g)) {
    if (match[1].includes("*")) {
      const pattern = new RegExp(
        `^${match[1]
          .split("*")
          .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[^/]*")}$`,
      );
      if (!listFiles(pluginRoot).some((file) => pattern.test(file)))
        throw new Error(`Required guidance pattern is unavailable: ${match[1]}`);
      continue;
    }
    const file = confined(pluginRoot, match[1]);
    if (!existsSync(file)) throw new Error(`Required guidance is unavailable: ${match[1]}`);
    if (readFileSync(file, "utf8").length > 200_000)
      throw new Error(`Guidance exceeds tool read limit: ${match[1]}`);
  }
}

/** Hash all task files, including shared organization rules excluded from the legacy evidence view. */
export function filesHash(root) {
  return sha(
    Object.fromEntries(
      listFiles(root).map((file) => [file, readFileSync(confined(root, file), "utf8")]),
    ),
  );
}
