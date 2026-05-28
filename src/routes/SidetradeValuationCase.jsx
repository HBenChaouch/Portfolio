import { useMemo } from "react";
import { motion } from "framer-motion";
import DataTable from "../components/DataTable.jsx";
import FootballField from "../components/FootballField.jsx";
import MetricTile from "../components/MetricTile.jsx";
import ScenarioSwitch from "../components/ScenarioSwitch.jsx";
import SensitivityTable from "../components/SensitivityTable.jsx";
import TrajectoryChart from "../components/TrajectoryChart.jsx";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import {
  snapshotRows,
  tradingComps,
  transactionComps,
} from "../data/sidetradeCase.js";
import {
  FY25,
  SCENARIOS,
  VALUATION_CONTEXT,
  enterpriseValue,
  equityBridge,
} from "../utils/dcfEngine.js";

function money(value, decimals = 0) {
  return `EUR${value.toFixed(decimals)}m`;
}

function pct(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

function scenarioAssumptionsRows() {
  const ids = ["bear", "base", "bull"];
  const labels = [
    ["Revenue growth 2026", (scenario) => pct(scenario.growth[0], 0)],
    ["Revenue growth 2027", (scenario) => pct(scenario.growth[1], 0)],
    ["Revenue growth 2028", (scenario) => pct(scenario.growth[2], 0)],
    ["Revenue growth 2029", (scenario) => pct(scenario.growth[3], 0)],
    ["Revenue growth 2030", (scenario) => pct(scenario.growth[4], 0)],
    ["EBITDA margin 2030", (scenario) => pct(scenario.ebitdaMargin2030, 0)],
    ["WACC", (scenario) => pct(scenario.wacc, 1)],
    ["Terminal growth", (scenario) => pct(scenario.g, 1)],
  ];

  return labels.map(([label, formatter]) => [
    label,
    ...ids.map((id) => formatter(SCENARIOS[id])),
  ]);
}

export default function SidetradeValuationCase() {
  const { activeScenario, scenario, setActiveScenario } = useSidetradeScenario();
  const baseBridge = equityBridge("base");
  const dcfLow = enterpriseValue("bear");
  const dcfBase = enterpriseValue(activeScenario);
  const dcfHigh = enterpriseValue("bull");
  const dynamicKeyStats = [
    { label: "Revenue FY25", value: money(FY25.revenue, 1), detail: "+14% constant currency" },
    { label: "EBITDA margin", value: pct(FY25.ebitdaMargin, 1), detail: `${money(FY25.ebitda, 1)} EBITDA` },
    { label: "Net debt", value: money(FY25.netDebt, 1), detail: "Strict net debt bridge" },
    { label: "Stand-alone EV", value: money(enterpriseValue("base"), 0), detail: "Central fair value" },
    { label: "Equity value", value: money(baseBridge.equity, 0), detail: `EUR${baseBridge.sharePrice.toFixed(0)} / share` },
    { label: "Control EV", value: money(VALUATION_CONTEXT.controlEv, 0), detail: "M&A precedent read" },
  ];
  const ranges = useMemo(() => {
    return [
      { method: "DCF", subtitle: "Fundamental", low: dcfLow, base: dcfBase, high: dcfHigh },
      { method: "Trading comps", subtitle: "Stand-alone", ...VALUATION_CONTEXT.tradingRange },
      { method: "Transaction comps", subtitle: "Control", ...VALUATION_CONTEXT.transactionRange },
      { method: "LBO", subtitle: "Sponsor affordability", ...VALUATION_CONTEXT.lboRange },
    ];
  }, [dcfBase, dcfHigh, dcfLow]);

  return (
    <>
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-hero"
        id="overview"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.4 }}
      >
        <div className="hero-grid">
          <div className="enterprise-card">
            <p className="eyebrow">Indicative enterprise value</p>
            <h1><span>EUR</span>{enterpriseValue("base").toFixed(0)}m</h1>
            <p>Stand-alone value from DCF, trading comps and LBO convergence. Control case reads closer to {money(VALUATION_CONTEXT.controlEv, 0)}.</p>
          </div>
          <div className="hero-metrics">
            {dynamicKeyStats.map((metric, index) => (
              <MetricTile
                detail={metric.detail}
                key={metric.label}
                label={metric.label}
                tone={index === 4 ? "accent" : index === 5 ? "green" : "neutral"}
                value={metric.value}
              />
            ))}
          </div>
        </div>
      </motion.section>

      <section className="case-section" id="snapshot">
        <div className="section-head">
          <p className="eyebrow">Company snapshot</p>
          <h2>Profitable vertical SaaS with enough scarcity to support an M&A lens.</h2>
          <p>
            Sidetrade is an AI-native Order-to-Cash software company with high subscription mix, international exposure,
            positive EBITDA and a documented 2030 margin plan.
          </p>
        </div>
        <div className="two-col">
          <DataTable columns={["Metric", "EURm", "% revenue", "YoY"]} rows={snapshotRows} />
          <div className="analysis-panel">
            <p className="eyebrow">Analytical read</p>
            <h3>Why this is a good portfolio case</h3>
            <p>
              It forces a clean split between listed stand-alone value, private market control value and sponsor
              affordability. That makes the work more interesting than a single DCF output.
            </p>
            <ul>
              <li>87% subscription revenue and 92% subscription gross margin.</li>
              <li>22% EBITDA margin already, with 30-35% long-term target.</li>
              <li>Small enough market cap to make strategic optionality credible.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="case-section" id="valuation">
        <div className="section-head inline">
          <div>
            <p className="eyebrow">Valuation range</p>
            <h2>Four methods, one compact view.</h2>
          </div>
          <p>DCF updates with the active scenario. Other methods stay anchored on the migrated case data.</p>
        </div>
        <FootballField activeScenario={activeScenario} ranges={ranges} />
      </section>

      <section className="case-section" id="dcf">
        <div className="section-head inline">
          <div>
            <p className="eyebrow">DCF scenario engine</p>
            <h2>Bear, Base and Bull update the model live.</h2>
          </div>
          <p>{scenario.narrative}</p>
        </div>
        <ScenarioSwitch activeScenario={activeScenario} onChange={setActiveScenario} />
        <div className="result-strip">
          <MetricTile label="Revenue 2030" value={money(scenario.result.revenue2030, 1)} detail={scenario.title} />
          <MetricTile label="EBITDA 2030" value={money(scenario.result.ebitda2030, 1)} detail={`${pct(scenario.ebitdaMargin2030, 0)} margin`} />
          <MetricTile label="FCF 2030" value={money(scenario.result.fcf2030, 1)} detail="Unlevered free cash flow" />
          <MetricTile label="DCF EV" value={money(scenario.ev, 0)} detail={`${scenario.result.evSales.toFixed(1)}x FY25 sales`} tone="accent" />
        </div>
        <div className="two-col wide-left">
          <TrajectoryChart scenarioId={activeScenario} />
          <div className="analysis-panel">
            <p className="eyebrow">Current scenario</p>
            <h3>{scenario.title}</h3>
            <p>{scenario.narrative}</p>
          </div>
        </div>
        <div className="two-col">
          <DataTable columns={["Driver", "Bear", "Base", "Bull"]} rows={scenarioAssumptionsRows()} />
          <SensitivityTable />
        </div>
      </section>

      <section className="case-section" id="comps">
        <div className="section-head">
          <p className="eyebrow">Comparable companies and transactions</p>
          <h2>Listed comps frame the stand-alone case; precedent deals frame control value.</h2>
        </div>
        <div className="two-col">
          <DataTable columns={["Company", "Read-through", "EV / Sales"]} rows={tradingComps} highlightColumn={2} />
          <DataTable columns={["Target", "Buyer", "EV / Sales", "EV / EBITDA"]} rows={transactionComps} highlightColumn={2} />
        </div>
      </section>

      <section className="case-section" id="lbo">
        <div className="section-head">
          <p className="eyebrow">LBO affordability</p>
          <h2>Useful as a sponsor pricing constraint, not as fundamental value.</h2>
        </div>
        <div className="result-strip three">
          <MetricTile label="Low" value={money(VALUATION_CONTEXT.lboRange.low, 0)} detail={`${pct(VALUATION_CONTEXT.lboIrr.low, 0)} target IRR`} />
          <MetricTile label="Base" value={money(VALUATION_CONTEXT.lboRange.base, 0)} detail={`${pct(VALUATION_CONTEXT.lboIrr.base, 1)} target IRR`} tone="accent" />
          <MetricTile label="High" value={money(VALUATION_CONTEXT.lboRange.high, 0)} detail={`${pct(VALUATION_CONTEXT.lboIrr.high, 0)} target IRR`} />
        </div>
      </section>

      <section className="case-section" id="takeaways">
        <div className="takeaway-panel">
          <p className="eyebrow">Strategic read</p>
          <h2>Sidetrade is most compelling as a scarce, profitable Office-of-CFO SaaS asset.</h2>
          <p>
            The central stand-alone valuation converges around EUR295m EV, while transaction precedents support
            materially higher control value. The case is strongest when presented as triangulation and judgment,
            not as a single-point DCF answer.
          </p>
        </div>
      </section>

      <footer className="case-footer" id="sources">
        <div>
          <strong>Sources</strong>
          <p>
            Sidetrade FY25 annual results, FY25 statutory report, O2C Intelligence 2030 plan, public comparable
            company data and precedent transaction references. Refresh market data before publication.
          </p>
        </div>
        <div>
          <strong>Author</strong>
          <p>Hamza | Finance and analytics portfolio.</p>
        </div>
      </footer>
    </>
  );
}
