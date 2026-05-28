import { useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import FootballField from "../components/FootballField.jsx";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import {
  FY25,
  SCENARIOS,
  VALUATION_CONTEXT,
  buildTrajectory,
  discountedCashflows,
  enterpriseValue,
  equityBridge,
  sensitivityWaccExit,
  sensitivityWaccG,
  terminalValue,
} from "../utils/dcfEngine.js";

const caseBase = "/cases/sidetrade-valuation";

function money(value, decimals = 1) {
  return `€${value.toFixed(decimals)}m`;
}

function pct(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

function multiple(value, decimals = 1) {
  return `${value.toFixed(decimals)}x`;
}

function Page({ eyebrow, title, intro, children }) {
  return (
    <section className="subpage">
      <header className="subpage-head">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <div className={`dense-panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function MetricGrid({ items, columns = 3 }) {
  return (
    <div className="dense-metric-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div className="dense-metric" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small className={item.tone === "negative" ? "negative" : ""}>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

function scenarioRows() {
  return ["bear", "base", "bull"].map((id) => {
    const trajectory = buildTrajectory(id);
    const terminal = trajectory.at(-1);
    const ev = enterpriseValue(id);
    return {
      id,
      label: id[0].toUpperCase() + id.slice(1),
      revenue: terminal.revenue,
      ebitda: terminal.ebitda,
      fcf: terminal.fcf,
      ev,
      evSales: ev / FY25.revenue,
    };
  });
}

function MiniSwitchChart({ scenarioId }) {
  const [metric, setMetric] = useState("revenue");
  const trajectory = buildTrajectory(scenarioId);
  const values = trajectory.map((year) => year[metric]);
  const max = Math.max(...values) * 1.12;
  const width = 780;
  const height = 280;
  const pad = { left: 52, right: 60, top: 24, bottom: 38 };
  const x = (index) => pad.left + (index / 5) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);
  const path = values.map((value, index) => `${index ? "L" : "M"}${x(index)} ${y(value)}`).join(" ");

  return (
    <Panel title="Trajectory 2025-2030" className="chart-panel-dense">
      <div className="dense-switch">
        <button className={metric === "revenue" ? "active" : ""} onClick={() => setMetric("revenue")} type="button">Revenue</button>
        <button className={metric === "ebitda" ? "active" : ""} onClick={() => setMetric("ebitda")} type="button">EBITDA</button>
      </div>
      <svg className="dense-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 0.5, 1].map((tick) => (
          <line className="grid-line" key={tick} x1={pad.left} x2={width - pad.right} y1={pad.top + tick * (height - pad.top - pad.bottom)} y2={pad.top + tick * (height - pad.top - pad.bottom)} />
        ))}
        <path className="dense-chart-line" d={path} />
        {trajectory.map((year, index) => (
          <g key={year.year}>
            <circle className="dense-chart-point" cx={x(index)} cy={y(values[index])} r="4" />
            <text className="axis-text" x={x(index)} y={height - 10} textAnchor="middle">{year.year}</text>
          </g>
        ))}
        <text className="end-label revenue" x={x(5) + 8} y={y(values[5]) + 4}>{money(values[5], 0)}</text>
      </svg>
    </Panel>
  );
}

function SensitivityMatrix({ title, rows, columns, matrix, activeMatcher }) {
  return (
    <Panel title={title}>
      <div className="table-scroll">
        <table className="compact-matrix">
          <thead>
            <tr>
              <th />
              {columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row}>
                <th>{row}</th>
                {columns.map((column, colIndex) => (
                  <td className={activeMatcher(rowIndex, colIndex) ? "active" : ""} key={`${row}-${column}`}>
                    {matrix[rowIndex][colIndex].toFixed(0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BridgeVisual({ ev = enterpriseValue("base") }) {
  const equity = ev - FY25.netDebt;
  const sharePrice = (equity * 1000000) / FY25.dilutedShares;
  return (
    <div className="bridge-visual">
      <div className="bridge-node">
        <span>Enterprise value</span>
        <strong>{money(ev, 0)}</strong>
      </div>
      <div className="bridge-operator">−</div>
      <div className="bridge-node muted">
        <span>Net debt</span>
        <strong>{money(FY25.netDebt, 1)}</strong>
      </div>
      <div className="bridge-operator">=</div>
      <div className="bridge-node">
        <span>Equity value</span>
        <strong>{money(equity, 0)}</strong>
      </div>
      <div className="bridge-operator">÷</div>
      <div className="bridge-node muted">
        <span>Diluted shares</span>
        <strong>{(FY25.dilutedShares / 1000).toFixed(0)}k</strong>
      </div>
      <div className="bridge-operator">=</div>
      <div className="bridge-node accent">
        <span>Implied share price</span>
        <strong>€{sharePrice.toFixed(0)}</strong>
      </div>
    </div>
  );
}

export function CompanySnapshotPage() {
  const [fcfView, setFcfView] = useState("normalized");
  const fcfViews = {
    statutory: {
      title: "Statutory / cash real 2025",
      fcf: 4.216,
      margin: 0.069,
      rows: [
        ["Net operational cash flow", "€5.240m"],
        ["(-) Capex", "(€1.024m)"],
        ["FCF statutory", "€4.216m"],
      ],
      explanation: "Includes actual 2025 working-capital consumption and CIR reimbursement timing.",
    },
    normalized: {
      title: "Normalized / economic",
      fcf: FY25.fcfNormalized,
      margin: FY25.fcfNormalized / FY25.revenue,
      rows: [
        ["FCF statutory", "€4.216m"],
        ["(+) CIR timing adjustment", "€2.947m"],
        ["FCF normalized", money(FY25.fcfNormalized, 3)],
      ],
      explanation: "Neutralizes CIR timing to reflect recurring cash generation used as DCF starting lens.",
    },
  };
  const view = fcfViews[fcfView];

  return (
    <Page eyebrow="Company snapshot" title="Office-of-CFO SaaS, profitable, founder-led, accessible target size">
      <div className="dense-two-col">
        <Panel title="FY25 P&L - reported">
          <DataTable columns={["Metric", "€m", "% revenue", "YoY"]} rows={[
            ["Revenue", "61.4", "100%", "+14% cc"],
            ["Subscriptions", "53.5", "87%", "+20% cc"],
            ["Subscriptions organic LFL", "-", "-", "+10%"],
            ["Gross margin", "47.4", "77%", "+10%"],
            ["GM on subscription only", "-", "92%", "-"],
            ["EBITDA incl. CIR", "13.4", "22%", "+22%"],
            ["EBIT incl. CIR", "10.3", "17%", "+23%"],
            ["Net profit", "9.0", "15%", "+14%"],
          ]} />
        </Panel>
        <div className="dense-stack">
          <Panel title="Geographic mix">
            <DataTable columns={["Region", "€m", "% revenue"]} rows={[
              ["France", "18.8", "31%"],
              ["International", "42.6", "69%"],
              ["North America subscriptions", "-", "30%"],
              ["APAC via ezyCollect", "-", "new"],
            ]} />
          </Panel>
          <Panel title="Balance sheet">
            <DataTable columns={["Item", "Value"]} rows={[
              ["Cash + marketable securities", "€16.3m"],
              ["Financial debt", "€31.0m"],
              ["Net debt strict", "€14.7m"],
              ["Treasury shares", "85,300"],
              ["Diluted shares", "1,536,790"],
            ]} highlightColumn={1} />
          </Panel>
        </div>
      </div>
      <div className="dense-two-col">
        <Panel title="Free cash flow - two views">
          <div className="dense-switch">
            <button className={fcfView === "statutory" ? "active" : ""} onClick={() => setFcfView("statutory")} type="button">Statutory</button>
            <button className={fcfView === "normalized" ? "active" : ""} onClick={() => setFcfView("normalized")} type="button">Normalized</button>
          </div>
          <DataTable columns={["Bridge", "Value"]} rows={view.rows} highlightColumn={1} />
          <p className="dense-note"><strong>{view.title}:</strong> {view.explanation} FCF margin: {pct(view.margin, 1)}.</p>
        </Panel>
        <Panel title="SaaS unit economics">
          <MetricGrid columns={3} items={[
            { label: "2025 new bookings", value: "€11.04m", detail: "ACV new contracts" },
            { label: "Avg. initial contract length", value: "46.4m", detail: "Above SaaS standards" },
            { label: "Customer quality", value: "85%", detail: "Revenue from >$1B enterprises" },
          ]} />
        </Panel>
      </div>
    </Page>
  );
}

export function MarketReferencePage() {
  const bridge = equityBridge("base");
  const premium = bridge.sharePrice / VALUATION_CONTEXT.sharePriceRef - 1;
  return (
    <Page eyebrow="Market reference" title="Theoretical valuation vs current listed price" intro="The market reference is the fast-decaying datapoint. Refresh before external distribution.">
      <div className="dense-stack">
        <MetricGrid columns={5} items={[
          { label: "Share price ref.", value: `€${VALUATION_CONTEXT.sharePriceRef.toFixed(2)}`, detail: "09 May 2025" },
          { label: "Market cap", value: "€52.6m", detail: "Ref. price x diluted shares" },
          { label: "Implied EV", value: "€67.3m", detail: "Market cap + net debt" },
          { label: "Upside to fair value", value: `+${pct(premium, 1)}`, detail: "Vs. DCF base share price" },
          { label: "Control case EV", value: money(VALUATION_CONTEXT.controlEv, 0), detail: "Precedent transactions" },
        ]} />
        <Panel title="Interpretation">
          <p className="dense-prose">At the reference share price, the implied market value sits far below the stand-alone DCF fair value. The gap should be treated as a placeholder until market data is refreshed, but it is directionally consistent with an under-covered micro-cap SaaS profile.</p>
        </Panel>
      </div>
    </Page>
  );
}

export function DcfPage() {
  const { activeScenario, scenario } = useSidetradeScenario();
  const rows = scenarioRows();
  const current = SCENARIOS[activeScenario];
  const waccLabels = ["8.5%", "9.0%", "9.5%", "10.0%", "10.5%"];
  const gValues = [0.035, 0.03, 0.025, 0.02, 0.015];
  const gLabels = gValues.map((item) => pct(item, 1));
  const exitMultiples = [12, 14, 15, 16, 18];
  const exitLabels = exitMultiples.map((item) => `${item.toFixed(0)}x`);
  const waccs = [0.085, 0.09, 0.095, 0.10, 0.105];

  return (
    <Page eyebrow="DCF" title="Scenario engine and sensitivity framework">
      <div className="scenario-columns">
        {rows.map((item) => (
          <div className={`scenario-column ${item.id === activeScenario ? "active" : ""}`} key={item.id}>
            <h2>{item.label}</h2>
            <dl>
              <div><dt>Revenue 2030</dt><dd>{money(item.revenue, 1)}</dd></div>
              <div><dt>EBITDA 2030</dt><dd>{money(item.ebitda, 1)}</dd></div>
              <div><dt>FCF 2030</dt><dd>{money(item.fcf, 1)}</dd></div>
              <div><dt>EV</dt><dd>{money(item.ev, 0)}</dd></div>
              <div><dt>EV / Sales 2025</dt><dd>{multiple(item.evSales, 1)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <div className="dense-two-col">
        <MiniSwitchChart scenarioId={activeScenario} />
        <Panel title="Narrative">
          <p className="dense-prose">{scenario.narrative}</p>
        </Panel>
      </div>
      <div className="dense-two-col">
        <Panel title="Key assumptions">
          <DataTable columns={["Driver", "Bear", "Base", "Bull"]} rows={[
            ["Revenue growth 2026", "12%", "17%", "21%"],
            ["Revenue growth 2027", "10%", "15%", "18%"],
            ["Revenue growth 2028", "8%", "13%", "16%"],
            ["Revenue growth 2029", "7%", "11%", "14%"],
            ["Revenue growth 2030", "6%", "9%", "12%"],
            ["EBITDA margin 2030", "26%", "32%", "35%"],
            ["Capex / revenue", "3.0%", "2.7%", "2.5%"],
            ["WACC", "10.5%", "9.5%", "8.5%"],
            ["Terminal growth", "2.0%", "2.5%", "3.0%"],
          ]} />
        </Panel>
        <div className="dense-two-col no-gap">
          <SensitivityMatrix title="WACC x g" rows={gLabels} columns={waccLabels} matrix={sensitivityWaccG(activeScenario, waccs, gValues)} activeMatcher={(r, c) => Math.abs(gValues[r] - current.g) < 0.0001 && Math.abs(waccs[c] - current.wacc) < 0.0001} />
          <SensitivityMatrix title="WACC x exit multiple" rows={exitLabels} columns={waccLabels} matrix={sensitivityWaccExit(activeScenario, waccs, exitMultiples)} activeMatcher={(r, c) => exitMultiples[r] === 15 && Math.abs(waccs[c] - current.wacc) < 0.0001} />
        </div>
      </div>
    </Page>
  );
}

export function TradingCompsPage() {
  return (
    <Page eyebrow="Trading comps" title="Listed SaaS comparables and retained multiple range">
      <Panel title="Comparable companies">
        <DataTable columns={["Company", "Read-through", "EV / Sales fwd", "EV / EBITDA fwd", "Growth", "EBITDA margin"]} rows={[
          ["Esker", "O2C / P2P SaaS", "5.5-6.0x", "23-25x", "12-14%", "24-26%"],
          ["BlackLine", "Office-of-CFO workflow", "2.5-3.0x", "18-22x", "7-9%", "18-22%"],
          ["BILL", "AP / AR + payments", "~2.0x", "n/m", "8-10%", "low"],
          ["nCino", "Vertical SaaS", "~3.0x", "20-24x", "12-15%", "15-18%"],
          ["Workiva", "CFO adjacency", "~3.0x", "22-26x", "10-13%", "18-20%"],
        ]} />
      </Panel>
      <div className="dense-two-col">
        <Panel title="Retained multiples for Sidetrade">
          <DataTable columns={["Tier", "EV / Sales", "EV / EBITDA", "EV implicit"]} rows={[
            ["Low", "3.0x", "15.0x", "€185m"],
            ["Base", "5.0x", "22.0x", "€295m"],
            ["High", "7.0x", "30.0x", "€425m"],
          ]} />
        </Panel>
        <Panel title="Read">
          <p className="dense-prose">The trading comps anchor a stand-alone value around €295m EV. Esker remains the best read-through, while broader finance workflow SaaS peers define the lower and upper market envelope.</p>
        </Panel>
      </div>
    </Page>
  );
}

export function TransactionCompsPage() {
  return (
    <Page eyebrow="Transaction comps" title="Control value from precedent software deals">
      <Panel title="Precedent transactions">
        <DataTable columns={["Target", "Buyer", "Year", "EV / Sales", "EV / EBITDA"]} rows={[
          ["Esker", "Bridgepoint / General Atlantic", "2024", "7.8x", "40.6x"],
          ["Coupa", "Thoma Bravo", "2023", "9.5x", "38.8x"],
          ["Billtrust", "EQT", "2022", "9.2x", "n/m"],
          ["Pagero", "Thomson Reuters", "2024", "7.9x", "n/m"],
          ["Bottomline", "Thoma Bravo", "2022", "5.0x", "24.7x"],
        ]} />
      </Panel>
      <div className="dense-two-col">
        <Panel title="Sidetrade internal M&A benchmarks">
          <p className="dense-prose"><strong>ezyCollect:</strong> €37.6m consideration, roughly €9m annualized run-rate, implying ~4.2x revenue run-rate. Useful as a lower-mid anchor due to smaller scale and APAC/SME mix.</p>
          <p className="dense-prose"><strong>SHS Viveon:</strong> special situation and delisting context. Qualitative floor only.</p>
        </Panel>
        <Panel title="Control value range">
          <MetricGrid columns={3} items={[
            { label: "Low", value: "€290m", detail: "EV implicit" },
            { label: "Base control", value: "€410m", detail: "Central M&A case" },
            { label: "High", value: "€545m", detail: "Strategic scarcity" },
          ]} />
        </Panel>
      </div>
    </Page>
  );
}

export function LboPage() {
  return (
    <Page eyebrow="LBO" title="Sponsor affordability and entry valuation range">
      <MetricGrid columns={3} items={[
        { label: "Target IRR 25%", value: "€135m", detail: "Downside affordability" },
        { label: "Target IRR 22.5%", value: "€283m", detail: "Base sponsor case" },
        { label: "Target IRR 18%", value: "€455m", detail: "Aggressive case" },
      ]} />
      <Panel title="Base case assumptions">
        <DataTable columns={["Assumption", "Value"]} rows={[
          ["Entry EV", "€295m"],
          ["EBITDA 2025", "€13.4m"],
          ["Acquisition debt", "~3.5x EBITDA / ~€47m"],
          ["Sponsor equity", "~€248m"],
          ["Holding period", "5 years"],
          ["Interest rate", "~6.5%"],
          ["Cash sweep", "100% of levered FCF"],
          ["Exit EBITDA 2030", "€36.1m"],
          ["Exit multiple", "~18.0x EBITDA"],
        ]} highlightColumn={1} />
      </Panel>
    </Page>
  );
}

export function FootballFieldPage() {
  const { activeScenario } = useSidetradeScenario();
  const ranges = [
    { method: "DCF", subtitle: "Fundamental", low: enterpriseValue("bear"), base: enterpriseValue(activeScenario), high: enterpriseValue("bull") },
    { method: "Trading comps", subtitle: "Stand-alone", ...VALUATION_CONTEXT.tradingRange },
    { method: "Transaction comps", subtitle: "Control", ...VALUATION_CONTEXT.transactionRange },
    { method: "LBO", subtitle: "Sponsor affordability", ...VALUATION_CONTEXT.lboRange },
  ];
  return (
    <Page eyebrow="Football field" title="Four methods, one valuation frame">
      <FootballField activeScenario={activeScenario} ranges={ranges} />
      <Panel title="Equity bridge">
        <BridgeVisual />
      </Panel>
    </Page>
  );
}

export function EquityBridgePage() {
  return (
    <Page eyebrow="Equity bridge" title="From enterprise value to implied share price">
      <BridgeVisual />
      <Panel title="Formula">
        <p className="dense-prose">Equity Value = Enterprise Value - Net Debt. Implied share price = Equity Value / diluted shares. The central bridge uses the stand-alone fair value around €295-301m EV and strict net debt of €14.7m.</p>
      </Panel>
    </Page>
  );
}

export function CaveatsPage() {
  return (
    <Page eyebrow="Caveats" title="What this model is not">
      <div className="dense-two-col">
        <Panel title="Methodological">
          <ul className="dense-list">
            <li>Independent model built from public data only.</li>
            <li>Trading multiples are sensitive to the market window and should be refreshed before publication.</li>
            <li>CIR treated as recurring cash given State-guaranteed reimbursement mechanism; statutory view retained for transparency.</li>
            <li>ezyCollect / SHS Viveon margins are still converging through 2026-2028.</li>
            <li>Transaction comps embed a control premium and are not directly comparable to stand-alone fair value.</li>
            <li>LBO is an affordability test, not fundamental fair value.</li>
          </ul>
        </Panel>
        <Panel title="Accounting specifics">
          <ul className="dense-list">
            <li><strong>Gross margin reconstruction:</strong> taken from FY25 investor communication because statutory P&L is by nature, not function.</li>
            <li><strong>ezyCollect PPA pending:</strong> future allocation could increase amortization and affect EBIT while leaving EBITDA broadly unaffected.</li>
            <li><strong>Headcount discrepancy:</strong> 406 statutory employees versus ~450 corporate communication, likely due to contractors, timing or rounding.</li>
            <li><strong>Treasury shares:</strong> market value not included in equity bridge and treated as optionality.</li>
          </ul>
        </Panel>
      </div>
    </Page>
  );
}

export function MethodologyPage() {
  return (
    <Page eyebrow="Methodology" title="DCF construction and modelling choices">
      <article className="methodology-prose">
        <p>The model starts from FY25 revenue, EBITDA including CIR, strict net debt and diluted shares. Revenue is projected through the Bear, Base and Bull growth paths. EBITDA margin is interpolated linearly from the FY25 margin to each scenario's 2030 target, which keeps the trajectory transparent and avoids hiding the margin ramp in a terminal year adjustment.</p>
        <p>Free cash flow is calculated as EBIT after tax plus D&A, less capex and working-capital investment. The same FCF is cross-checked through EBITDA less cash taxes, capex and working capital. The CIR is included flat in EBITDA rather than presented as a separate projected line, consistent with the modelling note in the source file.</p>
        <p>Projected FCFs are discounted using a mid-year convention. The Gordon terminal value is based on 2030 FCF and terminal growth, then discounted at year five. An exit multiple cross-check uses 15.0x 2030 EBITDA to frame whether the Gordon output is commercially plausible.</p>
        <p>Sensitivities are shown on WACC versus terminal growth and WACC versus exit multiple. The objective is not false precision; it is to expose which assumptions carry the valuation and to make the stand-alone versus control-value distinction explicit.</p>
      </article>
    </Page>
  );
}

export function SourcesPage() {
  return (
    <Page eyebrow="Sources" title="Primary files and valuation references">
      <Panel title="Local source files">
        <ul className="source-list">
          <li><Link to="/PR_2025_Results_EN.pdf">Sidetrade FY25 Annual Results</Link><span>Press release, FY25 financials and operating KPIs.</span></li>
          <li><Link to="/Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf">FY25 Statutory Report</Link><span>Cash flow, balance sheet, debt, shares and accounting notes.</span></li>
          <li><Link to="/260407_O2C_Intelligence_2030_PR_EN.pdf">O2C Intelligence 2030 Plan</Link><span>Long-term EBITDA margin and AI-native roadmap.</span></li>
        </ul>
      </Panel>
      <Panel title="External references">
        <p className="dense-prose">Edison Group precedent transactions table for Esker, public company trading data for Office-of-CFO and vertical SaaS peers, and public market references. Refresh all market data before external distribution.</p>
      </Panel>
    </Page>
  );
}

export function DocumentsPage() {
  return (
    <Page eyebrow="Documents" title="Source files">
      <Panel title="PDF library">
        <DataTable columns={["File", "Date", "Pages", "Source"]} rows={[
          [<Link to="/PR_2025_Results_EN.pdf" key="pr">PR_2025_Results_EN.pdf</Link>, "FY25 / 2026 release", "4", "Sidetrade press release"],
          [<Link to="/Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf" key="stat">FY25 statutory report</Link>, "Apr. 2026", "38", "Consolidated statutory accounts"],
          [<Link to="/260407_O2C_Intelligence_2030_PR_EN.pdf" key="plan">O2C Intelligence 2030 plan</Link>, "Apr. 2026", "5", "Strategic plan press release"],
        ]} highlightColumn={0} />
      </Panel>
    </Page>
  );
}
