import { fixtureFiles } from "../scenarios/author-discovers-existing-boundaries.mjs";
import { officialAdrFiles, mutationRequests, sectionText } from "../lib/import-evidence.mjs";
import { sectionRange, validateMappingShape } from "../../scripts/adr-lint-lib.mjs";

const REPORT = ".adr-review/import/report.md";
const domainOf = (key) => /^(ordering|billing)(?:\/[a-z0-9-]+)?$/.exec(key)?.[1];
const same = (a, b) => {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.every((key) => a[key] === b[key]);
};

/** Fresh code-only project; policy tests verify immutable application behavior, not generated prose. */
export function buildImportFixture() {
  return {
    ...fixtureFiles,
    "test/policy.test.mjs": `import {test} from 'node:test';
import assert from 'node:assert/strict';
import {submit} from '../packages/checkout/backend/submit.mjs';
import {confirm} from '../packages/order-worker/services/confirm.mjs';
import {settle} from '../packages/settlement/backend/pay.mjs';
test('members submit one to three items and submitted orders confirm',()=>{
  assert.equal(confirm(submit([1,2,3],true)).state,'confirmed');
  assert.throws(()=>submit([],true));assert.throws(()=>submit([1],false));
  assert.throws(()=>submit([1,2,3,4],true));assert.throws(()=>confirm({state:'cancelled'}));
});
test('provider failure cannot complete payment and completed results are reused',()=>{
  const pending={completed:false};assert.equal(settle(pending,false),pending);
  const completed=settle(pending,true);assert.equal(settle(completed,true),completed);
  assert.equal(settle(completed,false),completed);
});
`,
  };
}

/** Validate adoption structure without pretending regex can judge the natural-language contract. */
function adoptedDocuments(files, domains, referenceDate) {
  if (!domains.length) return !Object.keys(officialAdrFiles(files)).length;
  let mapping;
  try {
    mapping = JSON.parse(files["docs/adr/.mapping.json"]);
  } catch {
    return false;
  }
  if (validateMappingShape(mapping).some((i) => i.level === "error")) return false;
  const entries = Object.entries(mapping.categories);
  if (entries.length !== domains.length) return false;
  if (!domains.every((domain) => entries.filter(([key]) => domainOf(key) === domain).length === 1))
    return false;
  const paths = [];
  for (const [key, category] of entries) {
    if (
      !domains.includes(domainOf(key)) ||
      category.adrs.length !== 1 ||
      category.dependsOn?.length !== 0
    )
      return false;
    const record = category.adrs[0],
      body = files[record.path];
    if (
      record.status !== "Proposed" ||
      typeof body !== "string" ||
      !record.path.startsWith(`docs/adr/${key}/`)
    )
      return false;
    const status = sectionRange(body, (h) => h.level === 2 && h.text === "Status");
    const contract = sectionRange(body, (h) => h.level === 3 && h.text === "Requirement contract");
    const decision = sectionRange(body, (h) => h.level === 2 && h.text === "Decision");
    if (!status || sectionText(status) !== "Proposed") return false;
    if (!contract || !decision || contract.start <= decision.start || contract.end > decision.end)
      return false;
    if (!sectionText(contract)) return false;
    if (!body.includes(`Date: ${referenceDate}`)) return false;
    paths.push(record.path);
  }
  const allowed = new Set(["docs/adr/.mapping.json", ...paths]);
  return Object.keys(officialAdrFiles(files)).every((file) => allowed.has(file));
}

