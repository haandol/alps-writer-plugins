# Decision log — document-authoring/domain-organization

Newest first. Record only major decision changes.

- **2026-11-17 — current ADR: [컨텍스트별 용어집](./0001-organize-features-by-bounded-context.md)** — 하나의 루트 용어집 대신, 컨텍스트가 쓰거나 그 컨텍스트에서만 다른 뜻을 갖는 용어를 그 컨텍스트의 용어집에 두게 했다. 같은 단어가 컨텍스트마다 다른 뜻일 수 있고, 컨텍스트를 떼어 읽어도 용어가 설명되게 하기 위해서다.

- **2026-11-17 — current ADR: [컨텍스트 자기 완결과 경계 계약](./0001-organize-features-by-bounded-context.md)** — 각 컨텍스트의 문서가 스냅샷에서 그 코드와 함께 떼어 읽어도 완전하도록, 의존하는 쪽 ADR이 기대는 경계 계약을 Relied-on boundary에 기록하게 했다. 멀티레포의 각 저장소도 같은 방식으로 자기 완결하며 루트 색인은 파생 색인으로 둔다. ADR만으로 성립하고 업무 온톨로지는 정렬 검증에 쓴다.
