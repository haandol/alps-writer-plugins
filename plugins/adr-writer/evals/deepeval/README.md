# DeepEval 기반 ADR 스킬 회귀 평가

`adr-sync`와 `adr-rollup`을 실행하고, **DeepEval의 `GEval`과 `evaluate()`가 실제
실행 결과를 판정**한다. 기존 자체 채점 결과를 DeepEval 점수로 포장하지 않는다.

역할은 다음처럼 나뉜다.

| 역할                         | 담당                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| 고정 사례·평가용 저장소      | EncBird·Pixelbank를 참고한 11개 fixture                    |
| 스킬 실행과 증거 수집        | 격리된 MCP 도구 + Claude Code 실행 어댑터                  |
| 평가 사례                    | DeepEval `LLMTestCase` — 한 스킬 실행 전체가 한 사례       |
| 평가 프롬프트·점수·기준 판정 | 실제 DeepEval `GEval(strictMode: true)` + `evaluate()`     |
| LLM 제공자 연결              | `DeepEvalBaseLLM` → Bedrock Converse, AWS `default` 프로필 |
| 결과                         | DeepEval 원본 JSON + 버전별 비교 HTML                      |

사람이 사례를 하나씩 수동 테스트하는 방식이 아니다. 실행·증거 수집·평가·리포트 작성은
자동화되어 있고, 사람은 실패 이유와 중요한 판정 근거를 검토한다.

## 실행

저장소 루트에서 `pnpm install`을 먼저 수행한다. 스킬 실행은 로그인된 Claude Code
CLI를 사용한다. DeepEval 판정은 Bedrock의 `us.openai.gpt-5.6-sol`을 AWS `default`
프로필, `us-east-1` 리전으로 호출한다. 해당 프로필에 모델 호출 권한이 필요하고 실제
호출 비용이 발생한다.

```bash
# 기본 명령과 명시적 DeepEval 명령은 같은 진입점이다
pnpm eval:regression --list
pnpm eval:deepeval --list

# 모델 호출 없이 fixture와 미실행 리포트 준비
pnpm eval:regression --prepare

# 스킬 실행 → 증거 수집 → DeepEval 판정 → HTML/JSON
pnpm eval:regression --live --jobs 2 --runs 1

# 수정 전후 비교: 현재 작업 트리와 이전 Git ref
pnpm eval:regression --live --baseline HEAD --jobs 2 --runs 1

# 이미 실행한 결과를 재사용: 스킬을 다시 실행하지 않고 DeepEval만 호출
pnpm eval:deepeval --live --from .codex/evals/captured-run --jobs 2

# 수집된 증거를 DeepEval 입력으로 변환하되 아직 채점하지 않음
pnpm eval:deepeval --prepare --from .codex/evals/captured-run
```

`--from`에는 기존 `results.json`과 `runs/.../evidence.json`이 있는 폴더를 지정한다.
기준·후보 쌍이 모두 수집된 결과만 받아들인다. 이전 자체 판정 점수·이유는 DeepEval
입력에서 제외하고 원본·최종 파일, 실제 도구 사건, 사용자 대화와 기대 동작만 사용한다.

`--from`이 없으면 수집기가 `--capture-only`로 실행되어 자체 LLM 판정을 건너뛴다.
따라서 새 실행에서는 자체 판정과 DeepEval을 이중 호출하지 않는다.

`--model`은 Claude Code가 실행하는 스킬 모델이며 DeepEval 판정 모델에 영향을 주지 않는다.
판정 기본값은 아래와 같고, 다른 작업의 `AWS_PROFILE`이나 정적 환경 자격 증명보다
명시적으로 선택한 프로필을 사용한다.

| 옵션               | 기본값                  |
| ------------------ | ----------------------- |
| `--judge-provider` | `bedrock`               |
| `--judge-profile`  | `default`               |
| `--judge-region`   | `us-east-1`             |
| `--judge-model`    | `us.openai.gpt-5.6-sol` |

기존 Claude Code 판정기는 `--judge-provider claude`로 명시적으로 선택한다.
Bedrock 오류 시 다른 모델이나 제공자로 자동 전환하지 않는다.
Bedrock 기록에는 요청한 추론 프로필 ID와 토큰 사용량을 담는다. 응답이 실제 하위 모델
버전을 반환한다고 가정하지 않으며, 금액을 모르는 호출은 무료로 표시하지 않는다.

