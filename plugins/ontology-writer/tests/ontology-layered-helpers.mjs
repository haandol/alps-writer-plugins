import { MODEL, ONTO, validateModel } from "../scripts/ontology-lib.mjs";
import { write, writeAdrFiles } from "./helpers.mjs";

export const BUSINESS = `@prefix m: <${MODEL}> .
@prefix onto: <${ONTO}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
m:studio a onto:BoundedContext ; rdfs:label "Creative studio" ;
 onto:definition "Own visual creation and reusable material." ;
 onto:coreLogic "An image request reserves credit before producing its result." ; onto:collaboratesWith m:billing .
m:billing a onto:BoundedContext ; rdfs:label "Billing" ; onto:definition "Own prepaid balances." ;
 onto:coreLogic "A confirmed reservation allows a creator to spend once." .
m:creator a onto:Actor ; rdfs:label "Creator" ; onto:definition "The person requesting visual work." ;
 onto:performs m:studio.request, m:studio.animate, m:studio.manual .
m:service a onto:Actor ; rdfs:label "Payment provider" ; onto:definition "An external payment provider." ;
 onto:performs m:billing.reserve, m:billing.take .
m:studio.image a onto:Process ; rdfs:label "이미지 제작" ; onto:definition "Produce a reusable image after reserving credit." ;
 onto:startCondition "A creator requests an image." ; onto:businessOutcome "A reusable image is available." ;
 onto:openScope "Refund after uncertain delivery needs confirmation."^^onto:OpenPath ; onto:status "Proposed" ;
 onto:hasStep m:studio.request, m:billing.reserve .
m:studio.animation a onto:Process ; rdfs:label "애니메이션 제작" ; onto:definition "Produce a reusable animation." ;
 onto:startCondition "A creator requests movement." ; onto:businessOutcome "An animation is available." ;
 onto:openScope "none"^^onto:NoOpenScope ; onto:status "Proposed" ; onto:hasStep m:studio.animate, m:studio.manual .
m:billing.collect a onto:Process ; rdfs:label "Deliver purchased credit" ; onto:definition "Deliver confirmed purchased credit." ;
 onto:startCondition "A payment is confirmed." ; onto:businessOutcome "Credit is delivered." ;
 onto:openScope "none"^^onto:NoOpenScope ; onto:status "Proposed" ; onto:hasStep m:billing.take .
m:studio.request a onto:Step ; rdfs:label "Request an image" ; onto:definition "Choose material and request a reusable image." ;
 onto:stepKind "system" ; onto:inContext m:studio ; onto:uses m:studio.asset ; onto:emits m:studio.requested ; onto:flowsTo m:billing.reserve .
m:billing.reserve a onto:Step ; rdfs:label "Reserve credit" ; onto:definition "Reserve the amount for the image." ;
 onto:stepKind "system" ; onto:inContext m:billing ; onto:emits m:billing.reserved .
m:studio.animate a onto:Step ; rdfs:label "Animate image" ; onto:definition "Animate the selected image." ;
 onto:stepKind "system" ; onto:inContext m:studio ; onto:uses m:studio.asset ; onto:flowsTo m:studio.manual .
m:studio.manual a onto:Step ; rdfs:label "Check the animation" ; onto:definition "The creator checks the animation manually." ;
 onto:stepKind "outside-system" ; onto:inContext m:studio .
m:billing.take a onto:Step ; rdfs:label "Receive the payment" ; onto:definition "Receive confirmed payment." ;
 onto:stepKind "system" ; onto:inContext m:billing ; onto:emits m:billing.paid .
m:studio.requested a onto:BusinessEvent ; rdfs:label "Image requested" ; onto:definition "Image creation was requested." ;
 onto:inContext m:studio ; onto:triggers m:billing.reserve-policy .
m:billing.reserve-policy a onto:Policy ; rdfs:label "Reserve for image work" ; onto:definition "Reserve on a new request." ;
 onto:reactionCondition "The creator has authorized the quoted amount." ; onto:basisKind "user-decision" ; onto:basis "Business workshop" ; onto:inContext m:billing ; onto:starts m:billing.reserve .
m:billing.reserved a onto:BusinessEvent ; rdfs:label "Credit reserved" ; onto:definition "Credit was reserved." ;
 onto:inContext m:billing ; onto:triggers m:studio.retry-policy .
m:studio.retry-policy a onto:Policy ; rdfs:label "Revisit the request" ; onto:definition "Revisit an interrupted request." ;
 onto:reactionCondition "The earlier result is still unknown." ; onto:basisKind "user-decision" ; onto:basis "Business workshop" ; onto:inContext m:studio ; onto:starts m:studio.request .
m:billing.paid a onto:BusinessEvent ; rdfs:label "Payment received" ; onto:definition "A payment was received." ;
 onto:inContext m:billing ; onto:triggers m:billing.deliver-policy .
m:billing.deliver-policy a onto:Policy ; rdfs:label "Allow reservation" ; onto:definition "A confirmed payment permits reservation." ;
 onto:reactionCondition "The payment matches this creator and has not been delivered." ; onto:basisKind "user-decision" ; onto:basis "Business workshop" ; onto:inContext m:billing ; onto:starts m:billing.reserve .
m:studio.asset a onto:BusinessConcept ; rdfs:label "Reusable image" ; onto:definition "Owned material usable for visual work." ; onto:inContext m:studio .
m:studio.keep a onto:BusinessRule ; rdfs:label "Keep ownership" ; onto:definition "Only the owner can reuse material." ; onto:basisKind "user-decision" ; onto:basis "Business workshop" ; onto:constrains m:studio.asset .
m:studio.image-result a onto:ObservationCriterion ; rdfs:label "An image is reusable" ;
 onto:startCondition "A creator requests an image." ; onto:observedResult "The owner can reuse the result." ; onto:criterionOf m:studio.image .
m:studio.animation-result a onto:ObservationCriterion ; rdfs:label "An animation is reusable" ;
 onto:startCondition "A creator requests an animation." ; onto:observedResult "The owner can reuse the animation." ; onto:criterionOf m:studio.animation .
m:billing.result a onto:ObservationCriterion ; rdfs:label "Purchased credit is delivered once" ;
 onto:startCondition "Payment is confirmed." ; onto:observedResult "The balance gains the purchased credit once." ; onto:criterionOf m:billing.collect .
`;

