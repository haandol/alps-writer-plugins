import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("adr-impl-review preserves role boundaries without fixing the agent topology", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  const artifactContract = read("skills/adr-impl-review/references/artifact-contract.md");
  const reviewContract = `${skill}\n${artifactContract}`;
  const agents = [
    ["agents/adr-impl-explainer.md", "name: adr-impl-explainer"],
    ["agents/adr-impl-necessity-reviewer.md", "name: adr-impl-necessity-reviewer"],
    ["agents/adr-impl-sufficiency-reviewer.md", "name: adr-impl-sufficiency-reviewer"],
    ["agents/adr-impl-review-report-writer.md", "name: adr-impl-review-report-writer"],
  ];

  for (const [file, name] of agents) {
    assert.match(read(file), new RegExp(name));
    assert.match(reviewContract, new RegExp(name.replace("name: ", "")));
  }

  assert.match(skill, /Build the review baseline without a post-implementation gate/);
  assert.match(skill, /do not stop to show it or ask the user to reconfirm/i);
  assert.doesNotMatch(
    skill,
    /Never proceed to the adversarial reviews before explicit confirmation/,
  );
  assert.match(
    skill,
    /Never pass a reviewer the explanation document or the other reviewer's result/,
  );
  assert.match(skill, /may run them in parallel or sequentially/i);
  assert.match(skill, /zero, one, or several subagents/i);
  assert.match(skill, /Do not require a provider family, reasoning tier, fixed agent count/i);
  assert.doesNotMatch(skill, /strongest reasoning models from different provider families/);
  assert.doesNotMatch(skill, /highest reasoning tier/);
  assert.match(skill, /Notable implementation choices/);
  assert.match(
    skill,
    /selected value or behavior, code evidence, why it fits the ADR intent, and why it matters/i,
  );
  assert.match(artifactContract, /progressive disclosure/i);
  assert.match(artifactContract, /implementationChoices/);
  assert.match(artifactContract, /contractCoverage/);
  assert.match(skill, /PROVEN.*VIOLATED.*UNVERIFIED.*CONTRADICTED/s);
  assert.match(artifactContract, /ordinary main-session completion\s+response contains only/i);
  assert.doesNotMatch(reviewContract, /accept.*request change.*investigate/i);
  // No provider's model ID may be embedded in the prompt.
  assert.doesNotMatch(reviewContract, /gpt-[0-9]|claude-[a-z0-9]|gemini-[0-9]/);
});

test("implementation review separates ADR decisions from code-level AI choices", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  const review = read("skills/adr-impl-review/SKILL.md");
  const explainer = read("agents/adr-impl-explainer.md");
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const reportWriter = read("agents/adr-impl-review-report-writer.md");
  const materializer = read("scripts/adr-impl-review-materialize.mjs");

  assert.match(impl, /never written into the ADR/);
  assert.match(review, /admission gate/);
  assert.match(review, /Unverified risk/);
  assert.doesNotMatch(explainer, /Implementation choices not specified by the ADR/);
  assert.match(sufficiency, /Notable implementation choices/);
  assert.match(sufficiency, /not a finding and does not change the verdict/);
  assert.match(sufficiency, /Build Notable implementation choices once from code outward/);
  assert.match(sufficiency, /why it fits the ADR intent/);
  assert.match(sufficiency, /never invent historical rationale/i);
  assert.match(sufficiency, /externally checkable premises/i);
  assert.match(sufficiency, /Impact if false/i);
  assert.match(sufficiency, /Resolve requirement gaps with domain knowledge before escalation/i);
  assert.match(sufficiency, /Decision request/i);
  assert.match(review, /mark the affected coverage row `UNVERIFIED`/i);
  assert.match(review, /Do not reconstruct the implementer's private reasoning/i);
  assert.match(sufficiency, /Normalize each decision-ledger row into contract coverage/);
  assert.match(sufficiency, /replaceable tuning value or implementation means goes into/);
  assert.doesNotMatch(
    sufficiency,
    /Tuning values and replaceable libraries[\s\S]{0,200}are out of scope/,
  );
  assert.match(reportWriter, /material\s+code-level choices the ADR intentionally does not own/i);
  assert.match(reportWriter, /implementationChoices/);
  assert.match(materializer, /Why it fits the ADR intent/);
  assert.match(reportWriter, /one row per independent ADR obligation/);
  assert.match(reportWriter, /do not amend the ADR/);
  assert.match(reportWriter, /Use progressive disclosure/);
  assert.match(reportWriter, /read-only/);
});