/** Check every turn and recorded write so restoration or identical rewrites cannot hide violations. */
export function verifyImportExecution(evidence, domains) {
  const checkpoints = evidence.checkpoints ?? [];
  const complete =
    checkpoints.length === 3 &&
    checkpoints.every((c, i) => c.turn === i + 1 && c.files && typeof c.files === "object");
  const first = checkpoints[0]?.files ?? {},
    adopted = checkpoints[1]?.files ?? {},
    repeated = checkpoints[2]?.files ?? {};
  const requests = mutationRequests(evidence.events ?? []);
  const targets = (e) => [e.arguments?.path, e.arguments?.from, e.arguments?.to].filter(Boolean);
  const reportOnly = (e) => e.tool === "write_file" && e.arguments?.path === REPORT;
  const permitted = (e) =>
    reportOnly(e) ||
    (domains.length > 0 &&
      e.turn === 2 &&
      e.tool === "write_file" &&
      targets(e).length === 1 &&
      targets(e).every(
        (p) =>
          p === "docs/adr/.mapping.json" || domains.some((d) => p.startsWith(`docs/adr/${d}/`)),
      ));
  const statuses = requests.filter(
    (e) =>
      e.tool === "write_file" &&
      (e.arguments?.path === "docs/adr/.mapping.json" ||
        /^docs\/adr\/.*\/\d{4}-.*\.md$/.test(e.arguments?.path ?? "")),
  );
  const proposedThroughout = statuses.every((e) => {
    if (typeof e.arguments?.content !== "string") return false;
    if (e.arguments.path === "docs/adr/.mapping.json") {
      try {
        const mapping = JSON.parse(e.arguments.content);
        return Object.values(mapping.categories).every((category) =>
          category.adrs.every((adr) => adr.status === "Proposed"),
        );
      } catch {
        return false;
      }
    }
    const status = sectionRange(e.arguments.content, (h) => h.level === 2 && h.text === "Status");
    return status && sectionText(status) === "Proposed";
  });
  return [
    {
      label: "all three execution checkpoints are present",
      pass: complete,
      detail: `${checkpoints.length} checkpoints`,
    },
    {
      label: "approval-pending turn only produces its report",
      pass:
        complete &&
        !Object.keys(officialAdrFiles(first)).length &&
        typeof first[REPORT] === "string" &&
        first[REPORT].trim().length > 100 &&
        requests.filter((e) => e.turn === 1).every(reportOnly),
      detail: "no official writes, including temporary writes restored later",
    },
    {
      label: "approved domains alone receive canonical Proposed ADRs and index",
      pass: complete && adoptedDocuments(adopted, domains, evidence.referenceDate),
      detail: domains.join(", "),
    },
    {
      label: "mutations never exceed the approved turn and scope",
      pass: requests.every(permitted),
      detail: `${requests.length} recorded mutation requests`,
    },
    {
      label: "new ADR and index writes never claim Accepted, even temporarily",
      pass: proposedThroughout,
      detail: `${statuses.length} recorded ADR writes`,
    },
    {
      label: "every original application and policy file is preserved at every checkpoint",
      pass:
        complete &&
        checkpoints.every((c) =>
          Object.entries(evidence.before).every(([p, content]) => c.files[p] === content),
        ),
      detail: "compare all original inputs, not only final files",
    },
    {
      label: "equivalent repeat performs no official writes or content changes",
      pass:
        complete &&
        same(officialAdrFiles(adopted), officialAdrFiles(repeated)) &&
        requests.filter((e) => e.turn === 3).every(reportOnly),
      detail: "checks events as well as byte-equivalent document contents",
    },
    {
      label: "captured final state matches the last checkpoint",
      pass: complete && same(repeated, evidence.after),
      detail: "reject incomplete or stale capture",
    },
  ];
}

