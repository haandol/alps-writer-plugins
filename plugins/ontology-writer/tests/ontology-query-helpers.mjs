// Fixtures that ontology-query.test.mjs and ontology-query.integration.test.mjs share.
import { MODEL, ONTO, RDFS, checkRealizes, validateModel } from "../scripts/ontology-lib.mjs";
import { queryContext } from "../scripts/ontology-query.mjs";
import { EXAMPLE } from "./ontology-helpers.mjs";

export const HEAD = `@prefix m: <${MODEL}> .\n@prefix onto: <${ONTO}> .\n@prefix rdfs: <${RDFS}> .\n\n`;

/** A third process that reacts to "payment completed" and shares the Order concept. */
export const SHIPPING = `${HEAD}m:shipping a onto:BoundedContext ; rdfs:label "Shipping" ; onto:definition "Getting paid orders to customers." .
m:warehouse a onto:Actor ; rdfs:label "Warehouse" ; onto:definition "Staff who pack orders." .
m:shipping.ship-order a onto:Process ; rdfs:label "Ship an order" ; onto:definition "A paid order is packed and sent." ;
  onto:startCondition "A payment completes." ; onto:businessOutcome "The parcel leaves the warehouse." ;
  onto:openScope "none"^^onto:NoOpenScope ; onto:status "Accepted (2020-01-01)" ; onto:hasStep m:shipping.pack-order .
m:shipping.pack-order a onto:Step ; rdfs:label "Pack the order" ; onto:definition "The warehouse packs the order lines." ;
  onto:stepKind "system" ; onto:inContext m:shipping ; onto:uses m:ordering.order .
m:warehouse onto:performs m:shipping.pack-order .
m:shipping.pack-when-paid a onto:Policy ; rdfs:label "Pack when paid" ; onto:definition "Paid orders go to packing." ;
  onto:reactionCondition "The order is paid." ; onto:basisKind "operating-policy" ; onto:basis "Fulfilment policy." ;
  onto:inContext m:shipping ; onto:starts m:shipping.pack-order .
m:payment.payment-completed onto:triggers m:shipping.pack-when-paid .
m:shipping.ship-order.sent a onto:ObservationCriterion ; rdfs:label "Paid orders leave" ; onto:startCondition "A payment completes." ;
  onto:observedResult "The parcel is sent." ; onto:criterionOf m:shipping.ship-order ; onto:passesThrough m:payment.payment-completed .
`;

export const MAPPING = {
  categories: {
    ordering: {
      adrs: [{ path: "docs/adr/ordering/0001-confirm.md", status: "Proposed", summary: "s" }],
      realizes: ["ordering.confirm-order", "ordering.submit-order"],
    },
    payments: {
      adrs: [
        { path: "docs/adr/payments/0001-pay.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["payment.capture-payment", "payment.request-payment"],
    },
    fulfilment: {
      adrs: [
        { path: "docs/adr/fulfilment/0001-pack.md", status: "Accepted (2020-01-01)", summary: "s" },
      ],
      realizes: ["shipping.pack-order"],
    },
    reports: { adrs: [], realizes: [] },
    admin: { adrs: [] },
  },
};

export function run(
  target,
  {
    texts = [EXAMPLE, SHIPPING],
    mapping = MAPPING,
    includeRetired = false,
    changes = null,
    links = false,
    extra = [],
  } = {},
) {
  const v = validateModel(
    texts.map((text, i) => ({ doc: `docs/ontology/d${i}.ttl`, text })),
    { categoryKeys: Object.keys(mapping.categories) },
  );
  return queryContext({
    index: v.index,
    mapping,
    // `links` adds the ADR index link findings, as the CLI reads them; `extra` adds others.
    findings: [...v.findings, ...(links ? checkRealizes(mapping, v.index) : []), ...extra],
    changes,
    target,
    includeRetired,
  });
}
