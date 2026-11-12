# Writing style

Read before writing report prose. A single register and sentence pattern makes
reports by different models read alike. The user's explicit tone request, or a
supplied reference passage, overrides these defaults for that report.

## Register

- **Korean:** write every sentence in the plain declarative `~다` form
  (`확인했다`, `필요하다`, `아니다`). Do not mix in `~합니다`, `~해요`, noun-ending
  fragments (`~함`, `~임`, `~필요`) or question-and-answer banter. Headings and
  short labels may be noun phrases.
- **English:** plain, direct declarative sentences in the active voice.
- Keep one register from title to footer, including previews, figure
  explanations and quiz text.

## Sentences

- One claim or fact per sentence. Split a sentence that joins unrelated claims
  or chains several conditions.
- Keep the subject close to its verb and name the actor: "the scheduler retries
  the job", not "a retry is performed".
- State conditions next to the claim they qualify, and keep a negation with its
  condition ("only when the key matches", not a later caveat).
- Prefer concrete words to abstract nouns: "the request waits 30 seconds" rather
  than "latency considerations apply".

## Paragraphs

- Each paragraph has one point and states it in its first sentence; the rest
  supplies the reason, condition, example or exception.
- Open a paragraph so its link to the previous one is visible: a consequence,
  a contrast, the next step, or a narrower case. Do not restart the topic.
- Break the paragraph when the actor, topic, example or condition changes. Do
  not place every sentence on its own line, and keep cause and result together.

## Choose the form, and visualize where it helps

The template fixes each region's place and abstraction level; inside a section
you decide the form. Ask what the reader must see at once, then pick the form
that shows it with the least effort to read. Use visual forms as far as they
help understanding; a section may combine several.

| The content is…                                                  | Prefer                              |
| ---------------------------------------------------------------- | ----------------------------------- |
| A flow, sequence, dependency, lifecycle or set of relationships  | A diagram ([diagrams](diagrams.md)) |
| A comparison, mapping, before/after change or items × attributes | A table                             |
| Parallel items the reader scans, or steps to follow in order     | A list (ordered for steps)          |
| A causal chain, a condition with its exception, or a judgment    | Prose                               |
| Exact syntax, configuration or a short literal excerpt           | A code block                        |

- Introduce every diagram or table with the point it supports and, after it,
  say what to notice. A visual must not be the only place a conclusion lives.
- Give a table the columns the reader compares by, one row per item, and short
  cells; put explanation that needs sentences outside the table.
- Do not draw the same content twice, or turn one fact into a figure or
  one-row table for decoration.
- Keep each visual at its region's level: an Overview figure shows parts and
  relationships, while a child section's table may hold exact values.

## Emphasis

- Do not use bold for whole sentences, emoji, exclamation marks, hype
  ("powerful", "seamless", "획기적") or decorative labels. Mark uncertainty
  with the actual limit, not hedging adverbs.

## Terms

- Explain an unfamiliar term, acronym or identifier at its first necessary use
  through what it does, then use the same term throughout.
- Introduce a role in plain words before the implementation name that fills it.
- Keep code identifiers, values and quotations exact, in code formatting where
  the format supports it; translate the surrounding explanation, not the name.

## Before and after

Mixed register, identifiers in the answer, and a topic-restarting paragraph:

> 결론적으로 `retryPolicy.ts`의 `maxAttempts`가 문제임. 매우 중요한 이슈입니다!
> 재시도 정책은 서비스에서 중요한 역할을 합니다.

Rewritten:

> 같은 결제 요청을 다시 보내도 두 번 청구되지 않는다. 다만 결제사 응답이 끊긴
> 경우의 복구는 아직 확인하지 않았으므로, 그 경로를 검증하기 전에는 재시도
> 안전성을 보장할 수 없다.
