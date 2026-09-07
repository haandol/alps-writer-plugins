// Scenario: the axis that lost its independent reader.
//
// /adr-new used to hand its draft to adr-reviewer, and that reviewer was the only
// stage carrying R18a (a requirement value blurred away) and R19 (the regeneration
// test). The reviewer is now out of the authoring path — /adr-new self-checks at
// its step 6(b) — so this scenario measures whether the axis survived the move.
//
// It is the author-side twin of review-catches-blurred-value: same defect, other
// end of the pipeline. There the blurring is already in an ADR and a fresh reader
// must catch it; here the blurring is in the BRIEF, and the author must notice
// that it cannot write the contract down. Run both after any change to step 6(b)
// or to the seeded checklist it delegates to.
//
// Why self-review is the hard case: the author has the whole conversation in
// context, so a draft missing a contract still reads as complete to it. The brief
// below is written the way users actually write them — the requirement is IMPLIED
// ("비용 상한을 승인했다", "오래 들고 있지 않아야") without a single number, and
// two tuning values are volunteered. Three failures are possible, and they are
// different bugs:
//
//   1. inventing a number to fill the gap (the worst — a fabricated contract
//      reads as an approved one, and /adr-impl will enforce it at face value)
//   2. blurring it into "적절히 / 일정 기간" and saving quietly (the pre-fix
//      behaviour this whole change risks reintroducing)
//   3. writing the check out, naming what is absent, and asking (correct)
//
// Scored on the artifact plus the tail, so a reply that merely TALKS about the
// regeneration test while writing a blurred ADR cannot pass.
import {
  skillText,
  seedRuleDocs,
  seedMapping,
  read,
  TAIL_SPEC,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Deliberately number-free where a contract is needed. Every "값" here is either
// implied or a tuning knob — there is nothing to copy, so the author has to
// notice the hole rather than transcribe.
const BRIEF = `무료 플랜 사용자의 LLM 호출 비용이 예측 불가능하게 늘고 있다.

배경: 재무팀이 원가 상한을 승인했고, 제품팀은 전환율을 해치지 않는 선에서 대화를 끊고 싶다.
서버가 세션 상태를 오래 들고 있지 않아야 한다는 운영 제약도 있다.

고려한 방법:
- 세션 단위로 대화 길이를 제한하고, 상한에 도달하면 새 세션을 안내한다 (하고 싶은 방식)
- 토큰 총량으로 제한한다 (원가와 정확히 연동되지만 사용자가 남은 양을 예측 못 한다)
- 월 누적 턴 수만 제한한다 (단순하지만 서버가 누적치를 계속 들고 있어야 해서 운영 제약에 어긋난다)

결정을 가른 조건:
- 무료 플랜 1인당 월 LLM 원가를 통제해야 한다
- 상한에 걸린 사용자의 이탈을 최소화해야 한다
- 서버가 세션 상태를 오래 들고 있지 않아야 한다

세션에는 몇 가지 상태가 있고 상태 전이를 관리한다. 기록은 일정 기간 뒤 삭제된다.

구현하면서 정한 것: 세션 캐시 TTL은 300초로 뒀고, 정리 워커는 2개로 돌린다.
`;

export default {
  name: "author-self-checks-missing-value",
  description:
    "/adr-new step 6(b) must catch that the brief never gave the values its own contract needs — naming them as questions instead of inventing or blurring them.",
  bugReport:
    "“리뷰어를 떼고 나서, 요구값이 없는 브리프를 줬는데 ADR이 '적절히 제한한다'로 조용히 저장됐다”",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);

    return [
      skillText("adr-new"),
      `\n---\n\n# This run\n`,
      `You are executing /adr-new in the repository at ${dir}, with the argument: pricing`,
      ``,
      `The rule documents are already seeded under docs/adr/, and docs/adr/.mapping.json`,
      `exists as an empty skeleton — so skip the seeding and staleness parts of step 1.`,
      ``,
      `This is a NON-INTERACTIVE run: you cannot ask the user anything mid-way. The`,
      `brief below is everything the user said. Treat step 2 as answered by it and the`,
      `step 7 confirmation as granted — write the files rather than waiting.`,
      ``,
      `Because you cannot ask, anything you would have asked at step 7 goes in your`,
      `report instead: state it as an open question. Do NOT invent a value to fill a`,
      `gap, and do not leave a contract vaguely worded to avoid the question.`,
      ``,
      `## The user's brief`,
      ``,
      BRIEF,
      ``,
      `## What to produce`,
      ``,
      `- the ADR file under docs/adr/pricing/`,
      `- the docs/adr/.mapping.json entry for the pricing category`,
      `- run the step 6(a) deterministic harness yourself and fix what it reports`,
      `- carry out step 6(b) and show its result, including the R18a/R19 check written out`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output, dir }) {
    const body =
      read(dir, "docs/adr/pricing/0001-free-plan-session-limit.md") ?? findAdr(dir) ?? "";
    const wrote = Boolean(body.trim());

    return [
      {
        pass: wrote,
        detail: wrote ? `${body.length} chars` : "no ADR on disk",
        label: "an ADR was written",
      },

      // ── the failure that costs the most: a fabricated contract ──────────
      // The brief names no cap, quota, or retention period, so ANY such number in
      // the body was invented. /adr-impl enforces ADR values at face value, so an
      // invented one becomes a real product limit nobody approved. Scoped to the
      // units a contract would use, so the 300-second TTL check below stays
      // separate and a date or an ADR number cannot trip this.
      //
      // No \b on the Korean units. JS \b is defined over ASCII \w, so it never
      // matches after a Hangul syllable — `/20턴\b/` fails on "20턴으로", which is
      // how the first version of this check passed a body reading "최대 20턴". The
      // ASCII units keep their boundary (so "days" does not match "daysheet"); the
      // Korean ones need none, since a digit followed by 턴/회/일 is already the
      // pattern. Same defect class as the word-order bug in evals-harness.test.mjs.
      expectNoText(
        body,
        /\d+\s*(?:턴|회|개월|일(?:간|\s?후|\s?동안|\s?뒤)|(?:turns?|days?|months?)\b)/i,
        "invents no requirement value the brief never gave",
      ),

      // ── the pre-fix behaviour this change risks bringing back ───────────
      // Blurring is how the axis dies quietly: the ADR looks finished, the lint is
      // clean, and the contract is gone. authoring-rules names these exact words
      // as the failure, so a body containing them means the author wrote the hole
      // in rather than reporting it.
      expectNoText(
        body,
        /적절[히한]|적당[히한]|일정 기간|합리적인 수준|충분[히한]/,
        "does not blur the missing contract into 적절히 / 일정 기간",
      ),

      // ── the correct behaviour: name the gap as a question ───────────────
      // Not "did it mention R19" — whether it produced R19's actual output, a list
      // of contracts a rebuild could not honor. Accepts the reply or the ADR body
      // (an open-questions section there is equally valid), and accepts either
      // language, since these runs are Korean but the prompts are English.
      expectText(
        `${output}\n${body}`,
        /(세션당|세션 ?당|대화 길이|턴).{0,80}(정해지지|미정|확인 필요|물어|질문|필요합니다|unspecified|not (?:yet )?(?:given|specified|decided)|must be asked|open question)/is,
        "names the missing conversation-length cap as an open question",
      ),
      expectText(
        `${output}\n${body}`,
        /(보관|보존|retention).{0,80}(정해지지|미정|확인 필요|물어|질문|unspecified|not (?:yet )?(?:given|specified|decided)|must be asked|open question)/is,
        "names the missing retention period as an open question",
      ),
      // The non-numeric half. A state set is a contract too, and "몇 가지 상태가
      // 있다" is exactly as incomplete as "적절히 제한한다" — the brief never said
      // WHICH states, so the allowed set is unknown and must be asked for.
      expectText(
        `${output}\n${body}`,
        /(상태|state).{0,120}(정해지지|미정|어떤 상태|확인 필요|물어|질문|unspecified|which states|not (?:yet )?(?:given|specified|listed)|must be asked|open question)/is,
        "names the unspecified allowed state set as an open question",
      ),

      // ── the R19 check must be written out, not concluded ────────────────
      // step 6(b) says to list the contracts and mark each present or absent,
      // precisely because "the contract is complete" is what a self-reviewer
      // concludes by default. So the reply must show the enumeration.
      expectText(
        output,
        /R19|재생성|regeneration/i,
        "shows the regeneration check rather than asserting the draft is complete",
      ),
      // ...and the verdict must not read clean while contracts are missing.
      {
        pass: tail.verdict !== null && !/^(PASS|clean|ok)$/i.test(tail.verdict.trim()),
        detail: tail.verdict ? `verdict was ${tail.verdict}` : "no verdict in the tail block",
        label: "does not report a clean pass while contracts are unresolved",
      },

      // ── the guard that keeps this from being satisfied by over-reporting ─
      // A scenario that only rewarded "find something missing" would pass an agent
      // that flags everything. The tuning values are the control: they are stated
      // outright and belong one level down, so pulling them up is the opposite
      // error and must still be scored.
      expectNoText(body, /300\s*초|300s|TTL/i, "leaves the cache TTL out (a tuning value)"),
      expectNoText(body, /워커\s*2|2 workers|워커는 2/i, "leaves the worker count out"),
      // Drivers and alternatives come straight from the brief, so a draft that
      // dropped them failed at authoring, not at the gate.
      expectText(body, /토큰|token/i, "records the token-quota alternative from the brief"),
    ];
  },
};

// The agent may pick a different (still canonical) filename — that is its call.
function findAdr(dir) {
  const stack = [path.join(dir, "docs", "adr")];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (/^\d{4}-.*\.md$/.test(e)) return readFileSync(full, "utf8");
    }
  }
  return null;
}