`--reference-date`는
새 실행에서 사용할 날짜를 고정하며 이미 수집한 결과의 날짜를 바꾸는 데 사용할 수 없다.
`--out`은 새 폴더 또는 빈 폴더여야 한다.

이전 자체 판정기를 명시적으로 실행하려면 아래 명령을 사용한다.

```bash
pnpm eval:custom --live --only sync-encbird-turn-units
```

## Golden set 보완과 판정기 보정

현재 세트는 rollup 7개·sync 4개, 총 11개다. R1·R3은 후속 승인문 이전의 첫 계획을
별도 의무로 판정한다. R5·R6은 정답 경로를 알려주지 않는 계획 발견, R7은 같은 폴더를
전부 합치자는 잘못된 제안의 거부를 평가한다. 계획의 오류를 나중의 승인문으로 가리지 않는다.

보상 fixture는 작업별 차감·보상 기록과 실패 후 재시도를 실행한다. 보존 fixture는
객체·메타데이터의 같은 90일 만료, 정리 순서, 만료 조회 제외, 128KB·30/90일 경계와
재접근을 실행한다. 실제 DB 동시성이나 클라우드 동작을 시험하는 것은 아니다.
S4의 `metadata`, `tiering`, `archive` 의무는 이 세부 조건을 명시적으로 판정한다.

`regression/provenance.json`은 참고 원본 12개 파일의 커밋·해시·구절을 고정한다.
각 사례의 `provenance`에도 포함되므로 실행 결과와 함께 추적할 수 있다. 새로 확인한
버전의 출처이며 최초 fixture 작성 당시의 원본 커밋을 소급해 주장하지 않는다.
원본 저장소가 없어도 사례 생성과 테스트는 가능하다.

```bash
# 현재 입력·발화·의무·고정 출처·Mermaid 커버 범위를 HTML로 생성
pnpm eval:golden --out .codex/reports/golden-current

# 작성된 정상·반례 입력과 판정 기대 초안을 내보냄: 모델 호출 없음
pnpm eval:calibration --prepare --out .codex/evals/calibration-prepared

# 판정기만 호출: 에이전트 재실행 없음
pnpm eval:calibration --live --jobs 2 --out .codex/evals/calibration-live
pnpm eval:calibration --live --split holdout --runs 3
```

판정기 보정 세트는 정상 표현과 통제된 반례 21개다. 기대 점수·라벨 상태·분할 정보는
GEval 입력에서 제외하고 판정이 끝난 뒤 비교한다. 원래 사례의 고정 의무는 그대로 쓴다.
같은 변경이 여러 의무에 영향을 줄 수 있으므로 반례에는 주된 대상 의무를 표시한다.
기준 산출물은 작성된 참조 행동이며, 승인 전 쓰기 반례의 시간 기록은 의도적으로 바꾼
합성 증거다. 실제 에이전트 로그라고 주장하지 않는다.

기대 라벨은 계약을 근거로 작성한 AI 초안이며 모두 `needs-human-review`다. 사람 검수
전에는 일치율을 사람 정답 정확도로 표시하지 않는다. development와 holdout은 출력
예시의 분할이고, 원래 사례를 공유하므로 독립적인 제품 사례의 일반화 검증은 아니다.
이 명령은 판정 프롬프트를 자동 최적화하거나 기대 라벨에 맞춰 점수를 고치지 않는다.
오통과·오거절·오류와 미채점 수를 분리하고 원본 증거·실제 GEval 입력·응답을 보관한다.
생성기 원문·fixture·의무를 해시에 포함해 서로 다른 기준 출력의 결과를 구분한다.

## DeepEval의 입력과 점수

완성된 정답 문서 한 편과 문장 유사도를 비교하지 않는다.

- `input`: 원래 문서·코드·테스트와 사용자 발화, 평가 기준일
- `actualOutput`: 최종 파일, 응답, 실제 도구 사건, 로컬 검사 출력
- `expectedOutput`: 각 사례의 고정된 의무 목록

