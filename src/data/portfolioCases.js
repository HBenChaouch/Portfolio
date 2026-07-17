import { VALUATION_CONTEXT } from "./sidetradeFinancials.js";

export const portfolioCases = [
  {
    slug: "sidetrade-valuation",
    title: "Sidetrade Valuation",
    category: "Public SaaS valuation",
    description:
      "DCF, trading comps, precedent transactions and LBO affordability for a profitable Order-to-Cash SaaS.",
    status: "Migrated case",
    href: "/cases/sidetrade-valuation",
    metrics: [
      `€${VALUATION_CONTEXT.fairValueEv.toFixed(0)}m EV (DCF)`,
      `€${VALUATION_CONTEXT.controlEv.toFixed(0)}m control case`,
      "Bear/Base/Bull DCF",
    ],
  },
  {
    slug: "lbo-sponsor-case",
    title: "Sponsor LBO Case",
    category: "Coming next",
    description:
      "Debt capacity, entry valuation, IRR bridge, exit multiple and downside protection.",
    status: "Planned",
    href: "#",
    metrics: ["Debt capacity", "IRR bridge", "Sensitivity"],
  },
  {
    slug: "saas-unit-economics",
    title: "SaaS Operating Model",
    category: "Coming next",
    description:
      "ARR bridge, churn, NRR, CAC payback, sales efficiency and margin expansion model.",
    status: "Planned",
    href: "#",
    metrics: ["ARR bridge", "NRR", "CAC payback"],
  },
];
