# 자체 판정기 기반 rollup / sync 평가 (이전 경로)

현재 기본 `pnpm eval:regression`은 [DeepEval 경로](../deepeval/README.md)다.
이 문서는 비교·디버깅용으로 보존한 `pnpm eval:custom` 경로를 설명한다.

스킬 프롬프트를 수정한 뒤에도 기능이 유지되는지, **고정 fixture에서 실제 스킬을 실행하고
LLM이 산출물과 행동을 읽어 판정**한다. EncBird·Pixelbank의 ADR과 구현을 참고한 기본
사례 11개가 들어 있다.

평가 대상에는 정답 태그나 EVAL tail을 요구하지 않는다. 실행 에이전트는 문서를 읽고,
사용자와 주고받고, 실제 fixture 문서를 수정한다. 별도 LLM 판정은 변경 전후 파일,
대화, 도구 요청·결과를 고정된 기대 동작과 대조한다.

## 시작하기

저장소 루트에서 실행한다. Node.js 24 이상과 Git이 필요하다. 모델 실행에는 로그인된
Claude Code CLI가 필요하며 기존 설정의 제공자와 인증을 사용한다. Bedrock 로그인도
그대로 사용한다. OpenAI API 키나 새 평가 프레임워크는 필요하지 않다.

```bash
# 무료: 사례 목록
pnpm eval:custom --list

# 무료: 11개 임시 저장소와 미실행 HTML 리포트 생성, 실제 로컬 테스트·ADR lint 확인
pnpm eval:custom --prepare --out .codex/evals/adr-fixtures

# 실제 LLM 호출: 한 사례로 실행 연결 확인
pnpm eval:custom --live --only sync-encbird-turn-units --runs 1

# 실제 LLM 호출: 전체 기본 세트
pnpm eval:custom --live --runs 1

# 프롬프트 변경 후: HEAD의 스킬과 현재 작업 트리 스킬을 같은 사례에서 비교
pnpm eval:custom --live --skill adr-rollup --baseline HEAD --runs 3

# 기준 버전은 커밋·브랜치·태그를 지정할 수 있다
pnpm eval:custom --live --skill adr-sync --baseline main --runs 3
```

`--live`가 없으면 모델을 호출하지 않는다. 결과 경로를 지정하지 않으면
`.codex/evals/adr-regression-<시각>/`에 저장하고, 지정한 `--out`은 새 폴더나 빈 폴더여야 한다.
기존 결과를 덮어쓰지 않는다. 출력된 `index.html`을 `open`으로 열면 된다.

`--model`과 `--judge-model`로 실제 CLI 모델을 명시할 수 있다. 생략하면 로컬 기본값을
사용하며 CLI가 반환한 모델 식별자·사용량·비용을 결과에 기록한다. 비교할 때는 동일한
실행·판정 모델을 사용한다. `--timeout 300`은 **각 CLI 호출**을 최대 300초로 제한한다.
한 사례에 여러 사용자 발화와 판정 호출이 있으므로 전체 사례의 시간 상한과 다르다.

`--jobs 2`는 서로 다른 사례 두 개를 동시에 실행한다(기본 1). 같은 사례의 기준 버전과
후보 버전은 순서대로 실행한다. `--reference-date 2026-09-19`처럼 기준일을 지정하면
두 버전에 같은 날짜를 제공한다. 생략하면 실행 시작 시 로컬 달력 날짜를 한 번 고정한다.
실제 호스트의 시간대나 시스템 시계는 변경하지 않는다.

다른 체크아웃의 스킬을 평가하려면 `--candidate-root <adr-writer 플러그인 폴더>`를
사용한다. `--baseline`은 이 저장소의 Git ref에서 스킬·에이전트 지침·참조·스크립트·템플릿을 읽는다.
두 버전은 실행 시작 때 각각 복사해 고정한다. fixture·기대 동작·판정 기준은 공유한다.

기존 `evals/run.mjs --changed`는 이 별도 회귀 세트를 실행하지 않는다. 이번 경로는
`pnpm eval:custom`으로 명시적으로 실행하며 `--skill` 또는 `--only`로 범위를 고른다.

## 사례와 참고 범위

| 사례                                     | 검증할 기능                                                            | 참고                                 |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `rollup-encbird-turn-chain`              | 실제 8→5턴 이력, 음성 6턴·시드 단위, 독립 메모리 결정, 승인 후 통합    | EncBird FreeChat·PictoChat·변경 이력 |
| `rollup-pixelbank-independent-decisions` | 같은 token 카테고리의 보상·중복 전달을 합치지 않음                     | Pixelbank 무료권 보상·소비 멱등성    |
| `rollup-pixelbank-price-renumber`        | 신규 생성 20→15, 최초 과금액 환불, 흡수와 재번호의 서로 다른 참조 방향 | Pixelbank 가격 변경 이력             |
| `rollup-encbird-withheld-approval`       | 통합 이력이 있어도 승인 보류 시 아무 파일도 변경하지 않음              | 첫 사례와 같은 fixture의 반대 조건   |
| `sync-encbird-turn-units`                | 실제 텍스트 5턴과 시드 포함 저장 상한 6을 잘못된 drift로 보고하지 않음 | EncBird 모드별 턴 카운팅 코드        |
| `sync-encbird-forward-only-drift`        | 코드에 심은 자동 환불을 ADR의 계약으로 조용히 승격하지 않음            | EncBird 주문 전진 복구               |
| `sync-pixelbank-compensation-cleanup`    | 변경 서술·구현 상세를 정리하되 무료권·중복 보상·주요 이유는 보존       | Pixelbank 보상 변경 이력             |
| `sync-pixelbank-retention-local`         | 생성 입력 90일과 영구 자산의 구분, 로컬 증거와 운영 상태 미검증        | Pixelbank 자산 보존 ADR·IaC 테스트   |

