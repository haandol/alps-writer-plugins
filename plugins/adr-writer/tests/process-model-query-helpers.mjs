// Fixtures that process-model-query.test.mjs and process-model-query.integration.test.mjs share.
import { MODEL, PM, RDFS, checkRealizes, validateModel } from "../scripts/process-model-lib.mjs";
import { queryContext } from "../scripts/process-model-query.mjs";
import { EXAMPLE } from "./process-model-helpers.mjs";

export const HEAD = `@prefix m: <${MODEL}> .\n@prefix pm: <${PM}> .\n@prefix rdfs: <${RDFS}> .\n\n`;

/** A third process that reacts to "payment completed" and shares the Order concept. */
export const SHIPPING = `${HEAD}m:shipping a pm:BoundedContext ; rdfs:label "Shipping" ; pm:definition "Getting paid orders to customers." .
m:warehouse a pm:Actor ; rdfs:label "Warehouse" ; pm:definition "Staff who pack orders." .
m:shipping.ship-order a pm:Process ; rdfs:label "Ship an order" ; pm:definition "A paid order is packed and sent." ;
  pm:startCondition "A payment completes." ; pm:businessOutcome "The parcel leaves the warehouse." ;
  pm:openScope "none"^^pm:NoOpenScope ; pm:status "Accepted (2020-01-01)" ; pm:hasStep m:shipping.pack-order .
m:shipping.pack-order a pm:Step ; rdfs:label "Pack the order" ; pm:definition "The warehouse packs the order lines." ;
  pm:stepKind "system" ; pm:inContext m:shipping ; pm:uses m:ordering.order .
m:warehouse pm:performs m:shipping.pack-order .
m:shipping.pack-when-paid a pm:Policy ; rdfs:label "Pack when paid" ; pm:definition "Paid orders go to packing." ;
  pm:reactionCondition "The order is paid." ; pm:basisKind "operating-policy" ; pm:basis "Fulfilment policy." ;
  pm:inContext m:shipping ; pm:starts m:shipping.pack-order .
m:payment.payment-completed pm:triggers m:shipping.pack-when-paid .
m:shipping.ship-order.sent a pm:ObservationCriterion ; rdfs:label "Paid orders leave" ; pm:startCondition "A payment completes." ;
  pm:observedResult "The parcel is sent." ; pm:criterionOf m:shipping.ship-order ; pm:passesThrough m:payment.payment-completed .
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
    texts.map((text, i) => ({ doc: `docs/process/d${i}.ttl`, text })),
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