실제 도구 사건에는 쓰기 요청 내용과 변경 전후 본문, 삭제·이동 내용, 실패한 요청도
포함한다. 처음과 마지막 파일이 같아도 중간의 무단 계약 변경을 구별할 수 있어야 한다.
입력 크기 제한을 넘으면 내용을 자르지 않고 평가 오류로 처리한다.

평가 단계는 고정해 두며 실행할 때 LLM으로 평가 단계를 새로 생성하지 않는다.
이 단계는 모든 의무를 확인하고, 구현에 맞춘 무단 계약 변경과 근거 있는 Status 수정을
구분하며, 실행자의 PASS 선언을 증거로 인정하지 않도록 지시한다.

`strictMode`의 기준은 1이다.

| 결과              | 의미                                              |
| ----------------- | ------------------------------------------------- |
| 1 / 충족          | 모든 의무가 증거로 확인됨                         |
| 0 / 미충족·미검증 | 적어도 하나가 위반됐거나 확인할 근거가 부족함     |
| 평가 오류         | 모델·스키마·SDK 오류, 범위 밖 점수, 누락된 metric |
| 실행 증거 부족    | 대상 실행이 끝나지 않아 평가 입력을 만들 수 없음  |

0은 곧바로 실제 위반을 증명하는 값이 아니다. GEval의 이유에서 위반과 근거 부족을
구분해 확인한다. 같은 모델 응답에서 점수·이유와 함께 의무별 PASS/FAIL/UNVERIFIED,
이유, 원문 인용을 받는다. 기존 자체 판정기와 공유하는 검증기로 의무 누락·중복,
존재하지 않는 근거와 인용문, 총점과 의무별 판정의 모순을 거절한다.
이 보조 검증은 추가 모델 호출 없이 수행하며 GEval이 받은 점수를 다시 계산해 덮어쓰지
않는다. 검증 실패는 평가 오류다. 인용이 실제 존재한다는 검증과 그 인용이 결론을
논리적으로 증명하는지는 구분해야 한다.

의무별 원본 응답은 `model-response-*.json`에 남고, DeepEval 원본 metric과 결과는
기존 파일에 보존한다. 이전 자체 판정기의 점수와 섞어서 전후 차이를 계산하지 않는다.
DeepEval 양쪽 결과끼리만 비교한다.

현재 TypeScript SDK는 오류 metric의 `success`가 비어 있을 때 최상위 `success`만으로는
성공처럼 보일 수 있다. 이 어댑터는 `metricsData`의 오류·skipped·score·strictMode·threshold를
확인하므로 해당 결과를 PASS로 표시하지 않는다.

기준 1 → 후보 0은 회귀 **의심**, 기준 0 → 후보 1은 개선 관찰이다. 모델이나 날짜가
다르면 비교 불충분이며, 스냅샷이 같으면 동일 스냅샷 반복이다. 단일 실행으로 인과관계나
모든 입력의 정상 동작을 보장하지 않는다.

## 리포트

기본 출력은 Git에서 제외된 `.codex/evals/` 아래다.

HTML에는 전체 평가 흐름, `adr-rollup`, `adr-sync`의 Mermaid 도표 3장이 들어간다.
각 업무 단계에 R1–R4·S1–S4 사례 코드를 표시하고, 단계별 표에서 해당 사례의 평가
의무와 실제 결과로 연결한다. 색은 명시 의무·일부 조건·별도 eval 없음·이번 선택에
없음을 구분한다. GEval은 사례 전체를 채점하므로 이 색을 단계별 PASS로 읽으면 안 된다.
단계 연결은 보고서용 파생 정보이며 평가 프롬프트에는 들어가지 않는다.

이미 채점된 결과의 도표와 HTML만 다시 만들 때는 다음 명령을 사용한다. 스킬 실행과
LLM 채점을 반복하지 않으며 기존 점수·증거·평가 시각을 유지한다.

```bash
pnpm eval:report .codex/evals/deepeval-prompt-comparison-final
open .codex/evals/deepeval-prompt-comparison-final/index.html
```

