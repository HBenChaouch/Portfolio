import { VALUATION_CONTEXT } from "./sidetradeFinancials.js";

export const portfolioCases = [
  {
    slug: "sidetrade-valuation",
    title: "Sidetrade",
    category: "Public SaaS valuation",
    description:
      "QoE, cash conversion, three DCF scenarios, comparables, LBO affordability and the full EV-to-equity bridge.",
    status: "Flagship case",
    href: "/cases/sidetrade-valuation",
    cta: "Open the full case",
    priority: "flagship",
    metrics: [
      `€${VALUATION_CONTEXT.fairValueEv.toFixed(0)}m EV (DCF)`,
      `€${VALUATION_CONTEXT.controlEv.toFixed(0)}m control case`,
      "Bear/Base/Bull DCF",
    ],
  },
  {
    slug: "opella-carve-out",
    title: "Opella",
    category: "Carve-out & TSA",
    description:
      "A carve-out case focused on the standalone perimeter, TSA unwind, stranded costs and separation mechanics. Currently in development.",
    status: "In development",
    cta: "Case in development",
    available: false,
    metrics: ["Standalone perimeter", "TSA unwind", "Stranded costs"],
  },
  {
    slug: "real-estate-downside",
    title: "Real Estate",
    category: "Downside fund controlling",
    description:
      "A decision cockpit for downside monitoring, covenant pressure, liquidity and asset-level portfolio risk.",
    status: "Operational cockpit",
    href: "/cases/real-estate-downside/",
    cta: "Open the cockpit",
    static: true,
    metrics: ["Downside", "Covenants", "Liquidity"],
  },
];
