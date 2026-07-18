import { VALUATION_CONTEXT } from "./sidetradeFinancials.js";

const publicAsset = (file) => `${import.meta.env?.BASE_URL ?? "/"}${file}`;

export const portfolioCases = [
  {
    slug: "sidetrade-valuation",
    title: "Sidetrade — Full Valuation Case",
    category: "Flagship · Public SaaS valuation",
    description:
      "A full investment case spanning QoE, cash conversion, DCF scenarios, comparables, LBO affordability and the EV-to-equity bridge.",
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
    title: "Opella — Carve-out & TSA",
    category: "Transaction Services",
    description:
      "A carve-out case focused on the standalone perimeter, TSA unwind, stranded costs and separation mechanics.",
    status: "Workbook case",
    href: publicAsset("Modele_Carveout_Opella.xlsx"),
    cta: "Download the workbook",
    download: "Modele_Carveout_Opella.xlsx",
    metrics: ["Standalone bridge", "TSA unwind", "Separation costs"],
  },
  {
    slug: "real-estate-downside",
    title: "Real Estate — Downside Cockpit",
    category: "Fund controlling",
    description:
      "A decision cockpit for downside monitoring, covenant pressure, liquidity and asset-level portfolio risk.",
    status: "Live cockpit",
    href: "https://hbenchaouch.github.io/cockpit-fund-controlling/",
    cta: "Open the cockpit",
    external: true,
    metrics: ["Downside", "Covenants", "Liquidity"],
  },
];