export const ADR_PATH = "docs/adr/rendering/0001-render.md";
export const ADR_BODY = `# Render a visual result

## Status

Accepted (2026-10-01)

## Decision

Keep the owner's original material. Charge **at most once**.

| Condition | Outcome |
| --- | --- |
| An accepted request | A reusable result |

The [implementation](../../../../private/code.js) is a reference.

<script>window.__ontologyUntrustedAdrExecuted = true</script>
`;

export const LAYER_MAPPING = {
  categories: {
    rendering: {
      feature: "Visual rendering",
      adrs: [
        {
          path: ADR_PATH,
          status: "Accepted (2026-10-01)",
          summary: "Keep reusable results and charge at most once.",
        },
      ],
      realizes: ["studio.request", "studio.animate"],
      dependsOn: [],
    },
    billing: {
      feature: "Credit accounting",
      adrs: [
        {
          path: "docs/adr/billing/0001-credit.md",
          status: "Proposed",
          summary: "Preserve the confirmed purchased amount.",
        },
      ],
      realizes: ["billing.reserve", "billing.take"],
      dependsOn: [],
    },
  },
};

export const BUSINESS_BOARD = {
  version: 1,
  title: "Business evidence",
  scope: "Visual production and payment",
  origin: "candidate",
  contexts: [
    {
      id: "studio",
      name: "Creative studio",
      verdict: "stated",
      evidence: [{ source: "Business workshop" }],
    },
    {
      id: "billing",
      name: "Billing",
      verdict: "stated",
      evidence: [{ source: "Business workshop" }],
    },
  ],
  subdomains: [
    {
      id: "visual",
      name: "Visual production",
      responsibility: "Create visual material",
      classification: "core",
      contextIds: ["studio"],
      verdict: "inferred",
      evidence: [{ source: "Business workshop", detail: "Responsibility mapping" }],
    },
    {
      id: "delivery",
      name: "Delivery",
      responsibility: "Deliver paid outcomes",
      classification: "supporting",
      contextIds: ["studio", "billing"],
      verdict: "stated",
      evidence: [{ source: "Business workshop" }],
    },
  ],
  stages: [
    {
      id: "studio.request",
      action: "Request an image",
      actor: "Creator",
      context: "Creative studio",
      contextId: "studio",
      entities: [
        {
          name: "Creation request",
          kind: "entity",
          before: "Draft",
          after: "Submitted",
          verdict: "stated",
          evidence: [{ source: "Business workshop", detail: "Recorded transition" }],
        },
      ],
      views: [
        {
          name: "Creation form",
          role: "input",
          verdict: "stated",
          evidence: [{ source: "Business workshop" }],
        },
      ],
      event: { name: "Image requested" },
      policies: [],
      verdict: "stated",
      evidence: [{ source: "Business workshop" }],
    },
  ],
  links: [],
  questions: [],
};

/** Local documents used by both projection and actual CLI/browser tests. */
export function writeLayeredFixture(dir, { text = BUSINESS, mapping = LAYER_MAPPING } = {}) {
  write(dir, "docs/ontology/business.ttl", text);
  write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
  writeAdrFiles(dir, mapping);
  write(dir, ADR_PATH, ADR_BODY);
  write(dir, "board.json", JSON.stringify(BUSINESS_BOARD));
  return validateModel([{ doc: "docs/ontology/business.ttl", text }]);
}

export const layeredData = (html) =>
  JSON.parse(
    /<script type="application\/json" id="layered-data">([\s\S]*?)<\/script>/.exec(html)[1],
  );
