# ADR 스킬 3종 관점 정합성 — 검토 결과와 수정 계획

`/adr-new`(작성) · `/adr-impl-review`(구현 후 리뷰) · `/adr-review`(문서 리뷰) 세 스킬과 그 하위 에이전트가
같은 핵심 요소·같은 관점을 공유하는지 점검한 결과와, 그에 따른 수정 항목.

- 대상 플러그인 버전: **adr-writer 0.6.2** (최초 검토 시점 0.4.31)
- 규칙 원본: `plugins/adr-writer/templates/adr/` 의 `concepts.md`(원리·의존모델·Status), `authoring-rules.md`,
  `structure.md`, `README.md`(인덱스)
- 이 문서는 유지보수자용 작업 계획이라 한국어로 적는다. 배포되는 harness 프롬프트(`skills/`, `agents/`)는
  기존 규약대로 영어를 유지한다.

> **진행 상황 (2026-08-15 갱신, adr-writer 0.6.2)**
>
> 아래 2절의 진단은 최초 검토 시점 기준이다. 그 뒤 **추상화 레벨 원리를 정본화하는 작업**을 진행하면서
> ①②③이 함께 해소됐고, seed 문서가 `README.md`(인덱스) / `concepts.md`(동작 방식)로 분리됐다.
>
> | 항목                             | 상태                                                                         |
> | -------------------------------- | ---------------------------------------------------------------------------- |
> | ① R 번호 체계 (R18/R19/R20 공백) | **완료** — sufficiency reviewer를 `R1–R16, R19–R20`으로 수정 + R18 방향 분할 |
> | ② 재생성 테스트 명칭 부재        | **완료** — 게이트 Q3를 "사람에게 묻는 재생성 테스트"로 명명                  |
> | ③ necessity reviewer 규칙 미인용 | **완료** — Input에 규칙 문서 추가, step 1을 해상도 판정으로 규정             |
> | ④ impl-review의 rules-doc stale  | **완료** — step 1 준비물에 규칙 문서 + review limits에 lag 기록              |
> | ⑤ 문서 축 미판정 verdict         | **완료** — Scope에 `Unjudged axes` 줄 (verdict 3값은 유지)                   |
> | ⑥ decision-log 라우팅 누락       | **완료** — 로그 1줄 + 소유 커맨드 명시 (Status 복귀는 불필요)                |
> | ⑦ 문서 축 confidence             | **완료** — high/medium/low, validator와 동일 척도 (반증 강도 상향은 보류)    |
> | ⑧ edit-in-place 소유자           | **완료** — 진단이 틀렸음. 소유자는 이미 존재했고 라우팅 문구만 문제였다      |
> | ⑨ 추상화 레벨 원리 부재          | **완료** — 아래 4절                                                          |
> | ⑩ ADR 생성 경계 부재             | **완료** — admission gate로 구현 수단을 ADR 생성·동기화·리뷰 대상에서 제외   |

---

## 1. 세 스킬이 공유해야 하는 관점 (축 A–L)