test("implementation review leads with Context and a reader-priority narrative", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  const artifactContract = read("skills/adr-impl-review/references/artifact-contract.md");
  const reviewContract = `${skill}\n${artifactContract}`;
  const explainer = read("agents/adr-impl-explainer.md");
  const reportWriter = read("agents/adr-impl-review-report-writer.md");
  const guide = read("references/review-report-writing.md");
  const readerFirst = read("references/reader-first-writing.md");
  const hiking = read("skills/adr-impl-review/references/review-hiking.md");
  const validator = read("scripts/adr-impl-review-validate.mjs");

  for (const source of [skill, explainer, reportWriter, guide]) {
    assert.match(source, /Context/);
    assert.match(source, /importance|important/i);
    assert.match(source, /flow|causal/i);
  }
  for (const source of [reviewContract, reportWriter, guide]) {
    assert.match(source, /Comprehension\s+check/);
  }

  assert.match(explainer, /subject-specific heading/i);
  assert.match(reportWriter, /Between `Context` and `Findings`/);
  assert.match(reportWriter, /causal explanation before the generated evidence/i);
  assert.match(artifactContract, /human-facing order is prose first, evidence second/i);
  assert.match(guide, /concise tutorial or senior review comment/i);
  for (const source of [reportWriter, artifactContract, guide]) {
    assert.match(source, /equal-width table-like/i);
  }
  assert.match(readerFirst, /repeated contrast templates/i);
  assert.match(readerFirst, /ornamental title-cased English labels/i);
  assert.match(readerFirst, /Never invent an anecdote/i);
  assert.match(hiking, /junior developer/i);
  assert.match(hiking, /file and symbol|focused unified diff/i);
  assert.match(guide, /language the user explicitly requests or currently uses/i);
  assert.match(guide, /target ADR's dominant\s+language/i);
  assert.match(guide, /multi-ADR report/i);
  assert.doesNotMatch(reviewContract, /exactly these top-level sections/i);
  assert.match(reviewContract, /one\s+to five medium-difficulty free-response questions/i);
  assert.match(
    reviewContract,
    /may reveal `answerCriteria` and `evidence` only after the reader enters an\s+answer/i,
  );
  assert.match(skill, /`PASS` never implies comprehension readiness/);
  assert.match(skill, /Do not send the PR until the\s+check passes/);
  assert.match(artifactContract, /Do not persist quiz progress or pass\/fail state/);
  assert.match(artifactContract, /Do not automatically begin the comprehension check/i);
  assert.match(
    artifactContract,
    /Only when the user explicitly asks to run the comprehension check/i,
  );
  assert.match(artifactContract, /ordinary main-session completion\s+response contains only/i);
  assert.match(
    skill,
    /Never include a comprehension question, grading criterion, evidence, or answer\s+request in the ordinary main-session completion response/i,
  );
  assert.match(validator, /must contain 1 to 5 questions/);
  assert.match(validator, /exposes comprehensionCheck/);
  assert.match(validator, /Container\/Hill heading/);
});

test("review orchestration allows named, generic, or main-session execution", () => {
  const dispatch = read("references/subagent-dispatch.md");
  const skills = [
    read("skills/adr-review/SKILL.md"),
    read("skills/adr-impl-review/SKILL.md"),
    read("skills/adr-impl-refactor/SKILL.md"),
  ];

  for (const skill of skills) {
    assert.match(skill, /\$\{CLAUDE_PLUGIN_ROOT\}\/references\/subagent-dispatch\.md/);
    assert.match(skill, /read .* completely/i);
  }

  assert.match(dispatch, /absolute path/i);
  assert.match(dispatch, /named agent/i);
  assert.match(dispatch, /generic read-only subagents/i);
  assert.match(dispatch, /main-session pass/i);
  assert.match(dispatch, /Do not create subagents merely to match a prescribed topology/);
  assert.match(dispatch, /private reasoning/i);
});

test("unsupported review orchestration falls back without prescribing an agent topology", () => {
  const dispatch = read("references/subagent-dispatch.md");
  const review = read("skills/adr-review/SKILL.md");
  const implReview = read("skills/adr-impl-review/SKILL.md");
  const refactor = read("skills/adr-impl-refactor/SKILL.md");

  assert.match(dispatch, /Provider capability gate/);
  assert.match(dispatch, /known not to support subagents/);
  assert.match(dispatch, /do not attempt a\s+named or generic dispatch/);
  assert.match(dispatch, /validation_error/);
  assert.match(dispatch, /Invalid 'input': value did not match any expected variant/);
  assert.match(dispatch, /do not retry/);

  assert.match(review, /named reviewers, generic read-only subagents, main-session passes/);
  assert.match(implReview, /smallest available strategy/);
  assert.match(refactor, /main-session candidate may still become `APPLY_NOW`/);
  assert.match(refactor, /Agent topology is not a classification input/);
});