`cases.mjs`는 기대 동작·사용자 발화·참고 경로·변형 이유를, `fixtures.mjs`는 의존성 없는
작은 구현과 실행 가능한 테스트를 담는다. 실제 저장소를 복사하거나 마운트하지 않으며
실행 시 두 참고 저장소가 없어도 된다.

다음 차이를 유의한다.

- **합성 fixture**다. 실제 제품의 모든 결정·의존성·과거 상태를 그대로 재현하지 않는다.
- 일부 이력은 rollup을 평가하도록 다시 여러 ADR로 나눴다.
- `forward-only-drift`의 자동 환불 코드는 의도적으로 심은 위반이며 원본 구현의 결함을
  발견했다는 뜻이 아니다.
- Pixelbank 무료 횟수 표에는 코드 상수에 위임하는 문장이 있어, 표의 숫자를 새로운 고정
  계약으로 승격하지 않았다. 무료권 실패 복구·중복 보상 계약만 가져왔다.
- 원문 프로젝트의 모듈 구조·고객 데이터·인증 정보·외부 제공자 호출은 가져오지 않았다.
  fixture의 Node 코드는 평가용으로 다시 작성했다.

## 실제 동작을 관찰하는 방법

Claude Code는 `--bare`와 명시적인 MCP 설정으로 실행하고 내장 도구는 끈다. 평가용
MCP 서버가 아래 동작만 제공한다.

- fixture와 선택한 플러그인의 파일 읽기·검색
- fixture의 `docs/` Markdown·JSON 생성·수정·삭제·이동
- 읽기 전용 ADR lint·invariant·로컬 정책 테스트 실행과, 별도 `demote_adr_status` 도구의 명시적인 Proposed 상태 변경
- 실제 원격 접속 없이 요청만 기록하고 거절하는 `inspect_runtime`

소스·테스트·기본 규칙·플러그인·fixture 바깥 경로는 쓰지 못한다. 임의 shell은 제공하지
않는다. 삭제도 임시 fixture 문서에 한정한다. 모든 쓰기 요청과 결과는 파일 변경 전후
내용과 함께 기록하므로 승인 전 바꿨다가 되돌린 행동도 남는다.

스킬의 `Glob/Grep/Read`, `git mv`, 로컬 검증 명령은 이 도구들의 동등한 기능으로
수행한다. 이 환경에 없는 필수 행동은 성공으로 추정하지 말고 미검증으로 남겨야 한다.

여러 발화는 앞선 사용자·응답·관찰 사건을 다음 호출에 재전달하는 **conversation replay**
다. 실제 CLI의 resume·컨텍스트 압축·자동 메모리를 시험하는 것은 아니다. 기대 동작과
판정기 입력은 실행 에이전트가 읽을 수 있는 fixture 밖에 둔다.

## 결과와 판정

각 실행의 결과는 다음 파일에 남는다.

| 결과                                           | 내용                                                |
| ---------------------------------------------- | --------------------------------------------------- |
| `index.html`                                   | 사례별 판정·실패 이유·증거 인용·전후 파일·모델 응답 |
| `results.json`                                 | 전체 실행 조건, 해시, 실행별 결과                   |
| `runs/<case>-<version>-<repeat>/evidence.json` | 원본·최종 파일, 실제 도구 사건, 대화                |
| 같은 폴더의 `judge-response.json`              | LLM 판정 원문과 사용량                              |
| 같은 폴더의 `result.json`                      | 해당 실행의 정규화 결과                             |
| `fixtures/`                                    | `--prepare`로 만든 독립 실행 가능한 저장소          |

의미 판정은 모든 필수 의무가 증명됐을 때 PASS다. 하나라도 위반이 증명되면 FAIL,
위반을 확인하지 못했더라도 필수 근거가 부족하면 UNVERIFIED다. 없는 의무·중복 의무,
누락 판정, 실제로 존재하지 않는 증거 인용은 `GRADER_ERROR`로 분리한다. 실행 도구
실패는 `ERROR`다.