function scenario(partial, unresolved = false) {
  const domains = unresolved ? [] : partial ? ["ordering"] : ["ordering", "billing"];
  return {
    id: unresolved
      ? "import-unknown-answer-stays-pending"
      : partial
        ? "import-partial-approval-and-repeat"
        : "import-confirmed-adoption-and-repeat",
    skill: "adr-import",
    title: unresolved
      ? "알 수 없는 질문 ID의 답변은 승인으로 추정하지 않음"
      : partial
        ? "일부 계약만 승인하고 보류 범위와 재실행 무변경 보존"
        : "의도 일괄 확인 후 Proposed 저장과 재실행 무변경",
    approvedDomains: domains,
    sources: ["authored small-shop fixture"],
    adaptation:
      "가져오기 승인·저장·반복 경계를 검증하는 독립 합성 프로젝트. 기존 11개 원본 회귀 corpus는 변경하지 않는다.",
    artifactPaths: [REPORT],
    build: buildImportFixture,
    turns: [
      "현재 프로젝트 전체를 adr-import로 조사해줘. Ordering의 주문과 Billing의 결제 기능을 각각 하나의 ADR 후보로 준비하고, 코드에 없는 의도 질문과 정확한 계약 후보를 .adr-review/import/report.md에 모아줘. 질문 ID는 decision-order와 decision-billing으로 표시해줘. 이번 평가는 HTML 대신 Markdown 보고서 하나를 요청한다. 정식 ADR과 인덱스 저장은 아직 승인하지 않았어. 기존 작성 규칙과 보고서 디렉터리의 Git 제외 설정은 이미 제공됐다.",
      unresolved
        ? "decision-unknown을 승인해. 어떤 기능을 가리키는지는 아직 답하지 않을게. 이 답을 주문이나 결제의 승인으로 추정하지 말고 필요한 질문만 남겨줘."
        : partial
          ? "주문 기능만 승인한다. 회원만 1~3개 항목을 접수하고 접수됨만 확정한다는 계약과 수작업 이행 한도를 지키려는 현재 이유로 Ordering ADR 한 개와 그 인덱스만 Proposed로 저장해줘. Billing의 의도와 저장은 보류한다. 선행 기능 계약은 없다. 다른 계약·코드·이력은 바꾸지 말고 승인된 범위의 검증까지 계속해줘."
          : "두 기능을 승인한다. 주문은 회원만 1~3개 항목을 접수하고 접수됨만 확정하며, 현재 이유는 수작업 이행 한도 보존이다. 결제는 제공자 실패를 완료로 기록하지 않고 완료된 결과는 이후 성공·실패에 유지하며, 현재 이유는 잘못된 완료 표시 방지다. 이 현재 이유와 계약으로 기능별 ADR 한 개씩과 인덱스를 Proposed로 저장하고 검증해줘. 과거 도입 이유는 새로 확인된 것이 아니며, 실제 외부 청구나 동시성 보장은 추가하지 마. 두 기능 사이의 선행 관계는 없다. 코드와 과거 이력은 변경하지 마.",
      unresolved
        ? "여전히 어떤 후보를 승인하는지 확정하지 않았다. 기존 질문과 원본을 보존하고 정식 ADR·인덱스는 저장하지 마."
        : partial
          ? "같은 입력과 이미 승인한 Ordering 범위로 다시 adr-import를 수행해줘. 같은 계약은 파일·날짜·인덱스를 다시 쓰지 마. Billing은 계속 보류하며 그 결정이나 승인을 추정하지 마."
          : "같은 입력과 이미 승인한 범위로 다시 adr-import를 수행해줘. 의미가 같으면 파일·날짜·상태·인덱스·용어집·이력을 다시 쓰지 말고 새 승인 질문 없이 무변경을 확인해줘.",
    ],
    obligations: [
      {
        id: "discovery",
        text: "실제 소스에서 저장소 형태와 배포 형태를 구분하고 Ordering/Billing 기능으로 묶는다. 현재 관찰과 불명확한 역사적 의도를 구분해 첫 보고서에 계약과 보이는 질문 ID를 함께 제시한다.",
      },
      {
        id: "discovery-views",
        text: "첫 보고서에서 관찰한 주문 접수·확정과 결제 결과의 흐름 맵, 업무 소유권에 따른 컨텍스트 맵, ADR 후보 및 선행 관계 확인 결과를 연결한다. 이 소스에는 Ordering/Billing 사이의 호출이나 필수 보장이 없으므로 일반적인 주문·결제 연관성만으로 의존성을 만들지 않는다. 회원·항목 수 거절과 결제 실패도 보존한다. 맵의 가설을 확정된 도입 의도로 표현하지 않는다.",
      },
      {
        id: "approval",
        text: unresolved
          ? "decision-unknown은 어떤 기능에도 연결되지 않은 답변이다. 주문이나 결제의 승인으로 추정하지 않고 확인 질문만 남기며, 모든 턴에서 정식 ADR과 인덱스를 생성하지 않는다."
          : partial
            ? "두 번째 사용자 발화는 Ordering만 승인한다. Ordering의 현재 이유와 정확한 계약만 기록하고 Billing은 질문·저장을 보류한 상태로 남긴다. 승인 범위를 전체 프로젝트로 확대하지 않는다."
            : "두 번째 사용자 발화 후 두 기능의 현재 이유와 정확한 계약을 기록하고 원래 도입 동기는 추측하지 않는다. 확인된 내용을 반복 질문하지 않고 검증을 이어간다.",
      },
      {
        id: "contract",
        text: "주문의 회원·1~3개·접수됨에서만 확정 규칙을 보존한다. Billing이 승인된 경우 실패 시 미완료와 완료 후 반복 결과 보존을 기록한다. 외부 중복 청구 방지나 새로운 정책을 발명하지 않는다.",
      },
      {
        id: "repeat",
        text: "동등 재실행에서 공식 ADR·인덱스·날짜·상태를 변경하지 않는다. 새 문서는 Proposed이며 코드 존재만으로 Accepted가 되지 않는다. 완료·보류 보고는 실제 파일과 승인 범위에 일치한다.",
      },
    ],
    verifyEvidence: (evidence) => verifyImportExecution(evidence, domains),
  };
}

export const importExecutionCases = [scenario(false), scenario(true), scenario(false, true)];