test("the harness is removable and action-level orchestration stays model-selected", () => {
  const contract = read("references/non-invasive-harness.md");
  const concepts = read("templates/adr/concepts.md");
  const rootReadme = read("../../README.md");
  const pluginReadme = read("README.md");

  for (const source of [contract, concepts, rootReadme, pluginReadme]) {
    assert.match(source, /remov|Removing|Uninstall/i);
    assert.match(source, /private\s+(?:chain-of-thought|reasoning)/i);
    assert.match(source, /subagent/i);
  }

  for (const skill of [
    read("skills/adr-review/SKILL.md"),
    read("skills/adr-impl-review/SKILL.md"),
    read("skills/adr-impl-refactor/SKILL.md"),
  ]) {
    assert.match(skill, /non-invasive-harness\.md/);
  }

  assert.match(contract, /comprehension-load behavior/);
  assert.match(contract, /risk-selected review mode/);
  assert.match(contract, /Choose the smallest execution strategy/);
});

test("sufficiency review is a pre-promotion completion gate", () => {
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  assert.match(sufficiency, /before a `Proposed` ADR is promoted/);
  assert.doesNotMatch(sufficiency, /finishes implementation and Status promotion/);
});

test("large skill details are loaded through explicit progressive-disclosure references", () => {
  const sync = read("skills/adr-sync/SKILL.md");
  const hygiene = read("skills/adr-sync/references/repository-hygiene.md");
  const localEvidence = read("skills/adr-sync/references/local-evidence-boundary.md");
  const reconstruction = read("skills/adr-sync/references/current-state-reconstruction.md");
  const reconciliation = read("skills/adr-sync/references/reconciliation-boundary.md");
  const implReview = read("skills/adr-impl-review/SKILL.md");
  const artifactContract = read("skills/adr-impl-review/references/artifact-contract.md");
  const remediationRouting = read("skills/adr-impl-review/references/remediation-routing.md");
  const reviewHiking = read("skills/adr-impl-review/references/review-hiking.md");

  assert.match(sync, /read `references\/repository-hygiene\.md` completely/);
  assert.match(sync, /Do not read that reference.*when no candidate exists/);
  assert.match(
    sync,
    /Before starting Pass 2, read `references\/repository-hygiene\.md` completely/,
  );
  assert.match(sync, /read `references\/reconciliation-boundary\.md` completely/);
  assert.match(sync, /read `references\/local-evidence-boundary\.md` completely/);
  assert.match(sync, /read `references\/current-state-reconstruction\.md` completely/);
  assert.doesNotMatch(sync, /^### 3\.5\./m);
  assert.ok(sync.trim().split(/\s+/).length < 5000, "adr-sync SKILL.md should stay below 5k words");
  assert.ok(
    sync.trim().split(/\s+/).length < 4000,
    "adr-sync core should stay below 4k words after extracting conditional detail",
  );

  assert.match(localEvidence, /^## What adr-sync never does$/m);
  assert.match(localEvidence, /including read-only access/i);
  assert.match(localEvidence, /Runtime state unverified/);
  assert.match(reconstruction, /^## Preserve current prohibitions$/m);
  assert.match(reconciliation, /^## Non-numeric requirements$/m);

  for (const section of [
    "Category slice integrity",
    "Canonical stale Feature-ID naming",
    "Companion documents and invariants",
    "Mapping and index hygiene",
  ]) {
    assert.match(hygiene, new RegExp(`^## ${section}$`, "m"));
  }

  assert.match(
    implReview,
    /Only after evidence synthesis and verdict selection, read\s+`references\/artifact-contract\.md` completely/i,
  );
  assert.match(
    implReview,
    /Do not load it during scope\s+discovery or the independent review perspectives/i,
  );
  assert.match(
    implReview,
    /Only when findings exist[\s\S]{0,160}read\s+`references\/remediation-routing\.md` completely/i,
  );
  assert.match(artifactContract, /Implementation review artifact contract/);
  assert.match(remediationRouting, /Implementation review remediation routing/);
  assert.match(implReview, /read `references\/review-hiking\.md` completely/i);
  assert.match(reviewHiking, /Review Hiking/);
  assert.ok(
    implReview.trim().split(/\s+/).length < 4500,
    "adr-impl-review SKILL.md should stay below 4.5k words",
  );
});

test("implementation and review Hiking use vertical Hills with review zooms", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  const implementationHiking = read("skills/adr-impl/references/implementation-hiking.md");
  const review = read("skills/adr-impl-review/SKILL.md");
  const reviewHiking = read("skills/adr-impl-review/references/review-hiking.md");
  const artifactContract = read("skills/adr-impl-review/references/artifact-contract.md");

  assert.match(impl, /read `references\/implementation-hiking\.md` completely/i);
  assert.match(implementationHiking, /user-flow/);
  assert.match(implementationHiking, /logical-capability/);
  assert.match(implementationHiking, /bounded-context/);
  assert.match(implementationHiking, /Preconditions and surrounding context/);
  assert.match(implementationHiking, /Core design and contracts/);
  assert.match(implementationHiking, /Implementation/);
  assert.match(implementationHiking, /Verification/);
  assert.match(implementationHiking, /Never use frontend\/backend\/data layers/);
  assert.match(
    impl,
    /Finish the Hill's necessary cross-layer behavior and targeted ideal\/edge verification/,
  );
  assert.match(review, /Implementation Hill boundaries, reuse them/i);
  assert.match(reviewHiking, /Context/);
  assert.match(reviewHiking, /sliceType/);
  assert.match(reviewHiking, /Components/);
  assert.match(reviewHiking, /Code evidence/);
  assert.match(artifactContract, /generated review context from findings\.json/);
  assert.match(artifactContract, /generated container zoom from findings\.json/);
  assert.match(artifactContract, /generated component zoom from findings\.json/);
  for (const source of [impl, implementationHiking, review, reviewHiking]) {
    assert.doesNotMatch(source, /close(?:d|s)?\s+(?:one\s+)?Hill|Hill\s+is\s+closed/i);
  }
});

test("reader-facing prompts name concrete writing patterns without a generic quality label", () => {
  const sources = [
    read("references/reader-first-writing.md"),
    read("references/review-report-writing.md"),
    read("skills/adr-new/SKILL.md"),
    read("agents/adr-reviewer.md"),
    read("agents/adr-impl-review-report-writer.md"),
  ];

  for (const source of sources) {
    assert.doesNotMatch(source, /AI[- ]?slop/i);
    assert.match(source, /repeated contrast|mechanical writing|Reader-first prose quality/i);
  }
});

test("core skill prompts stay within the progressive-disclosure budget", () => {
  const budgets = [
    ["skills/adr-new/SKILL.md", 6500],
    ["skills/adr-impl/SKILL.md", 6000],
    ["skills/adr-impl-review/SKILL.md", 4500],
    ["skills/adr-sync/SKILL.md", 5000],
    ["skills/adr-rollup/SKILL.md", 5000],
    ["../alps-writer/skills/feature-to-adr/SKILL.md", 2500],
  ];

  for (const [file, maximum] of budgets) {
    const words = read(file).trim().split(/\s+/).length;
    assert.ok(words < maximum, `${file} should stay below ${maximum} words; got ${words}`);
  }
});

test("Bedrock troubleshooting documents the supported Codex feature flag and review fallbacks", () => {
  const pluginReadme = read("README.md");
  const rootReadme = read("../../README.md");

  assert.match(pluginReadme, /Amazon Bedrock rejects a subagent request/);
  assert.match(pluginReadme, /developers\.openai\.com\/codex\/amazon-bedrock/);
  assert.match(pluginReadme, /developers\.openai\.com\/api\/docs\/guides\/responses-multi-agent/);
  assert.match(pluginReadme, /\[features\]\s+multi_agent = false/);
  assert.match(pluginReadme, /in the `~\/\.codex\/config\.toml` used by the Bedrock session/);
  assert.match(pluginReadme, /start a new Codex session/);
  assert.match(pluginReadme, /do not retry another named or generic subagent/);
  assert.match(pluginReadme, /never edits a user's Codex configuration automatically/);
  assert.doesNotMatch(pluginReadme, /agents\.enabled/);

  assert.match(
    rootReadme,
    /plugins\/adr-writer\/README\.md#amazon-bedrock-rejects-a-subagent-request/,
  );
});

test("user documentation reflects the pre-implementation baseline and single lifecycle hook", () => {
  const sources = [
    read("../../README.md"),
    read("README.md"),
    read("../../docs/usage.md"),
    read("../../docs/adr-process.md"),
  ];

  for (const source of sources) {
    assert.doesNotMatch(source, /full:\s*(human gate|사람 게이트)/i);
    assert.doesNotMatch(source, /full mode adds human intent/i);
  }

  const processReviewSection =
    sources[3].match(/## 5\. \/adr-impl-review[\s\S]*?(?=\n## 6\.)/)?.[0] ?? "";
  assert.notEqual(processReviewSection, "", "adr-process is missing the impl-review section");
  assert.doesNotMatch(processReviewSection, /human-baseline\.md|사람 게이트 — 세 가지 질문/);
  assert.doesNotMatch(processReviewSection, /사용자가 finding을 판정/);
  assert.match(processReviewSection, /review-baseline\.md/);
  assert.match(processReviewSection, /증거 기반 코드·테스트 수정 자동 반영/);

  assert.match(sources[0], /does not run for every user prompt/);
  assert.match(
    sources[0],
    /ordinary main-session completion response never prints Q1 or starts grading/i,
  );
  assert.match(sources[1], /there is no `UserPromptSubmit` hook/);
  assert.match(sources[2], /there is no per-prompt `UserPromptSubmit` hook/);
  assert.match(sources[2], /approved (?:ADR )?baseline/);
  assert.match(sources[3], /구현 전에 승인된 기준선/);
  assert.match(sources[0], /critical command paths, routing, and efficiency review/);
  assert.match(sources[2], /critical command paths, routing, and efficiency review/);
  assert.doesNotMatch(sources[0], /eight diagrams|one per command's internals/);
  assert.doesNotMatch(sources[2], /eight diagrams|one per command's internals/);
});

test("adr-sync names the current README and concepts split", () => {
  const sync = read("skills/adr-sync/SKILL.md");

  assert.match(sync, /README\/concepts split/);
  assert.match(sync, /concepts material sits inside `README\.md`/);
  assert.doesNotMatch(sync, /README\/AGENTS split|AGENTS material sits inside/);
});

test("adr-impl uses a risk-selected refactor assessment before final review", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  const initialTests = impl.indexOf("initial implementation tests pass");
  const refactor = impl.indexOf("/adr-impl-refactor <category>");
  const fullTests = impl.indexOf("full project test command", refactor);
  const finalReview = impl.indexOf("/adr-impl-review <category>", fullTests);
  const promotion = impl.indexOf("Automatic Status transition", finalReview);

  for (const [label, position] of [
    ["initial tests", initialTests],
    ["refactor pass", refactor],
    ["full test rerun", fullTests],
    ["Status promotion", promotion],
    ["final implementation review", finalReview],
  ]) {
    assert.notEqual(position, -1, `adr-impl is missing ${label}`);
  }

  assert.ok(
    initialTests < refactor,
    "refactor assessment must start only after initial tests pass",
  );
  assert.ok(refactor < fullTests, "the full test rerun must exercise the refactored code");
  assert.ok(fullTests < finalReview, "the final review must inspect tested, refactored code");
  assert.ok(finalReview < promotion, "Accepted must be gated by a passing final review");
  assert.match(impl, /Do not pass it the refactor review or result artifacts/);
  assert.match(impl, /multi-call-site changes/);
  assert.match(impl, /skip the separate pass and record that basis/);
  assert.match(impl, /On `FIX_REQUIRED`, preserve the current lifecycle state/);
  assert.match(impl, /`BLOCK` and unresolved `INCONCLUSIVE` preserve the current lifecycle state/);

  const finalReviewSkill = read("skills/adr-impl-review/SKILL.md");
  const artifactContract = read("skills/adr-impl-review/references/artifact-contract.md");
  const remediationRouting = read("skills/adr-impl-review/references/remediation-routing.md");
  const finalReviewContract = `${finalReviewSkill}\n${artifactContract}\n${remediationRouting}`;
  assert.match(finalReviewSkill, /Report-only/);
  assert.match(finalReviewSkill, /This command itself remains report-only/);
  assert.match(finalReviewSkill, /selected pre-promotion completion review/);
  assert.match(finalReviewSkill, /Select the review mode/);
  assert.match(finalReviewSkill, /Use `standard` only for localized implementation/);
  assert.match(finalReviewSkill, /Use `full` when any of these surfaces changes/);
  assert.match(
    finalReviewSkill,
    /In full mode, the necessity and sufficiency perspectives are grounded separately/,
  );
  assert.match(remediationRouting, /Auto-remediate in the caller/);
  assert.match(artifactContract, /must not ask the user to rule\s+`apply \/ skip \/ defer`/);
  assert.match(remediationRouting, /no routine post-implementation approval\s+remains/);
  assert.match(finalReviewSkill, /elapsed time, per-perspective finding counts/);
  assert.match(finalReviewSkill, /complete implementation scope/i);
  assert.match(finalReviewSkill, /never the ceiling of the implementation\s+review/i);
  assert.match(finalReviewSkill, /direct and indirect callers and callees/i);
  assert.match(artifactContract, /Validate and build the HTML in both modes/i);
  assert.match(
    artifactContract,
    /node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/adr-impl-review-open\.mjs <artifact-dir>\/adr-impl-review-report\.html/i,
  );
  assert.match(artifactContract, /attempts the host's default browser exactly once/i);
  assert.match(
    finalReviewContract,
    /Never report either review mode complete without a validated, non-empty `adr-impl-review-report\.html`/i,
  );
  assert.match(
    finalReviewContract,
    /Never finish either review mode without running `adr-impl-review-open\.mjs` once/i,
  );

  const explainer = read("agents/adr-impl-explainer.md");
  const necessity = read("agents/adr-impl-necessity-reviewer.md");
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const reportWriter = read("agents/adr-impl-review-report-writer.md");
  assert.match(explainer, /complete implementation scope/i);
  assert.match(explainer, /Do not stop at files present in the diff/i);
  assert.match(
    necessity,
    /standalone(?: existing-implementation review|\s+review of an existing implementation)/i,
  );
  assert.match(sufficiency, /diff explains what changed;\s+it never limits/i);
  assert.match(sufficiency, /configuration, generated code, and surviving old paths/i);
  assert.match(reportWriter, /distinguish the complete implementation scope/i);

  assert.match(impl, /implementation intent baseline/);
  assert.match(impl, /once per ADR revision/);
  assert.match(impl, /reuse that approved baseline/);
  assert.match(impl, /non-blocking progress update/);
  assert.match(impl, /score is below `8\/10`[\s\S]{0,100}without asking for approval or waiting/i);
  assert.match(impl, /`8\/10` or higher[\s\S]{0,120}split-review-versus-original-ADR/i);
  assert.match(impl, /Do not include concrete split candidates/i);
  assert.match(impl, /publish the implementation plan as a progress update/i);
  assert.match(impl, /Do not demote an unchanged `Accepted` ADR to `Proposed`/i);
  assert.match(impl, /unchanged behavior-preserving reinforcement.*remains `Accepted`/i);
  assert.match(impl, /do not run the transition script/i);
  assert.doesNotMatch(impl, /only obtain normal approval for the implementation plan/i);
  assert.match(impl, /externally checkable assumption/i);
  assert.match(impl, /contract\/safety-affecting implementation premise unverified/i);
  assert.match(impl, /Resolve gaps before asking questions/i);
  assert.match(impl, /derived obligation/i);
  assert.match(impl, /Auto-resolve a domain default/i);
  assert.match(impl, /Decision request/i);
  assert.doesNotMatch(
    impl,
    /If an admitted decision or requirement changed, confirm once with the user/i,
  );
  assert.match(impl, /Do not repeat this routine confirmation after implementation/);
  assert.match(impl, /automatically apply evidence-backed changes/);
  assert.match(impl, /Do not ask the user to approve each repair/);
  assert.match(impl, /Do not ask for another approval/);
});

test("no maintenance command bypasses the final review when promoting Proposed", () => {
  const concepts = read("templates/adr/concepts.md");
  const sync = read("skills/adr-sync/SKILL.md");
  const rollup = read("skills/adr-rollup/SKILL.md");

  assert.match(
    concepts,
    /does \*\*not\*\* promote a `Proposed` ADR merely because code and tests exist/,
  );
  assert.match(sync, /Do \*\*not\*\* promote `Proposed` merely because code and tests exist/);
  assert.match(sync, /route it to `\/adr-impl <category>`/);
  assert.match(rollup, /every decision included in it came from already-`Accepted` ADRs/);
  assert.match(rollup, /tests and final implementation review pass/);
});

test("rollup keeps numbering gaps unless exact renames are explicitly approved", () => {
  const rollup = read("skills/adr-rollup/SKILL.md");

  assert.match(rollup, /does not respond or the answer is unclear: leave the gap/i);
  assert.match(rollup, /every old → new path/i);
  assert.doesNotMatch(rollup, /Default \(if the user does not respond\): close it/i);
});

test("adr-impl-refactor auto-applies only locally verified behavior-preserving changes", () => {
  const skill = read("skills/adr-impl-refactor/SKILL.md");
  const reviewer = read("agents/adr-impl-refactor-reviewer.md");

  assert.match(skill, /model-selected review passes/);
  assert.match(skill, /With no target, show the `Accepted` ADR list/);
  assert.match(skill, /mixes several implementations/);
  assert.match(skill, /Auto-apply a candidate only when every condition holds/);
  assert.match(skill, /preserves the ADR decision, requirement contract, observable behavior/);
  assert.match(skill, /Confidence is `high`/);
  assert.match(skill, /tests passed before the change and can run after it/);
  assert.match(skill, /Critical priority never overrides the gate/);
  assert.match(skill, /undo only that candidate's edits/);
  assert.match(skill, /move the candidate to `PROPOSE_ONLY`/);
  assert.match(skill, /Do not use destructive worktree commands/);
  assert.match(skill, /main-session candidate may still become `APPLY_NOW`/);
  assert.match(skill, /candidate was rechecked against the original ADR/);

  for (const protectedSurface of [
    /APIs or wire forms/,
    /schemas or persistence/,
    /states or transitions/,
    /permissions or visibility/,
    /concurrency/,
    /transactions/,
    /error semantics/,
  ]) {
    assert.match(skill, protectedSurface);
  }

  assert.match(reviewer, /Never edit code, ADRs, tests, or the mapping/);
  assert.match(reviewer, /APPLY_NOW/);
  assert.match(reviewer, /PROPOSE_ONLY/);
  assert.match(reviewer, /A critical issue does not bypass this boundary/);
  assert.doesNotMatch(reviewer.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "", /Edit|Write/);
});

test("refactor review requires concrete efficiency evidence and proportionate reuse", () => {
  const skill = read("skills/adr-impl-refactor/SKILL.md");
  const reviewer = read("agents/adr-impl-refactor-reviewer.md");

  for (const source of [skill, reviewer]) {
    assert.match(source, /same-semantics duplication/);
    assert.match(source, /one caller/);
    assert.match(source, /hypothetical future/);
    assert.match(source, /speculative caching, concurrency, batching, or micro-optimization/);
  }

  assert.match(reviewer, /repeated parsing, serialization, traversal, lookup, allocation, I\/O/);
  assert.match(reviewer, /Require direct code evidence or a reproducible measurement/);
  assert.match(reviewer, /Do not merge code that only looks syntactically similar/);
  assert.match(skill, /priority, expected benefit, risk, estimated scope and verification/);
  assert.match(skill, /only when at least one candidate was kept/);
  assert.match(skill, /reuse the passing baseline/);
});

test("spec fitness is approved before implementation and not reopened as a routine completion gate", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  const impl = read("skills/adr-impl/SKILL.md");
  const adrNew = read("skills/adr-new/SKILL.md");

  assert.match(adrNew, /complete regeneration checklist match your intent/);
  assert.match(adrNew, /routine intent\/spec-fitness confirmation/);
  assert.match(impl, /implementation intent baseline/);
  assert.match(impl, /complete enough to rebuild requirement-honoring code/);
  assert.match(skill, /does not reopen it as a routine post-implementation gate/);
  assert.match(skill, /Concrete evidence that the ADR itself is incomplete/);
  assert.doesNotMatch(skill, /confirm the following three questions/);

  // The sufficiency reviewer keeps the approved ADR as the contract.
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  assert.match(sufficiency, /assume the ADR is correct/);
  assert.match(sufficiency, /approved review baseline/);
});

test("sufficiency reviewer tests the tests — mutation and static analysis as verification lenses", () => {
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  const evidence = read("references/implementation-evidence.md");
  assert.match(sufficiency, /implementation-evidence\.md/);
  assert.match(skill, /implementation-evidence\.md/);
  assert.match(evidence, /mutation/);
  assert.match(evidence, /static, or security tooling/i);
  // Use only already-configured tooling; never install anything new.
  assert.match(evidence, /already exists/);
  assert.match(evidence, /Do not install new tools/);
});

// Language-native documentation carries why/how, while tests carry executable ideal and
// edge behavior. Direct ADR references are forbidden even inside those comments: shared
// domain vocabulary improves search without coupling code to a decision-file location.
test("adr implementation requires standard function docs plus ideal and edge tests", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  const evidence = read("references/implementation-evidence.md");
  assert.match(impl, /implementation-evidence\.md/);
  assert.match(evidence, /GoDoc/);
  assert.match(evidence, /Python docstring/);
  assert.match(evidence, /why the function is needed/i);
  assert.match(evidence, /how it enforces/i);
  assert.match(evidence, /requirement-contract vocabulary/i);
  assert.match(evidence, /never cite the ADR itself/i);
  assert.match(evidence, /no ADR number/);
  assert.match(evidence, /may exceed three lines/i);
  assert.match(evidence, /at least one ideal-case automated test/i);
  assert.match(evidence, /every edge case relevant/i);
  assert.match(evidence, /roughly three lines/i);
  assert.match(evidence, /move the what\s+into tests/i);
  assert.match(evidence, /Do not delete a long comment before its cases are covered/i);

  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  for (const source of [sufficiency, skill]) {
    assert.match(source, /implementation-evidence\.md/);
  }

  const necessity = read("agents/adr-impl-necessity-reviewer.md");
  assert.match(necessity, /implementation-evidence\.md/);
  assert.match(necessity, /not\s+removable scope/i);

  const writer = read("agents/adr-impl-review-report-writer.md");
  assert.match(writer, /implementation-evidence\.md/);
});

test("implementation review keeps contract evidence without a mandatory merge checklist", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  const artifactContract = read("skills/adr-impl-review/references/artifact-contract.md");
  const reviewContract = `${skill}\n${artifactContract}`;
  const materializer = read("scripts/adr-impl-review-materialize.mjs");
  assert.match(writer, /ADR contract coverage/);
  assert.match(reviewContract, /ADR contract coverage/);
  assert.match(writer, /PROVEN/);
  assert.match(reviewContract, /contractCoverage/);
  assert.match(reviewContract, /PASS.*every contract-coverage row.*PROVEN/is);
  assert.match(materializer, /implementation: "Implementation"/);
  assert.match(materializer, /evidence: "Evidence"/);
  assert.match(materializer, /tests: "Tests"/);
  assert.match(materializer, /seven audit fields remain authoritative in findings\.json/i);
  assert.match(materializer, /Selected value or behavior/);
  assert.match(writer, /generated from findings\.json/);
  assert.match(artifactContract, /adr-impl-review-materialize\.mjs/);
  assert.match(writer, /Residual risks/);
  assert.doesNotMatch(writer, /Merge decision checklist/);
  assert.doesNotMatch(reviewContract, /seven-axis merge decision checklist/);
});

test("ADR rationale quality is not reduced to driver and alternative quotas", () => {
  const rules = read("templates/adr/authoring-rules.md");
  const reviewer = read("agents/adr-reviewer.md");

  assert.match(rules, /default, not a validity threshold/);
  assert.match(rules, /Never invent a strawman to satisfy a count/);
  assert.match(reviewer, /3-5 is a default, not a quota/);
  assert.match(reviewer, /constrained the choice/);
});

test("repair guidance is conditional and Mermaid may appear across narrative sections", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");

  assert.match(writer, /FIX_REQUIRED|BLOCK/);
  assert.match(writer, /user asks/i);
  assert.match(writer, /only when/i);
  assert.match(writer, /flowchart/);
  assert.match(writer, /sequenceDiagram/);
  assert.match(writer, /stateDiagram-v2/);
  assert.match(writer, /erDiagram/);
  assert.match(writer, /Never use ASCII or box-drawing diagrams/);
  assert.match(writer, /Draw only relationships confirmed in the actual code/);
  assert.match(writer, /one-diagram or one-section limit/);
  assert.match(writer, /Hill/);
  assert.doesNotMatch(writer, /Include at least:/);
  assert.match(writer, /Files and symbols to change/);
  assert.match(writer, /Scope not to touch/);
  assert.match(writer, /Completion criteria/);
  assert.match(writer, /Residual risks/);
});

test("human-facing review reports use one junior-readable visual writing guide", () => {
  const guide = read("references/review-report-writing.md");
  const reportProducers = [
    read("skills/adr-review/SKILL.md"),
    read("skills/adr-sync/SKILL.md"),
    read("skills/adr-impl-review/references/artifact-contract.md"),
    read("skills/adr-impl-refactor/SKILL.md"),
    read("agents/adr-impl-review-report-writer.md"),
  ];

  for (const source of reportProducers) {
    assert.match(source, /references\/review-report-writing\.md/);
    assert.match(source, /read[\s\S]{0,120}completely/i);
    assert.match(source, /At a glance/);
  }

  for (const trigger of [
    /three or more participants/,
    /system boundary, dependency, or contradiction/,
    /state transition, failure, retry, rollback, or fallback/,
    /refactor spanning multiple call sites/,
  ]) {
    assert.match(guide, trigger);
  }

  for (const diagram of [/sequenceDiagram/, /stateDiagram-v2/, /flowchart/, /erDiagram/]) {
    assert.match(guide, diagram);
  }

  assert.match(guide, /junior developer seeing the subject for the first time/i);
  assert.match(
    guide,
    /Every sentence must contribute a verdict, contract, evidence, impact, action, or\s+risk/i,
  );
  assert.match(guide, /praise, reassurance, and conversational applause/i);
  assert.match(guide, /generic best-practice advice/i);
  assert.match(
    guide,
    /The prose must remain\s+independently reviewable when Mermaid does not render/i,
  );
  assert.match(guide, /local one-file PASS or\s+a single-document PASS may omit a diagram/i);
});