도표 생성은 고정 버전 Mermaid CLI와 별도 headless Chrome 프로세스를 사용한다.
설치된 Chrome·Edge·Chromium을 찾으며 필요하면 `MERMAID_BROWSER_PATH`에 실행 파일을
지정한다. 찾지 못하면 Puppeteer의 설치된 브라우저를 사용한다. 사용자의 열린 탭에는
연결하지 않는다. 원문과 SVG는 `coverage/`에 저장하고 HTML에도 함께 포함하므로,
생성된 리포트는 인터넷 연결이나 브라우저용 라이브러리 설치 없이 열 수 있다.

| 파일                              | 내용                                                 |
| --------------------------------- | ---------------------------------------------------- |
| `index.html`                      | DeepEval 점수·이유, 버전별 비교, 실제 실행 증거 링크 |
| `deepeval-results.json`           | DeepEval이 반환한 원본 `testResults`                 |
| `results.json`                    | 사례·버전·모델·비용과 출력 경로를 붙인 결과          |
| `cases/.../test-case.json`        | 실제 DeepEval 평가 입력                              |
| `cases/.../evidence.json`         | 수정하지 않은 스킬 실행 증거                         |
| `cases/.../deepeval-result.json`  | 해당 `evaluate()` 호출의 원본 결과                   |
| `cases/.../model-response-*.json` | 모델 어댑터 응답과 사용량                            |

출력된 HTML 경로를 `open`으로 열면 된다. HTML에는 별도 서버·빌드·외부 자산이 필요 없다.
Confident AI 업로드, 자동 dotenv 로드, 텔레메트리, 추적 전송은 실행 프로세스에서
비활성화한다. 사용자의 저장된 설정이나 로그인은 변경하지 않는다.
LLM 판정에 필요한 입력은 기존에 설정된 모델 제공자로 전송된다.

## 설치·호환성과 테스트

DeepEval TypeScript `0.9.16`과 Zod를 개발 의존성으로 고정한다. 일반 플러그인 설치와
MCP 서버 실행에는 이 평가 의존성이 필요하지 않다.

이 DeepEval 배포본에는 과거 `dist/telemetry.js`가 최신 `dist/telemetry/index.js`를
가리는 패키징 문제가 있다. `patches/deepeval@0.9.16.patch`는 구 진입점이 기존 최신
모듈을 다시 내보내도록만 수정한다. GEval의 프롬프트·점수·판정 코드는 수정하지 않는다.
초기에 보였던 Sentry 모듈 누락 역시 이 구 진입점에서 발생하며, 별도 Sentry 의존성을
추가하지 않고 진입점 충돌을 고쳐 해결한다.

Zod 4의 기본 JSON Schema 2020-12 대신 두 어댑터에 draft-7 형태로 전달한다.
Bedrock에는 JSON 형식 지시를 보내고 반환값을 원래 Zod schema로 검증한다. 네이티브
강제 출력 기능을 사용하지 않는다. 잘린 출력, JSON 오류, 도구 요청, 스키마 위반은
평가 오류로 처리한다. 형식 변환은 평가 기준을 바꾸지 않는다.

```bash
pnpm test:deepeval
pnpm test
```

`test:deepeval`은 실제 DeepEval SDK를 쓰되 LLM 제공자만 stub으로 대체한다. 실제 GEval
호출·strict 판정·오류 오통과 방지·입력 분리·리포트 escaping을 검사한다. 네트워크
모델 평가를 대신하지는 않는다. 이 테스트는 workspace 의존성이 설치되는 `pnpm test`에
포함되며, 설치 없이 실행하는 adr-writer의 기본 런타임 테스트와는 분리돼 있다.

공식 API 근거: `confident-ai/deepeval`의 TypeScript `GEval`, `evaluate`,
`DeepEvalBaseLLM` 문서와 배포 패키지의 타입·구현을 확인했다.

## Human report delivery

Apply `../../skills/report-write/SKILL.md` to the final human-facing report.
The generated HTML and JSON preserve the original evaluation evidence; when the
HTML uses the legacy layout, keep it as an audit source and compose a separate
domain-scoped final report. Preserve every case, obligation, score, reason,
run count, model, limitation, and coverage diagram. Do not treat a successful
renderer command as editorial or visual review. This presentation step does not
rerun the target skill or invoke a paid judge.