| #   | 축                                             | 정의                                                                                                                | `/adr-new`                    | `/adr-impl-review`                                                 | `/adr-review`                              |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| A   | **재생성 테스트 (R19)**                        | 코드가 전부 사라지고 ADR만 남아도 요구사항을 지키는 코드를 다시 만들 수 있는가                                      | 초안 후 스스로 통과 (step 3)  | 스펙 자체의 충분성 = 사람 게이트 Q3                                | R19로 판정                                 |
| B   | **요구사항 게이트 + 2필터 (R4)**               | 요구사항이면 무조건 남기고, 아니면 코드 통독 → 리트머스로 걸러낸다                                                  | 무엇을 적을지의 기준          | 삭제 후보 판단의 하한선                                            | 추상화 레벨 판정                           |
| C   | **요구사항 계약 보존 (R18)**                   | 숫자 요구값 + 비숫자 요구사항(허용 집합·필수·권한·순서·단위)은 축어적으로, 튜닝값은 배제                            | 값과 근거를 수집·기록         | ADR 값 ↔ 코드 값 1:1 대조                                          | 누락(FIX) / 침입(권고) 양방향              |
| D   | **enum 분할 규칙**                             | 허용 집합·전이 규칙 = ADR 권위 / 식별자 이름·표현 = 코드 권위                                                       | 도메인 문장으로 기록          | 집합 불일치 = `Spec violation`, 이름 불일치 = `Impl-fact mismatch` | R18 내 분기                                |
| E   | **그레이존 실질 (R12)**                        | 채택 근거 / 비즈니스 규칙→시스템 동작 / 도메인 규칙·상태 전이 / 외부 의존 폴백                                      | 본문의 무게중심               | 결정 원장(ledger) 행의 출처                                        | R12 판정 + 세트 취약점                     |
| F   | **수직 슬라이스 & 카테고리 (R5)**              | 컨텍스트 × 피처, UI → API → Data 한 슬라이스                                                                        | Decision을 한 슬라이스로 서술 | 코드가 레이어별로 흩어졌는지                                       | 카테고리 경계·중복                         |
| G   | **의존 방향 / 상호 참조 금지 (R2·R7·R15·R17)** | PRD → ADR → 코드 단방향, 양쪽 다 서로를 가리키지 않음                                                               | 폴더 레벨까지만, PRD 미참조   | R17을 D6에서 코드 쪽에서 점검                                      | R1 코드-현실 / R17은 범위 밖 → `/adr-sync` |
| H   | **ADR 우선 변경 순서 + decision-log**          | 요구사항이 바뀌면 ADR → 코드 순서, major는 로그 1줄                                                                 | 로그 seed 배치                | `Decision changed in code` 분기                                    | 모순 판정 후 로그 라우팅                   |
| I   | **Status 자동 전이 (R1)**                      | Proposed → Accepted는 사람이 정하지 않음                                                                            | 항상 Proposed                 | 부분 구현 여부만 확인                                              | enum·날짜 형식은 harness                   |
| J   | **문체·다이어그램 (R20 + Mermaid-first)**      | 능동태·군더더기 제거, 단 내용 삭감은 결함                                                                           | 작성 시 적용                  | 산출물 다이어그램 규칙                                             | 세트 단위 1건으로 묶어 권고                |
| K   | **프로세스 불변식**                            | harness 먼저 → 판단 규칙만 LLM / 격리 컨텍스트 / 증거 우선 / 보고 전용 / 숫자를 발명하지 않음 / 규칙 문서 staleness | step 6 2-stage                | 3-agent 격리 + 모델 다양화                                         | harness 1회 + ADR당 1 에이전트             |
| L   | **ADR admission gate (R12)**                   | 요구사항 계약·경계·지속적 트레이드오프만 ADR로 올리고 교체 가능한 SDK·라이브러리·인증 연결은 코드에 둔다            | 파일 생성 전에 판정           | `Undecided behavior` 승격 전에 판정                                | 저수준 ADR은 폐기 권고                     |

### 이미 잘 정렬된 부분 (수정 불필요)

C·D·E·G(코드측)·I·K·L의 핵심부는 세 계통이 같은 어휘로 반복하고 있다. 특히 "요구값을 지우게 만드는 것이
가장 비싼 오진"이라는 방어 문구가 작성·문서리뷰·구현리뷰 3계통 모두에 심겨 있다.

- `skills/adr-new/SKILL.md:45` — 숫자가 아닌 요구사항까지 항상 한 번은 묻게 강제
- `agents/adr-reviewer.md:84` — R18 (a)누락 / (b)침입 양방향, 불확실하면 남기는 쪽
- `agents/adr-impl-necessity-reviewer.md:27` — 계약 집행 코드는 삭제 후보가 될 수 없음
- `agents/adr-impl-sufficiency-reviewer.md:67` — 값·집합 1:1 대조, enum 분할
- `agents/adr-impl-review-report-writer.md:140` — Contract compliance 를 기능 충족성과 분리된 축으로
- `templates/adr/concepts.md` "ADR admission gate" — ADR 존재 여부를 문장 필터보다 먼저 판정

---

## 2. 정렬이 깨진 지점 8건

### ① R 번호 체계가 impl 계통에서 낡음 — R18/R19/R20이 무주공산

`agents/adr-impl-sufficiency-reviewer.md:13`, `:198` 이 "ADR **문서** 품질 규칙(R1–R16)은 재검토 금지,
R17만 예외"라고 규정한다. 그런데 규칙 세트는 이미 **R1–R20**이다
(`skills/adr-review/SKILL.md:3`, `agents/adr-reviewer.md:86`).

