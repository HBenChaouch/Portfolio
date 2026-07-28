import { useMemo } from "react";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import { VALUATION_DATES } from "../data/sidetradeFinancials.js";
import {
  buildSidetradeAnalysisLocation,
  SIDETRADE_ANALYSIS_ROUTE,
} from "../utils/navigation.js";
import PortfolioCaseShell from "./PortfolioCaseShell.jsx";

const sidebarGroups = [
  {
    label: "Investment case",
    items: [
      { title: "Executive view", hash: "executive" },
      { title: "Company & revenue", hash: "snapshot" },
      { title: "Quality of Earnings", hash: "qoe" },
      { title: "Market reference", hash: "market" },
    ],
  },
  {
    label: "Valuation",
    items: [
      { title: "DCF", hash: "dcf" },
      { title: "Trading comps", hash: "trading" },
      { title: "Transaction comps", hash: "transaction" },
      { title: "LBO", hash: "lbo" },
    ],
  },
  {
    label: "Synthesis",
    items: [
      { title: "Football field", hash: "football" },
    ],
  },
  {
    label: "Audit trail",
    items: [
      { title: "Red flags & limits", hash: "red-flags" },
      { title: "Sources", hash: "sources" },
    ],
  },
];

const pageTitles = {
  summary: "Valuation Summary",
  analysis: "Long-form Analysis",
  methodology: "Methodology",
  documents: "Sources",
};

const scenarioControls = [
  { id: "bear", label: "Bear" },
  { id: "base", label: "Base" },
  { id: "bull", label: "Bull" },
];

function getCurrentTitle(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const leaf = segments.at(-1);
  return pageTitles[leaf] || "Long-form Analysis";
}

export default function CaseShell() {
  const { activeScenario, setActiveScenario } = useSidetradeScenario();
  const controls = useMemo(() => (
    <>
      <div className="scenario-segment" role="group" aria-label="Scenario">
        {scenarioControls.map((scenario) => (
          <button
            aria-pressed={activeScenario === scenario.id}
            className={activeScenario === scenario.id ? "active" : ""}
            key={scenario.id}
            onClick={() => setActiveScenario(scenario.id)}
            type="button"
          >
            <span className={`scenario-dot ${scenario.id}`} />
            {scenario.label}
          </button>
        ))}
      </div>
      <span className="control-date">
        <span className="control-date-full">Market ref. {VALUATION_DATES.marketMedium}</span>
        <span className="control-date-short">Market · {VALUATION_DATES.marketShort}</span>
      </span>
    </>
  ), [activeScenario, setActiveScenario]);

  return (
    <PortfolioCaseShell
      analysisRoute={SIDETRADE_ANALYSIS_ROUTE}
      brand="Sidetrade · Valuation"
      brandDetail="ALBFR.PA"
      buildAnalysisLocation={buildSidetradeAnalysisLocation}
      controls={controls}
      footerItems={["FY25 financials", VALUATION_DATES.marketLong]}
      getPageTitle={getCurrentTitle}
      mobileTitle="Sidetrade"
      navigationLabel="Sidetrade project navigation"
      roundingNote="Figures may not sum due to rounding."
      sectionNavigationId="sidetrade-section-navigation"
      sectionNavigationLabel="Sidetrade sections"
      sidebarGroups={sidebarGroups}
    />
  );
}
