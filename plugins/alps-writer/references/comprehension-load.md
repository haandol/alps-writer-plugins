# Comprehension-load scoring

Use this internal rubric when a calling skill requires a comprehension-load
score.

Score five axes from 0 to 2 and sum them:

1. conceptual breadth;
2. contract density;
3. state and flow complexity;
4. boundary coupling;
5. uncertainty and verification burden.

Display 1 rather than 0, so the visible range is 1-10. Do not expose the axis
scores or private rationale.

Calibration:

- 1 — one statement or rule;
- 2 — one action and one success condition;
- 3 — a few flows or exceptions;
- 4-6 — recommended range, with 5 the balanced center;
- 7 — high load;
- 8 — very high load;
- 9 — strongly coupled behaviors or contracts;
- 10 — maximum review load; first check for mixed Features or decisions.

A low score never requires merging. A high score does not by itself block work.
The calling skill owns what happens at 8/10 or higher, including whether it
offers a split review, split candidates, or a delivery fallback.

Show only `Comprehension load: <N>/10`. The score is advisory and ephemeral:
never write it to an ALPS document, ADR, `.mapping.json`, Status, code, review
artifact, or another registry.