판정의 JSON 형식이나 증거 인용 검증이 실패하면 같은 증거·기준으로 출력 수정을 한 번만
요청한다. 각 응답과 검증 오류는 `judge-response-1.json`, `judge-response-2.json` 및
`judgeAttempts`에 남는다. 유효한 FAIL/UNVERIFIED 판정이나 인증·제공자 오류는 이 경로로
재시도하지 않는다. 로컬 검사 출력은 `event:N:stdout` 같은 별도 원문 출처로 제공해
중첩 JSON 이스케이프를 추측해서 인용할 필요가 없게 한다.

비교는 PASS→FAIL을 회귀, FAIL→PASS를 개선, FAIL→FAIL을 기존 실패로 보여준다.
기준 버전이 없거나 한쪽이 미검증·오류이면 정상 유지라고 주장하지 않는다.
실제 반환된 실행·판정 모델 식별자가 다르거나 빠져도 비교 불충분으로 표시한다.
스킬·참조·스크립트 스냅샷이 동일하면 결과 차이를 프롬프트 회귀나 개선으로 부르지 않고
동일 스냅샷의 반복 결과로 표시한다.
미실행·미채점 횟수도 함께 보며, 사용량을 얻지 못한 호출의 비용은 미측정으로 남긴다.

정답 문장이나 기대 태그를 찾는 정규식으로 의미를 채점하지 않는다. JSON 형식·증거
존재·링크·파일·실행 오류는 결정적으로 확인하고, 결정 정체성·조건·권한·시점·내용
보존은 LLM이 읽는다. 동일 모델을 쓰더라도 실행과 판정 문맥은 분리한다.

`exit 0`은 준비 성공 또는 최소 하나의 의미 채점 완료를 뜻하며 FAIL도 포함한다.
`exit 2`는 사용법·환경 오류 또는 모든 live 실행이 채점 불가였음을 뜻한다. 기존
행동 평가 ADR에 따라 이 명령을 live 품질 CI 차단으로 바로 쓰지 않는다.

## DeepEval / LLMEval이 필요한가?

이번 범위에는 필수가 아니다. DeepEval의 GEval도 자연어 기준으로 출력물을 판단하며
평가 실행·데이터·여러 metric·플랫폼 연동을 제공한다. 그 기능을 도입해도 **어떤 ADR
변경이 정상인지에 대한 기대 동작과 실제 파일·승인 증거 수집**은 별도로 설계해야 한다.

현재 저장소는 Node 기반 시나리오·실행 도구와 로컬 CLI 인증을 이미 사용하므로 같은
환경에 의미 판정과 HTML/JSON을 붙였다. 팀 대시보드, 대규모 데이터 관리, 다양한 metric
운영이 필요해지면 `evidence.json`과 판정 결과를 프레임워크 어댑터에 연결할 수 있다.
실행·도메인 기대 동작·리포트를 외부 서비스에 묶지 않는다.

`LLMEval`이라는 이름은 여러 프로젝트가 사용하므로 특정 제품과 비교하려면 정확한
저장소를 먼저 식별해야 한다. 이 세트는 그중 하나를 추측해 의존성으로 추가하지 않는다.

공식 문서 확인: DeepEval의 `GEval` / `evaluate` / agent evaluation 문서
(`confident-ai/deepeval` 저장소). 외부 검색은 Context7과 DuckDuckGo를 사용했다.

## 검증 범위와 보관

`pnpm test`는 fixture의 실제 테스트·lint, 경로 격리, 도구 사건 기록, 판정의 의무와 증거
검증, report escaping, MCP stdio 연결을 모델 없이 검사한다. 이 통과는 live 스킬
성공률이나 LLM 판정기의 의미 정확도를 대신하지 않는다. 중요한 live 실패는 인용
증거를 사람이 확인한다.

현재 세트에는 아직 사람이 라벨링한 독립적인 판정기 보정 집합, 모든 계획 사례,
native CLI resume·장문 압축 평가는 포함하지 않았다. 결과의 적용 범위를 이 기본
세트와 사용한 실행 환경으로 제한한다.
평가 기준일은 한 번 정해 두 버전의 모든 발화에 동일하게 전달한다. 모델이 작성한 모든 날짜의 정확성을 자동 판정하는 별도 metric은 아직 없으므로 결과의 날짜 필드는 증거와 함께 확인한다.

첫 계획 전용·잘못된 통합 제안의 거부 사례와 출처 고정, 21개 초안 판정기 보정 세트는
[현재 DeepEval 안내](../deepeval/README.md)의 Golden set 보완 절을 참고한다.

fixture·기대 동작·판정 프롬프트는 버전 관리하고, 실행 원문·승인 사건·평가 결과는
일시적인 로컬 관찰 자료로 둔다. 기본 출력은 Git에서 제외된 `.codex/` 아래다. 결과를
공유하기 전 내용과 경로를 확인하며 원본 고객 세션을 그대로 넣지 않는다.

## Human report delivery

For a final human-facing report, apply `../../skills/report-write/SKILL.md`.
Keep generated evidence and the original HTML as audit sources; organize the
final explanation by domain with at most four peer units, complete evidence
links, and inspected Mermaid diagrams. State the actual semantic and visual
review scope. A successful render alone does not complete that review.