문자 그대로 읽으면 R18(요구사항 보존)·R19(재생성)·R20(문체)은 금지 대상도 담당 대상도 아닌
회색지대에 놓인다. 의도는 명확하다 — R18은 _ADR이 적었는가_(adr-reviewer)와
_코드가 그 값으로 집행하는가_(sufficiency reviewer의 Contract compliance)로 나뉜다. 그러나 그 분담이
문장으로 없어서, 서브에이전트가 R18a 누락을 발견했을 때 "문서 규칙이니 침묵"인지 "스펙 결함이니
사람에게 올림"인지 판단할 근거가 없다.

### ② "재생성 테스트"라는 이름이 impl 계통에 한 번도 등장하지 않음

`grep -c regeneration` 결과: `skills/adr-impl-review/SKILL.md` 0건, impl 계열 에이전트 4개 전부 0건.

그런데 `skills/adr-impl-review/SKILL.md:73`의 사람 게이트 Q3("이 ADR 결정 자체가 진짜 사용자 문제를
담고 있는가, 빠진 요구사항·리스크는 없는가")는 **R19를 사람에게 묻는 것과 같은 질문**이고,
`agents/adr-impl-review-report-writer.md:140`도 "ADR 자체의 누락으로 보이면 오너에게 질문을 남겨라"로
같은 축을 다룬다. 이름이 공유되지 않아 게이트에서 사람이 무엇을 기준으로 판단해야 하는지
(= 계약이 완전한가)가 축 A의 정의와 연결되지 않는다.

### ③ necessity reviewer만 규칙 문서를 전혀 인용하지 않음

`agents/adr-impl-necessity-reviewer.md`에 `authoring-rules.md` / `README.md` / `structure.md` 인용이
**0건**. 대신 `:27`에서 "요구값은 계약", "비숫자 요구사항도 동일"을 자기 산문으로 **재서술**한다.

- sufficiency reviewer: `:34`에서 세 문서를 읽음
- adr-reviewer: `:30-33`에서 섹션 단위로 읽음 (스윕 비용 때문에 선택적 로드)
- necessity reviewer: 인라인 사본

규칙 문서에 요구사항 범주가 하나 추가되면(예: 감사 로그 보존 기간) 이 사본만 조용히 낡는다.
그리고 이 에이전트의 오진은 "계약을 집행하는 코드를 삭제 후보로 올리는 것", 즉 플러그인이
가장 비싸다고 규정한 실패다.

### ④ 규칙 문서 staleness가 impl 경로에서 미처리

`rules-doc-stale` 언급 분포:

| 파일                              | 처리                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `skills/adr-new/SKILL.md:33`      | refresh 제안 (hand-edit 보존 위해 항상 1회 질문)                   |
| `skills/adr-review/SKILL.md:85`   | **보고서 최상단** 배치, "N개 ADR 전부에서 그 축이 미판정" 논지까지 |
| `agents/adr-reviewer.md:35`       | 해당 규칙 findings를 advisory로 강등 + Notes 기록                  |
| `skills/adr-impl-review/SKILL.md` | **0건**                                                            |

그런데 sufficiency reviewer는 `:34`에서 그 문서들로부터 source-of-truth 범위와 enum 분할 규칙을 끌어온다.
낡은 리포에서는 구 규칙으로 구현을 심판하고도 보고서에 그 사실이 남지 않는다.
`/adr-review`가 "가장 큰 구멍"이라 명시한 것과 동일한 구멍이다.

### ⑤ verdict 어휘가 갈라짐 — 문서 축에 미판정 상태가 없음

| 계통                                      | verdict                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `/adr-new`, `/adr-review`, `adr-reviewer` | `PASS` / `FIX_REQUIRED` / `BLOCK`                     |
| `/adr-impl-review`, sufficiency reviewer  | `PASS` / `FIX_REQUIRED` / `INCONCLUSIVE` / `BLOCK`    |
| necessity reviewer                        | `PASS` / `FIX_REQUIRED` / `INCONCLUSIVE` (BLOCK 없음) |

문서 축에도 **실제로 미판정 상태가 존재한다.** `agents/adr-reviewer.md:35`는 리포 문서에 섹션이 없으면
해당 규칙 findings를 advisory로 표시하라 하고, `skills/adr-review/SKILL.md:95`도 어떤 규칙이 미판정됐는지
적게 한다. 그런데 `:100`의 집계는 `PASS · FIX_REQUIRED · BLOCK` 뿐이라 **R19를 판정할 수 없었던 ADR도
PASS로 집계**된다. impl-review가 `:190`에서 "미검증을 PASS로 바꾸지 말라"고 못 박은 원칙이 문서 축에는
적용되지 않는다.

### ⑥ decision-log 의무가 impl-review 라우팅에서 빠짐

`templates/adr/authoring-rules.md:97`은 "`/adr-impl`, `/adr-sync`, `/adr-impl-review`가 모두 같은 방향
(ADR 우선)을 강제한다"고 선언한다. 같은 문서 `:265`에 따르면 **채택 대안 교체·요구값 변경은 major →
로그 1줄 필수**다.

- `skills/adr-review/SKILL.md:132` — 기억함 ("변경된 ADR은 major면 decision-log.md 한 줄")
- `skills/adr-impl-review/SKILL.md:221` — `Decision changed in code` 라우팅이 "ADR 업데이트 vs 코드
  되돌리기, 사용자 결정"에서 끝남. `grep -c decision-log` → **0**

채택 대안 교체는 정의상 major인데, 그걸 가장 자주 발견하는 커맨드가 로그 의무를 안내하지 않는다.
Accepted ADR의 결정이 바뀌면 Status를 Proposed로 되돌린다는 `templates/adr/README.md:172` 규칙도
같이 빠져 있다.

### ⑦ 심사 강도의 비대칭 — 문서 축은 체크리스트, 구현 축은 반증

`/adr-impl-review`는 "승인하지 말고 **반증하라**"를 전제로 두 관점을 격리 병렬 실행하고,
`:102`에서 **다른 프로바이더 계열의 최상급 추론 모델**까지 요구하며 그 이유를 "같은 계열은 같은 결함을
함께 놓쳐 false consensus에 이른다"로 설명한다. 모든 finding에 `confidence` / `evidence` / `test` /
`testResult`를 강제하고 검증 스크립트 exit 0을 요구한다.

반면 문서 축은 **adr-reviewer 1회 단일 패스**이고, `agents/adr-reviewer.md:104-120`의 보고 포맷에
`confidence` 필드가 없다. 같은 파일 `:126`이 "형식만 단정한 빈 ADR이 가장 비싼 실패"라고 스스로
규정하면서도, 그 판정에는 반증 압력도 확신도 표기도 없다. 두 축의 엄격도 차이가 정당화되지 않은 채
남아 있다.

### ⑧ `/adr-new`는 edit-in-place 절차가 없는데 두 리뷰가 거기로 보냄

- `agents/adr-impl-sufficiency-reviewer.md:132` — `Decision changed in code` → "ADR 업데이트
  (edit-in-place vs supersede)"
- 같은 파일 `:133` — `Undecided behavior` → "`/adr-new` 또는 edit-in-place로 ADR에 결정 추가"
- `skills/adr-review/SKILL.md:130-132` — ADR 본문 직접 수정 지시

그런데 `skills/adr-new/SKILL.md`에 `edit-in-place` 언급이 **0건**이고, 절차 전체가 "새 번호를 부여해
새 파일을 쓴다"(step 3)로만 구성돼 있다. 기존 ADR을 현재 상태로 덮어쓰고 major면 로그를 남기고 Status를
되돌리는 경로를 **어느 스킬도 소유하지 않는다.** (`/adr-sync`·`/adr-rollup`이 부분적으로 하지만, 두 리뷰가
지목하는 대상은 그 커맨드가 아니다.)

**부수 비대칭**: `/adr-review`는 `/adr-impl-review`로 라우팅하는데(`:134`),
`/adr-impl-review`는 `/adr-review`를 **한 번도 언급하지 않는다**(에이전트 이름 `adr-reviewer`만 언급).
사용자 진입점은 커맨드인데 게이트 Q3 실패 시 안내가 에이전트 이름에서 끝난다.

---

## 3. 수정 계획

### 3-1. 즉시 적용 (문장 단위, 파일 5개)

| #   | 파일                                      | 위치                               | 수정                                                                                                                                                                      | 대응    |
| --- | ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `agents/adr-impl-sufficiency-reviewer.md` | `:13`, `:198`                      | "R1–R16" → **"R1–R16, R19–R20"**. 이어서 R18 분담 1줄 추가 — _ADR이 요구사항을 적었는가는 `adr-reviewer`, 코드가 그 값으로 집행하는가는 이 에이전트(Contract compliance)_ | ①       |
| 2   | `skills/adr-impl-review/SKILL.md`         | `:73` 게이트 Q3                    | **"재생성 테스트"** 라는 이름과 `authoring-rules.md` "What an ADR must satisfy" 근거 명시                                                                                 | ②       |
| 3   | `agents/adr-impl-necessity-reviewer.md`   | `:27`                              | 인라인 목록을 `authoring-rules.md` "Concrete numbers" / "Non-numeric requirements" **인용으로 교체**(문장은 남기고 출처 추가)                                             | ③       |
| 4   | `skills/adr-impl-review/SKILL.md`         | `:221`                             | `Decision changed in code` 라우팅에 **decision-log 1줄 + Accepted→Proposed 복귀** 추가                                                                                    | ⑥       |
| 5   | `skills/adr-review/SKILL.md`              | `:95`, `:100`                      | verdict 집계에 **미판정 축**(`INCONCLUSIVE` 또는 `unjudged`) 추가 — stale 규칙 문서로 못 본 축이 PASS에 섞이지 않게                                                       | ⑤       |
| 6   | `skills/adr-impl-review/SKILL.md`         | `1.` 준비물 / 보고                 | **rules-version stamp 확인**을 준비물에 넣고, `Review limits`에 lag 기록. refresh는 `/adr-new`로 라우팅(현행 소유권 유지)                                                 | ④       |
| 7   | `agents/adr-reviewer.md`                  | `:104-120` 보고 포맷               | findings 항목에 **`confidence`** 추가                                                                                                                                     | ⑦(부분) |
| 8   | `skills/adr-impl-review/SKILL.md`         | 게이트 Q3 실패 라우팅 / Prohibited | `/adr-review`(커맨드) 명시 + "impl-review의 PASS는 ADR이 잘 쓰였다는 뜻이 아니다" 1줄. `/adr-review:141`이 이미 대칭으로 하고 있음                                        | ⑧ 부수  |

### 3-2. 별도 진행 (절차 설계 필요)

| #   | 항목                             | 내용                                                                                                                                                                                                                                          | 대응 |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 9   | **edit-in-place 소유자 확정**    | `/adr-new`에 "기존 ADR을 현재 상태로 갱신" 분기 추가를 권고. 이미 step 1에서 mapping·seed·카테고리 bloat를 다루고 있어 major 로그 기록과 Status 복귀를 붙일 자리가 자연스럽다. 대안: 전용 `/adr-edit` 신설, 또는 `/adr-sync`의 소유 범위 확장 | ⑧    |
| 10  | **문서 축 반증 강도 상향(선택)** | ⑦의 근본 해소. adr-reviewer를 다관점(요구사항 보존 / 그레이존 / 문체)으로 쪼개거나, R19만 별도 반증 패스로 돌리는 방안. 스윕 비용이 ADR 수에 선형이라 비용-효과 판단이 먼저 필요                                                              | ⑦    |

### 3-3. 적용 후 확인

- `plugins/adr-writer/.claude-plugin/plugin.json`의 `version` 및 seed 문서 하단
  `<!-- adr-writer:rules-version X.Y.Z -->` 스탬프 갱신. **4절 작업으로 `templates/adr/`가 변경됐으므로
  이번에는 `bun run bump`로 스탬프까지 함께 올려야 한다** (신규 `concepts.md`도 스탬프 대상에 등록됨).
- `bun run test` 회귀 확인 — seed 문서 분리는 `skill-metadata.test.mjs`가 지킨다.
- 축 A–K 표를 기준으로 재점검: 각 축이 세 스킬에서 **같은 이름**으로 불리는지.

---

## 4. 완료된 작업 — 추상화 레벨 원리의 정본화 + seed 문서 분리 (⑨·①②③)

### 4-1. 배경

세 스킬의 개별 규칙(R2·R3·R15·R18 등)은 "PRD/ADR/코드가 담는 정보 수준을 제약한다"는 하나의 원리를
사례별로 구현하고 있었지만, **그 원리가 어디에도 원리로 적혀 있지 않았다.** 결과적으로 규칙 표에 실린
케이스는 잘 처리되고 표 밖의 새 케이스에서는 근거가 없었다. 특히 impl 계통(`grep` 기준):

- `requirement gate` / `code-readthrough` / `litmus` 언급 **0건** — 그런데 `[Undecided behavior]` 판정은
  본질적으로 이 게이트를 요구한다
- 4층 추상화 표(구 `README.md` "ADR vs ALPS vs design documents")를 인용하는 심판 프롬프트 **0건**

### 4-2. 정본 위치와 원리

`templates/adr/concepts.md` **"The abstraction ladder — the principle every rule follows from"** 이 정본이다.

- PRD/ADR/코드 = 세 주제의 세 문서가 아니라 **한 시스템의 세 해상도**(C4의 context/container/component 줌)
- 레벨의 가치는 **보여주지 않는 것**에서 나온다
- 목표 = **"독자가 한 레벨만 로드하고 거기서 멈출 수 있다"** (선택적 읽기)
- 두 방향 누수를 대등하게 정의: 아래 레벨 detail 상승 → ADR 단독 신뢰 불가 /
  요구사항 이탈 → **어느 레벨도 그것을 갖지 않음**(더 비쌈)
- 두 누수를 하나로 묶는 **single-level read test** 제시

기존 명칭들을 이 원리의 파생으로 재배치 — 재생성 테스트(ADR 레벨에 적용), 요구사항 게이트+2필터(사실을
레벨로 라우팅), stability gradient(사후 탐지), `Spec violation`/`Impl-fact mismatch`(소유 레벨 판정).

### 4-3. seed 문서 분리 — README(인덱스) / concepts(동작 방식)

seed 문서가 4개 → **5개**가 됐다. `README.md`는 상단에서 `concepts.md`로 라우팅하고, 형제 파일들도
필요한 섹션을 인용한다.

| 파일                 | 역할                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `README.md`          | 디렉터리 인덱스 — ADR이란 무엇인가, ADR 템플릿, 인덱스가 어디 사는가                               |
| `concepts.md`        | **동작 방식** — 추상화 래더, 그레이존, 재생성 테스트, 요구사항 게이트, 의존 모델, Status 자동 전이 |
| `authoring-rules.md` | 본문 포함/배제 규칙과 리뷰 체크리스트                                                              |
| `structure.md`       | 디렉터리·매핑 정책                                                                                 |

기계적 반영 지점: `adr-structure-lint.mjs`(stale 검사 대상 + 신규 레이아웃 검사), `bump-version.mjs`(스탬프
대상, 사이트 12 → 13), `tests/helpers.mjs`(`RULE_DOCS`), `adr-invariants.sh`(주석), 그리고 프롬프트 31곳의
인용 경로.

**파일명 선정** — 처음에는 `AGENTS.md`로 두었으나 `concepts.md`로 바꿨다. 세 가지 이유가 있다.
(a) **사용자 파일과 충돌** — 팀이 이미 자기 `docs/adr/AGENTS.md`(그 폴더 작업 규칙)를 갖고 있으면 harness가
경고 없이 clean으로 통과하고, seed가 그 파일을 덮어쓴다. 실측으로 확인한 조용한 실패다.
(b) **프롬프트 내 중의성** — 프로젝트 루트 `AGENTS.md`(주석 밀도, best-practice 1차 근거, 테스트 커맨드
출처)와 이름이 같아 매 인용마다 경로 수식이 필요했다.
(c) **클라이언트 자동 로드** — `AGENTS.md`는 디렉터리 스코프 지시 파일 규약이라 의도치 않게 주입될 수 있다.

`concepts.md`는 형제 파일(`authoring-rules.md`, `structure.md`)과 같은 "역할 설명형 케밥" 계열이고, README가
스스로를 "conceptual index"라 부르던 것과도 이어진다. 이름 충돌이 없어져 경로 수식도 전부 걷어냈다.

**링크 방향** — `README.md`가 `concepts.md`를 인용한다(그 반대가 아니다). 처음에는 "README는 더 안정적이므로
concepts를 몰라야 한다"고 두었지만, 그러면 `docs/adr/`를 여는 에이전트가 인덱스에서 멈춰 원리에 도달하지
못한다. 규칙의 근거가 없으면 규칙이 임의적으로 읽히므로, README 상단에서 "작성·리뷰 전에 읽어라"로
라우팅한다.

### 4-3-a. 기존 프로젝트 마이그레이션 — harness가 결정론적으로 잡는다

프롬프트 안내만으로는 LLM이 그 분기를 밟지 않을 수 있어서, **두 상태를 harness 경고로 승격**했다.
둘 다 warning이며 error가 아니다 — 레이아웃이 낡아도 ADR 자체가 틀린 것은 아니다.

| 규칙                          | 조건                                          | 왜 별도 규칙인가                                                                            |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `rules-doc-layout-legacy`     | `README.md`는 있고 `concepts.md`가 없음       | stale 스탬프 검사는 **present한 문서만** 비교하므로 부재 파일을 영원히 못 본다              |
| `rules-doc-layout-duplicated` | 둘 다 있는데 `README.md`에 이동한 섹션이 잔존 | 미마이그레이션보다 **더 나쁨** — 한 규칙의 사본 둘이 갈라지면 어느 쪽이 최신인지 알 수 없다 |

- 판정은 **heading 위치**에서만 하고(`## Status` 등), **fenced block을 먼저 제거**한다. README가 정당하게
  보유하는 ADR 템플릿 안에 `## Status`가 있어서, 안 걸러내면 **정상 레이아웃이 duplicated로 오탐**한다.
  (실제로 첫 구현이 이 오탐을 냈고 테스트로 회귀 고정했다.)
- `/adr-new` step 1이 두 규칙을 이름으로 받아 각각의 조치를 제안한다(hand-edit diff 후 이관, 승인 없이는
  덮어쓰지 않음). `/adr-review`는 보고서 Scope에 `Doc layout` 줄을 추가해 세트 단위로 노출한다.
- 검증: 0.4.31 시점의 실제 seed 문서로 리포를 구성해 `rules-doc-stale` + `rules-doc-layout-legacy` 2건 동시
  발생을 확인했고, 신규 레이아웃은 clean exit 0.

**하위 호환**: `concepts.md`가 없는 구버전 리포는 그 내용이 `README.md`에 있다. `adr-reviewer`·`/adr-sync`·
`/adr-impl`·`/adr-impl-review`는 `concepts.md` 부재 시 `README.md`에서 읽으므로 **동작이 깨지지 않는다** — 경고는 "정리하라"이지
"고장났다"가 아니다.

### 4-4. 각 스킬에 심은 인용

| 파일                                      | 추가 내용                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `AGENTS.md` (리포 루트, ADR 문서 아님)    | 최상단에 "The design principle — an abstraction ladder, C4-style". 레벨×소유 플러그인 표       |
| `authoring-rules.md`                      | 서두에 "모든 규칙은 해상도 제약" + 정본 링크                                                   |
| `skills/adr-new/SKILL.md`                 | Procedure 앞에 3층 Mermaid + 두 누수. step 3에 게이트→통독→리트머스 **순서**를 라우팅 규칙으로 |
| `skills/adr-review/SKILL.md`              | R1–R20 findings를 "어느 ADR이 자기 레벨 단독 가독성을 잃었나"로 프레이밍                       |
| `agents/adr-reviewer.md`                  | 규칙 체크 앞에 R1–R20을 **두 누수 유형으로 분류**; 어느 쪽도 아닌 진단은 취향이므로 제외       |
| `skills/adr-impl-review/SKILL.md`         | 최상단에 disagreement→소유 레벨→카테고리→라우팅 표; 게이트 Q3 = "사람에게 묻는 재생성 테스트"  |
| `agents/adr-impl-sufficiency-reviewer.md` | 레벨 소유 판정을 본업으로 명시; R 범위 수정 + R18 방향 분할                                    |
| `agents/adr-impl-necessity-reviewer.md`   | Input에 규칙 문서; step 1을 해상도 판정으로 규정                                               |
| `agents/adr-impl-explainer.md`            | side-by-side 표의 목적 = 두 해상도를 나란히 놓아 사람이 Q3를 답하게                            |
| `agents/adr-impl-review-report-writer.md` | Contract compliance에 "어느 레벨이 바뀌어야 하는지" 명시 + ADR 값을 코드에 맞추는 fix 금지     |

---

## 5. 완료된 작업 — ④⑤⑥⑦⑧

### 5-1. ⑧의 진단 정정 — "막다른 길"이 아니었다

최초 검토에서 "edit-in-place 절차를 어느 스킬도 소유하지 않는다"고 적었는데 **사실이 아니다.**
두 커맨드가 이미 소유하고 있었다:

- `skills/adr-impl/SKILL.md` step 1 — 요구값·결정 변경 시 본문 in-place 갱신 + Status를 `Proposed`로 복귀
  - major면 `decision-log.md` 1줄
- `skills/adr-impl/SKILL.md` step 4 — 구현 중 그레이존 결정 변경 시 같은 절차, 같은 커밋
- `skills/adr-sync/SKILL.md` "An intended decision change" 분기 — 코드가 이미 서 있고 ADR만 따라가는 경우

**실제 갭은 라우팅 문구가 그 커맨드 이름을 대지 않는다는 것**이었다("edit-in-place"라고만 씀). 따라서
전용 `/adr-edit` 신설(구 10번 항목)은 불필요하고, 한 줄 수정으로 끝난다. 두 소유자의 역할 분담:

| 상황                                       | 소유 커맨드            |
| ------------------------------------------ | ---------------------- |
| 같은 사이클에서 코드까지 다시 작업         | `/adr-impl <category>` |
| 코드는 이미 서 있고 ADR만 따라가야 함      | `/adr-sync <category>` |
| 결정 주제가 분기해 구 결정이 별도로 남아야 | `/adr-new` (supersede) |

### 5-2. ⑤ 미판정 축 — verdict 어휘는 건드리지 않는다

`INCONCLUSIVE`를 4번째 값으로 추가하는 안을 검토했으나 **채택하지 않았다.** `adr-reviewer`의 verdict
기준·보고 포맷을 동시에 고쳐야 하고 새 판정 조건을 정의해야 하는데, 얻는 것은 어휘 통일뿐이다.
대신 스윕 보고서 Scope에 **`Unjudged axes` 줄**을 추가하고, 비어 있지 않으면 채팅 요약에서
"PASS 카운트가 그 규칙들을 제외한 수치"임을 밝히게 했다. ADR당 판정은 3값을 유지한다.

### 5-3. ⑥ decision-log — 로그가 작업의 일부임을 명시

`Decision changed in code`로 ADR을 갱신하기로 하면 **정의상 major**이므로 `decision-log.md` 1줄이 함께
필요하다(본문을 현재 상태로 덮어쓰면 구 접근의 근거가 사라지므로). 라우팅에 이 사실 + 소유 커맨드를
넣었고, sufficiency reviewer의 Branch 출력 줄에도 같은 내용을 반영했다.

**Status 복귀는 넣지 않았다** — `README.md`의 복귀 규칙은 "새 결정이 코드·테스트에 반영되기 전까지"인데,
`Decision changed in code`는 코드가 이미 새 결정을 갖고 있다. ADR을 갱신하면 양쪽이 일치하고 코드를
되돌리면 원래대로 일치하므로, 어느 분기도 복귀가 필요 없다.

### 5-4. ⑦ confidence — 척도를 하나로

`adr-reviewer` findings에 `confidence: high|medium|low`를 추가했다. **`adr-impl-review-validate.mjs`가
findings JSON에 이미 같은 3단계를 강제**하고 있어서, 다른 어휘(`certain`/`likely` 등)를 쓰면 한 프로젝트에
두 신뢰도 체계가 생긴다. 사용 기준(인용 가능=high / 정도 문제=medium / 의도 추론=low)과 함께
"low는 질문이므로 fix도 질문으로 쓰고, BLOCK을 달지 않는다"를 명시했다.

**⑦의 근본(문서 축 반증 강도 상향)은 보류**했다. adr-reviewer를 다관점으로 쪼개거나 R19를 별도 반증
패스로 돌리는 방안은 스윕 비용이 ADR 수에 선형이라 비용-효과 판단이 먼저 필요하다.

### 5-5. 회귀 고정

`tests/skill-metadata.test.mjs`에 4개 테스트를 추가했다(총 162개).

- impl-review 라우팅이 세 커맨드를 이름으로 대는지 + 로그/major 언급 + report-only 유지
- validator와 adr-reviewer가 **같은 confidence 어휘**를 쓰는지, low가 BLOCK을 달 수 없는지
- 스윕이 `Unjudged axes`를 보고하면서 **verdict 3값을 포크하지 않는지**
- `/adr-impl`·`/adr-sync`가 edit-in-place 절차를 실제로 보유하는지(로그·Status 포함) — 라우팅 대상이
  사라지면 report-only 커맨드가 막다른 길이 되므로
