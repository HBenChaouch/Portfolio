import { useState } from "react";
import DataTable from "../components/DataTable.jsx";
import FootballField from "../components/FootballField.jsx";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import {
  FY25,
  SCENARIOS,
  VALUATION_CONTEXT,
  buildTrajectory,
  enterpriseValue,
  sensitivityWaccExit,
  sensitivityWaccG,
} from "../utils/dcfEngine.js";

function money(value, decimals = 1) {
  return `€${value.toFixed(decimals)}m`;
}

function pct(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

function multiple(value, decimals = 1) {
  return `${value.toFixed(decimals)}x`;
}

function scenarioLabel(id) {
  return id[0].toUpperCase() + id.slice(1);
}

function Page({ eyebrow, id, intro, rightTag, title, children }) {
  return (
    <section className="subpage analysis-section" id={id}>
      <header className="subpage-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {intro ? <p>{intro}</p> : null}
        </div>
        {rightTag ? <aside>{rightTag}</aside> : null}
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

function SourceNote({ children }) {
  return <p className="dense-note">{children}</p>;
}

function MethodBox({ children }) {
  return <div className="dense-panel method-box">{children}</div>;
}

const scenarioNarratives = {
  bear: {
    tag: "BEAR",
    title: "A profile that decelerates",
    body: "Organic growth slows despite acquisitions. ezyCollect / SHS Viveon integration is dilutive longer than planned (consolidated gross margin slips under 80%). AI agents struggle to monetise beyond early signings. EBITDA margin caps at 26% in 2030, below the bottom of the 30-35% guidance band. Adverse macro, IT budgets under pressure, North America slowdown.",
  },
  base: {
    tag: "BASE",
    title: "The 2025 trajectory holds",
    body: "Q1 2026 already published at +17% reported / +21% cc total, +27% cc subscriptions - supports a sustained growth case. EBITDA margin reaches 32% by 2030, mid-range of the 30-35% O2C Intelligence 2030 plan. The AI Cash Collection Agent signs a few large accounts in 2026-2027 without becoming mass. Acquired margins converge progressively toward the group LFL standard (81%).",
  },
  bull: {
    tag: "BULL",
    title: "AI-native changes the equation",
    body: "\"Aimie\" agent scales on the pre-committed signings (4 multinationals already announced). North America passes 40% of total revenue. Multiple re-rating toward AI-native peers comparable to post-deal Esker (~23x forward EBITDA). EBITDA margin reaches 35%, top of management guidance. The O2C Intelligence 2030 plan (€18-23m AI-native dedicated revenue in 2030) delivers.",
  },
};

function scenarioRows() {
  return ["bear", "base", "bull"].map((id) => {
    const trajectory = buildTrajectory(id);
    const terminal = trajectory[trajectory.length - 1];
    const ev = enterpriseValue(id);
    return {
      id,
      label: scenarioLabel(id),
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
    <Panel title="Revenue & EBITDA trajectory · 2025 → 2030" className="chart-panel-dense">
      <div className="dense-switch">
        <button className={metric === "revenue" ? "active" : ""} onClick={() => setMetric("revenue")} type="button">Revenue</button>
        <button className={metric === "ebitda" ? "active" : ""} onClick={() => setMetric("ebitda")} type="button">EBITDA</button>
      </div>
      <SourceNote>Recomposes live with the active scenario. Hover any year for the bridge in the original HTML implementation.</SourceNote>
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

function BridgeVisual({ ev = 295 }) {
  const equity = ev - FY25.netDebt;
  const sharePrice = (equity * 1000000) / FY25.dilutedShares;
  const max = Math.max(ev, equity) * 1.18;
  const chartTop = 36;
  const chartHeight = 150;
  const y = (value) => chartTop + chartHeight - (value / max) * chartHeight;
  const h = (value) => (value / max) * chartHeight;

  return (
    <svg className="waterfall-svg" viewBox="0 0 1000 280" role="img" aria-label="Bridge from enterprise value to equity value and share price">
      <line className="wf-axis" x1="70" x2="930" y1={chartTop + chartHeight} y2={chartTop + chartHeight} />
      <rect className="wf-bar ev" x="90" y={y(ev)} width="150" height={h(ev)} />
      <line className="wf-connector" x1="240" x2="350" y1={y(ev)} y2={y(ev)} />
      <rect className="wf-bar debt" x="350" y={y(FY25.netDebt)} width="150" height={h(FY25.netDebt)} />
      <line className="wf-connector" x1="500" x2="610" y1={y(equity)} y2={y(equity)} />
      <rect className="wf-bar equity" x="610" y={y(equity)} width="150" height={h(equity)} />
      <rect className="wf-bar equity-outline" x="790" y={y(equity)} width="150" height={h(equity)} />
      <text className="wf-k" x="165" y="218" textAnchor="middle">Enterprise value</text>
      <text className="wf-v" x="165" y={y(ev) - 10} textAnchor="middle">{money(ev, 0)}</text>
      <text className="wf-op" x="295" y="118" textAnchor="middle">−</text>
      <text className="wf-k" x="425" y="218" textAnchor="middle">Net debt strict</text>
      <text className="wf-v muted" x="425" y={y(FY25.netDebt) - 10} textAnchor="middle">{money(FY25.netDebt, 1)}</text>
      <text className="wf-op" x="555" y="118" textAnchor="middle">=</text>
      <text className="wf-k" x="685" y="218" textAnchor="middle">Equity value</text>
      <text className="wf-v" x="685" y={y(equity) - 10} textAnchor="middle">{money(equity, 0)}</text>
      <text className="wf-k" x="865" y="218" textAnchor="middle">Share price</text>
      <text className="wf-v accent" x="865" y={y(equity) - 10} textAnchor="middle">~€{sharePrice.toFixed(0)}</text>
      <text className="wf-sub" x="685" y="246" textAnchor="middle">€{equity.toFixed(0)}m equity ÷ {(FY25.dilutedShares).toLocaleString("en-US")} diluted shares</text>
    </svg>
  );
}

export function CompanySnapshotPage() {
  const [fcfView, setFcfView] = useState("normalised");
  const fcfNarratives = {
    statutory: {
      title: "Statutory view · cash reported",
      body: "This view reflects the statutory cash flow statement and therefore captures the actual 2025 cash conversion after capex. It is useful for transparency, but it embeds the CIR timing decalage.",
    },
    normalised: {
      title: "Normalised view — recurring cash capacity",
      body: "This view neutralises the CIR timing decalage to reflect the model's recurring cash capacity. It is the preferred lens for the DCF, since the CIR effect is one-off and non-recurring.",
    },
  };

  return (
    <Page
      eyebrow="01 — Company snapshot"
      id="snapshot"
      rightTag="SaaS Order-to-Cash AI-native · Founded by Olivier Novasque · 406 employees (statutory) / ~450 (corp. comm.) · Present in 85 countries · Agentic AI Aimie trained on $8T of B2B transactions."
      title="Office-of-CFO SaaS, profitable, founder-led, accessible target size"
      intro="SaaS Order-to-Cash AI-native · Founded by Olivier Novasque · 406 employees (statutory) / ~450 (corp. comm.) · Present in 85 countries · Agentic AI Aimie trained on $8T of B2B transactions."
    >
      <Panel title="Office-of-CFO SaaS">
        <p className="dense-prose">
          Clean financial profile — 87% subscription mix, 92% subscription gross margin, 22% EBITDA already, operating leverage still ramping. Modest size (~€61m revenue) makes it accessible to PE mid-cap or a strategic consolidator. Documented 2030 plan and US investors building positions (Briarwood Chase &gt;10%, Mission Trail Capital 5%).
        </p>
      </Panel>

      <div className="dense-two-col">
        <Panel title="FY25 P&L — reported">
          <DataTable columns={["Metric", "€m", "% of revenue", "YoY"]} rows={[
            ["Revenue", "61.4", "100%", "+14% cc"],
            ["– of which Subscriptions", "53.5", "87%", "+20% cc"],
            ["– of which Services", "7.9", "13%", "—"],
            ["Subscriptions organic LFL", "—", "—", "+10%"],
            ["Gross margin", "47.4", "77%", "+10%"],
            ["– GM LFL", "—", "81%", "—"],
            ["– GM on subscription only", "—", "92%", "—"],
            ["EBITDA (incl. CIR)", "13.4", "22%", "+22%"],
            ["EBIT (incl. CIR)", "10.3", "17%", "+23%"],
            ["Financial result", "—", "—", "—"],
            ["Net profit", "9.0", "15%", "+14%"],
          ]} />
          <SourceNote>Source: Sidetrade FY25 Annual Results · March 30, 2026.</SourceNote>
        </Panel>

        <div className="dense-stack">
          <Panel title="Geographic mix">
            <DataTable columns={["Region", "€m", "% rev."]} rows={[
              ["France", "18.8", "31%"],
              ["International", "42.6", "69%"],
              ["– North America (subs.)", "—", "30%"],
              ["– APAC (via ezyCollect)", "—", "new"],
            ]} />
            <p className="dense-prose">
              <strong>69%</strong> of total revenue and <strong>71%</strong> of subscription revenue generated outside France. North America is now the leading region with <strong>+25% cc</strong> growth in 2025.
            </p>
          </Panel>

          <Panel title="Balance sheet">
            <DataTable columns={["Item", "Value"]} rows={[
              ["Cash", "€16.3m"],
              ["Marketable securities", "included above"],
              ["Financial debt", "€30.8m"],
              ["Leases", "—"],
              ["Net debt strict", "€14.7m"],
              ["Treasury shares (85,300)", "€20.6m"],
              ["Equity", "—"],
              ["Diluted shares outstanding", "1,536,790"],
            ]} highlightColumn={1} />
            <SourceNote>Source: Statutory Report FY25 — Notes 6, 8, 10, 30.</SourceNote>
          </Panel>
        </div>
      </div>

      <Panel title="Free cash flow — two views">
        <div className="dense-switch">
          <button className={fcfView === "statutory" ? "active" : ""} onClick={() => setFcfView("statutory")} type="button">Statutory · €4.2m</button>
          <button className={fcfView === "normalised" ? "active" : ""} onClick={() => setFcfView("normalised")} type="button">Normalised · €7.2m</button>
        </div>
        <div className="dense-two-col">
          <DataTable columns={["", "Statutory", "Normalised"]} rows={[
            ["Net operational cash flow", "5.2", "5.2"],
            ["(−) Capex", "(1.0)", "(1.0)"],
            ["(+) CIR timing adjustment", "—", "2.9"],
            ["FCF", "4.2", "7.2"],
            ["FCF margin", "6.9%", "11.7%"],
          ]} />
          <div className="narrative">
            <h4>{fcfNarratives[fcfView].title}</h4>
            <p>{fcfNarratives[fcfView].body}</p>
          </div>
        </div>
      </Panel>

      <Panel title="SaaS unit economics">
        <MetricGrid columns={3} items={[
          { label: "2025 new bookings", value: "€11.04m", detail: "ACV new contracts · €4.32m New ARR · €6.71m services" },
          { label: "Avg. initial contract length", value: "46.4 months", detail: "Far above SaaS industry standards." },
          { label: "Customer quality", value: "85%", detail: "of total revenue generated by enterprises >$1B revenue. 54% Corporate portfolio >€2.5B." },
        ]} />
      </Panel>
    </Page>
  );
}

export function MarketReferencePage() {
  const marketCap = (VALUATION_CONTEXT.sharePriceRef * FY25.dilutedShares) / 1000000;
  const marketEv = marketCap + FY25.netDebt;
  const fairUpside = VALUATION_CONTEXT.tradingRange.base / marketEv - 1;
  const controlUpside = VALUATION_CONTEXT.controlEv / marketEv - 1;

  return (
    <Page
      eyebrow="02 — Market sanity check"
      id="market"
      rightTag="The only data point on this page that decays fast. To be refreshed immediately before any external distribution."
      title="Theoretical valuation vs current listed price"
      intro="The only data point on this page that decays fast. To be refreshed immediately before any external distribution."
    >
      <Panel title="Market data as of 09 May 2025">
        <MetricGrid columns={5} items={[
          { label: "Current share price", value: `€${VALUATION_CONTEXT.sharePriceRef.toFixed(0)}`, detail: "Reference market price" },
          { label: "Market cap", value: money(marketCap, 0), detail: "Last close × diluted shares" },
          { label: "Implied EV", value: money(marketEv, 0), detail: "Market cap + net debt strict €14.7m" },
          { label: "Upside to fair value (€295m EV)", value: `+${pct(fairUpside, 1)}`, detail: "Stand-alone fair value reference" },
          { label: "Upside to control case (€410m EV)", value: `+${pct(controlUpside, 1)}`, detail: "Transaction-control reference" },
        ]} />
        <p className="dense-prose">
          The dotted vertical line on the football field below mirrors the current market reference. Replace placeholders with last close + simple bridge (Market cap + net debt strict €14.7m = EV) before publishing.
        </p>
      </Panel>
      <Panel title="Theoretical valuation vs current listed price">
        <DataTable columns={["Reference", "Enterprise value", "Equity value", "Share price", "Read"]} rows={[
          ["Current market reference", money(marketEv, 0), money(marketCap, 0), `€${VALUATION_CONTEXT.sharePriceRef.toFixed(0)}`, "Listed share price bridge"],
          ["Stand-alone fair value", "€295m", money(295 - FY25.netDebt, 0), `€${(((295 - FY25.netDebt) * 1000000) / FY25.dilutedShares).toFixed(0)}`, "DCF + Trading Comps + LBO convergence"],
          ["Control case", "€410m", money(410 - FY25.netDebt, 0), `€${(((410 - FY25.netDebt) * 1000000) / FY25.dilutedShares).toFixed(0)}`, "Transaction precedents, control premium embedded"],
        ]} />
      </Panel>
    </Page>
  );
}

export function DcfPage() {
  const { activeScenario } = useSidetradeScenario();
  const rows = scenarioRows();
  const current = SCENARIOS[activeScenario];
  const waccs = [0.085, 0.09, 0.095, 0.10, 0.105];
  const gValues = [0.035, 0.03, 0.025, 0.02, 0.015];
  const exitMultiples = [12, 14, 15, 16, 18];

  return (
    <Page
      eyebrow="03 — DCF · Bear / Base / Bull"
      id="dcf"
      rightTag="Assumptions, end-state and narrative all update in step. The football field DCF bar follows."
      title="Switch the scenario to recompose the model live"
      intro="Assumptions, end-state and narrative all update in step. The football field DCF bar follows."
    >
      <div className="scenario-columns">
        {rows.map((item) => (
          <div className={`scenario-column ${item.id === activeScenario ? "active" : ""}`} key={item.id}>
            <h2>{item.label}</h2>
            <dl>
              <div><dt>Revenue 2030</dt><dd>{money(item.revenue, 1)}</dd></div>
              <div><dt>EBITDA 2030</dt><dd>{money(item.ebitda, 1)}</dd></div>
              <div><dt>FCF 2030</dt><dd>{money(item.fcf, 1)}</dd></div>
              <div><dt>Enterprise Value (DCF)</dt><dd>{money(item.ev, 0)}</dd></div>
              <div><dt>EV / FY25 Sales</dt><dd>{multiple(item.evSales, 1)}</dd></div>
            </dl>
          </div>
        ))}
      </div>

      <MiniSwitchChart scenarioId={activeScenario} />

      <div className="dense-two-col">
        <Panel title="Key assumptions">
          <DataTable columns={["Driver", "Bear", "Base", "Bull"]} rows={[
            ["Revenue growth 2026", "12%", "17%", "21%"],
            ["Revenue growth 2027", "10%", "15%", "18%"],
            ["Revenue growth 2028", "8%", "13%", "16%"],
            ["Revenue growth 2029", "7%", "11%", "14%"],
            ["Revenue growth 2030", "6%", "9%", "12%"],
            ["EBITDA margin 2030", "26%", "32%", "35%"],
            ["Effective tax rate", "25%", "22%", "20%"],
            ["Capex / revenue", "3.0%", "2.7%", "2.5%"],
            ["ΔWC / Δrevenue", "10%", "7%", "5%"],
            ["WACC", "10.5%", "9.5%", "8.5%"],
            ["Terminal growth", "2.0%", "2.5%", "3.0%"],
          ]} />
          <SourceNote>D&A held constant at 2.0% of revenue (economic proxy, vs ~5.9% reported accounting D&A).</SourceNote>
        </Panel>

        <div className="dense-stack">
          <Panel title="Narrative">
            <div className="narrative" data-s={activeScenario}>
              <h4><span className="tag">{scenarioNarratives[activeScenario].tag}</span><span>{scenarioNarratives[activeScenario].title}</span></h4>
              <p>{scenarioNarratives[activeScenario].body}</p>
            </div>
          </Panel>
          <Panel title="DCF result · all scenarios">
            <DataTable columns={["", "Bear", "Base", "Bull"]} rows={[
              ["Revenue 2030", money(rows[0].revenue, 1), money(rows[1].revenue, 1), money(rows[2].revenue, 1)],
              ["EBITDA 2030", money(rows[0].ebitda, 1), money(rows[1].ebitda, 1), money(rows[2].ebitda, 1)],
              ["FCF 2030", money(rows[0].fcf, 1), money(rows[1].fcf, 1), money(rows[2].fcf, 1)],
              ["EV implicit", money(rows[0].ev, 0), money(rows[1].ev, 0), money(rows[2].ev, 0)],
              ["EV / FY25 Sales", multiple(rows[0].evSales, 1), multiple(rows[1].evSales, 1), multiple(rows[2].evSales, 1)],
            ]} />
          </Panel>
        </div>
      </div>

      <div className="dense-two-col">
        <SensitivityMatrix title="Sensitivity · WACC × Terminal growth" rows={gValues.map((item) => pct(item, 1))} columns={waccs.map((item) => pct(item, 1))} matrix={sensitivityWaccG(activeScenario, waccs, gValues)} activeMatcher={(r, c) => Math.abs(gValues[r] - current.g) < 0.0001 && Math.abs(waccs[c] - current.wacc) < 0.0001} />
        <SensitivityMatrix title="Sensitivity · WACC × Exit multiple" rows={exitMultiples.map((item) => `${item.toFixed(0)}x`)} columns={waccs.map((item) => pct(item, 1))} matrix={sensitivityWaccExit(activeScenario, waccs, exitMultiples)} activeMatcher={(r, c) => exitMultiples[r] === 15 && Math.abs(waccs[c] - current.wacc) < 0.0001} />
      </div>

      <MethodBox>
        <h2>How we built it · methodology</h2>
        <p><strong>Starting point.</strong> EBITDA 2025 incl. CIR = €13.4m. We anchor here because (i) Sidetrade communicates in EBITDA incl. CIR, (ii) the CIR is a recurring cash item guaranteed by the French State — not an optional tax break.</p>
        <p><strong>Core formula.</strong> EBIT = EBITDA − D&A. FCF = EBIT × (1 − tax) + D&A − Capex − ΔWC.</p>
        <ol className="dense-list">
          <li><strong>Economic vs accounting D&A.</strong> Statutory shows ~€3.6m "amortization, depreciation and provisions" but that includes receivables provisions and operational provisions. Pure economic D&A is ~€1.1m (intangibles €285k + tangibles €540k + goodwill/customer relations €296k). We use 2% of revenue as an economic proxy — not the 5.9% accounting figure.</li>
          <li><strong>Normalised tax rate.</strong> 2025 P&L shows +€2.15m net tax credit thanks to CIR. Theoretical reconcilable rate is ~17%. We spread by scenario: 25% Bear (progressive CIR erosion), 22% Base (stable regime), 20% Bull (international optimisation).</li>
          <li><strong>WACC.</strong> Risk-free OAT 10Y ~3.2% + ERP Europe ~5.5% + small-cap SaaS relevered beta ~1.25 + size premium. Yields 8.5%-11.0% across scenarios.</li>
          <li><strong>Terminal growth.</strong> 2.0%-3.0%, capped at 3% in Bull (above long-run European nominal GDP).</li>
          <li><strong>Q1 2026 actuals.</strong> Already published at +17% reported / +21% cc total, +27% cc subscriptions — directly supports the Base case 17% 2026 growth assumption.</li>
        </ol>
      </MethodBox>
    </Page>
  );
}

export function TradingCompsPage() {
  return (
    <Page
      eyebrow="04 — Trading comps"
      id="trading"
      rightTag="Listed B2B SaaS with comparable subscription mix, double-digit EBITDA margins, and CFO-office exposure. Hover any row for rationale."
      title="Market value, stand-alone"
      intro="Listed B2B SaaS with comparable subscription mix, double-digit EBITDA margins, and CFO-office exposure. Hover any row for rationale."
    >
      <Panel title="Comparable companies">
        <DataTable columns={["Peer", "Why comparable", "EV / Sales (indicative)", "Geo"]} rows={[
          ["Esker ★", "O2C/P2P · French SaaS · pre-buyout reference", "~5.5-6.0x", "FR"],
          ["BlackLine", "Finance automation · accounting workflow", "~2.5-3.0x", "US"],
          ["BILL", "AP/AR automation + payments", "~2.0x", "US"],
          ["nCino", "Vertical SaaS banking", "~3.0x", "US"],
          ["Q2 Holdings", "Digital banking SaaS", "~3.0-3.5x", "US"],
          ["SPS Commerce", "B2B network · profitable SaaS", "~2.0-2.5x", "US"],
          ["Workiva", "Reporting / compliance SaaS", "~3.0x", "US"],
        ]} />
        <SourceNote>Indicative ranges — to be refreshed before publication. Multiples are forward FY+1 to neutralise 2025 one-offs.</SourceNote>
      </Panel>

      <div className="dense-two-col">
        <Panel title="Peer rationale">
          <p className="dense-prose"><strong>Esker.</strong> Central benchmark: French listed O2C/P2P SaaS, exact same sector and geography. Pre-Bridgepoint take-private trading multiple. Best read-through to Sidetrade's standalone listed multiple. FY+1 EV/Sales ~5.5-6.0x.</p>
          <p className="dense-prose"><strong>BlackLine.</strong> Closer to accounting workflow than O2C, but directly Office-of-CFO. Used as a mid-range anchor for SaaS premium multiples on a mature profile. FY+1 EV/Sales ~2.5-3.0x.</p>
          <p className="dense-prose"><strong>BILL.</strong> Adjacent O2C in the SME US market — useful low-end anchor for AR automation multiples. FY+1 EV/Sales ~2.0x.</p>
          <p className="dense-prose"><strong>nCino.</strong> Vertical banking SaaS — profitable, sticky, multi-year contracts. Adds vertical-SaaS premium reference. FY+1 EV/Sales ~3.0x.</p>
          <p className="dense-prose"><strong>Q2 Holdings.</strong> Digital banking SaaS — comparable subscription mix and growth band. FY+1 EV/Sales ~3.0-3.5x.</p>
          <p className="dense-prose"><strong>SPS Commerce.</strong> Network SaaS, vertical-led, profitable. Useful for the "profitable SaaS at scale" multiple anchor. FY+1 EV/Sales ~2.0-2.5x.</p>
          <p className="dense-prose"><strong>Workiva.</strong> Reporting / compliance SaaS — Office-of-CFO adjacency, not direct O2C. FY+1 EV/Sales ~3.0x.</p>
        </Panel>

        <div className="dense-stack">
          <Panel title="Retained multiples for Sidetrade">
            <DataTable columns={["Tier", "EV / Sales", "EV / EBITDA"]} rows={[
              ["Low — generalist SaaS peers", "3.0x", "15.0x"],
              ["Base — CFO-office premium peers", "5.0x", "22.0x"],
              ["High — AI-native vertical SaaS", "7.0x", "30.0x"],
            ]} />
          </Panel>
          <Panel title="Range implied — stand-alone">
            <MetricGrid columns={3} items={[
              { label: "Low", value: "€185m", detail: "EV implicit" },
              { label: "Base", value: "€295m", detail: "EV implicit" },
              { label: "High", value: "€425m", detail: "EV implicit" },
            ]} />
            <p className="dense-prose">Convergence with DCF Base case at <strong>~€295m EV</strong>. This convergence anchors the stand-alone central fair value.</p>
          </Panel>
        </div>
      </div>

      <MethodBox>
        <h2>How we built it · methodology</h2>
        <p><strong>Logic.</strong> Value Sidetrade through comparison with listed European and North-American B2B SaaS that share its financial profile: dominant subscription mix, double-digit EBITDA margin, &gt;10% growth, Office-of-CFO or finance-productivity exposure.</p>
        <p><strong>Limitations.</strong> Sidetrade is small-cap and not very liquid on Euronext Growth — a natural discount applies vs mid-caps listed on Euronext Paris or US markets. We retain forward (FY+1) multiples to neutralise 2025 one-offs. Multiples move daily; this range reflects a market window and should be refreshed before any external publication.</p>
      </MethodBox>
    </Page>
  );
}

export function TransactionCompsPage() {
  return (
    <Page
      eyebrow="05 — Transaction comps"
      id="transaction"
      rightTag="Forward FY1e multiples on Office-of-CFO / O2C / finance automation precedents. Hover any row for context."
      title="Control value · what a buyer has actually paid"
      intro="Forward FY1e multiples on Office-of-CFO / O2C / finance automation precedents. Hover any row for context."
    >
      <Panel title="Precedent transactions">
        <DataTable columns={["Target", "Buyer", "Date", "EV / Sales FY1e", "EV / EBITDA FY1e"]} rows={[
          ["Esker ★", "Bridgepoint / General Atlantic", "2024/25", "7.8x", "40.6x"],
          ["Coupa", "Thoma Bravo", "2023", "9.5x", "38.8x"],
          ["Billtrust", "EQT", "2022", "9.2x", "n/m"],
          ["Pagero", "Thomson Reuters", "2024", "7.9x", "n/m"],
          ["Bottomline", "Thoma Bravo", "2022", "5.0x", "24.7x"],
          ["Basware", "Accel-KKR", "2022", "4.1x", "27.2x"],
          ["Tungsten", "Kofax", "2022", "1.8x", "14.3x"],
          ["Proactis", "Pollen Street", "2021", "2.4x", "9.5x"],
        ]} />
        <SourceNote>Source: Edison Group precedent transactions table (Esker offer, 2024/25), augmented.</SourceNote>
      </Panel>

      <Panel title="Deal rationale">
        <p className="dense-prose"><strong>Esker.</strong> Central comp: same sector (O2C), same geography (France), same financial profile, similar starting size. The single most relevant precedent for Sidetrade. 7.8x sales · 40.6x EBITDA FY1e.</p>
        <p className="dense-prose"><strong>Coupa.</strong> Premium comp: sponsor take-private at peak multiple — sets the high anchor for strategic / sponsor pricing of O2C-adjacent SaaS. 9.5x sales · 38.8x EBITDA FY1e.</p>
        <p className="dense-prose"><strong>Billtrust.</strong> Direct O2C peer but unprofitable — EBITDA multiple n/m, but revenue multiple confirms the sales-based premium. 9.2x sales.</p>
        <p className="dense-prose"><strong>Pagero.</strong> Strategic acquisition by a global data player — premium reflects e-invoicing scarcity. 7.9x sales.</p>
        <p className="dense-prose"><strong>Bottomline.</strong> Mature B2B payments SaaS — a useful mid-range anchor. 5.0x sales · 24.7x EBITDA FY1e.</p>
        <p className="dense-prose"><strong>Basware.</strong> European Office-of-CFO SaaS taken private — closest geographical and profile comp after Esker. 4.1x sales · 27.2x EBITDA FY1e.</p>
        <p className="dense-prose"><strong>Tungsten.</strong> Legacy e-invoicing transition — sets the floor for the range. 1.8x sales · 14.3x EBITDA FY1e.</p>
        <p className="dense-prose"><strong>Proactis.</strong> Small UK procurement — distressed-end of the range, included for floor. 2.4x sales · 9.5x EBITDA FY1e.</p>
      </Panel>

      <div className="dense-two-col">
        <Panel title="Sidetrade's own M&A — internal benchmarks">
          <p className="dense-prose"><strong>ezyCollect (Oct 2025) ·</strong> Total consideration €37.6m (€34.8m cash + €2.6m stock). Contributed €2.241m revenue since 1 Oct 2025, i.e. ~€9m annualised run-rate → implicit multiple ~4.2x revenue run-rate. Lower-mid anchor: smaller, APAC, SME, lower gross margin — not directly comparable to Sidetrade's core but useful as a floor.</p>
          <p className="dense-prose"><strong>SHS Viveon (2024) ·</strong> Special situation (delisting tender at €3.00/share). €4.4m revenue since July 2024 i.e. ~€8.8m annualised. Implicit multiple is very low and reflects forced delisting context — use as qualitative floor only.</p>
        </Panel>
        <Panel title="Retained multiples — forward 2026E">
          <SourceNote>Base 2026E from model: Revenue €71.9m · EBITDA €17.3m.</SourceNote>
          <DataTable columns={["Tier", "EV / Sales", "EV / EBITDA", "EV impl."]} rows={[
            ["Low", "3.8x", "18.0x", "€273-311m"],
            ["Base", "5.5x", "25.0x", "€395-431m"],
            ["High", "7.5x", "32.0x", "€539-552m"],
          ]} />
        </Panel>
      </div>

      <Panel title="Range control value">
        <MetricGrid columns={3} items={[
          { label: "Low", value: "€290m", detail: "EV implicit" },
          { label: "Base · control", value: "€410m", detail: "EV implicit" },
          { label: "High", value: "€545m", detail: "EV implicit" },
        ]} />
        <p className="dense-prose">Deliberately above trading comps — these embed control premium (~20-40%), strategic scarcity and synergy potential. Read as <strong>M&A value</strong>, not stand-alone.</p>
      </Panel>

      <MethodBox>
        <h2>How we built it · methodology</h2>
        <p><strong>Logic.</strong> Precedent transactions answer "what did a buyer pay to take control of a comparable", not "what does the market value a comparable". By construction, these embed: (i) control premium 20-40%, (ii) strategic / scarcity premium, (iii) potential synergies, (iv) the buyer's ability to accept a longer horizon.</p>
        <p><strong>Source.</strong> Primary source is the Edison Group table compiled for the Esker take-private (2024/25), covering O2C / P2P / AP automation / finance workflow deals with forward FY1e / FY2e multiples. We augment with Sidetrade's own M&A as internal benchmarks.</p>
      </MethodBox>
    </Page>
  );
}

export function LboPage() {
  return (
    <Page
      eyebrow="06 — LBO"
      id="lbo"
      rightTag="Not a fundamental fair value — an affordability test that frames the sponsor pricing logic."
      title="Sponsor affordability · what a PE could pay for a 20-25% IRR"
      intro="Not a fundamental fair value — an affordability test that frames the sponsor pricing logic."
    >
      <div className="dense-two-col">
        <Panel title="Base case assumptions">
          <DataTable columns={["Assumption", "Value"]} rows={[
            ["Entry EV", "€295m"],
            ["EBITDA 2025", "€13.4m"],
            ["Acquisition debt (3.5x EBITDA)", "~€47m"],
            ["Sponsor equity", "~€248m"],
            ["Holding period", "5 years"],
            ["Interest rate", "~6.5%"],
            ["Cash sweep", "100% of levered FCF"],
            ["Exit EBITDA 2030 (Base)", money(buildTrajectory("base")[5].ebitda, 1)],
            ["Exit multiple (Base)", "~18.0x EBITDA"],
            ["Target IRR (Base)", "~22.5%"],
          ]} highlightColumn={1} />
          <p className="dense-prose">
            <strong>On leverage:</strong> the existing covenant (Net debt / EBITDA &lt; 2.5x on the BNP/LCL loans tied to ezyCollect) does not constrain a future LBO — in a PE take-control, existing debt is refinanced inside a new package. The 3.5x reflects sensible LBO capacity for a profitable SaaS, not the current balance sheet.
          </p>
        </Panel>
        <Panel title="Range">
          <MetricGrid columns={3} items={[
            { label: "Low", value: "€135m", detail: "IRR target 25%" },
            { label: "Base", value: "€283m", detail: "IRR target 22.5%" },
            { label: "High", value: "€455m", detail: "IRR target 18%" },
          ]} />
          <p className="dense-prose">Low/High swing principally driven by IRR target (18% Low → 25% High) and exit multiple (15x → 22x). Convergence with DCF / trading comps in Base at ~€283m. Use as <strong>sponsor affordability test</strong>, not fundamental fair value.</p>
        </Panel>
      </div>
      <Panel title="Mini-bridge · entry → exit">
        <DataTable columns={["Step", "Base case"]} rows={[
          ["Entry EV", "€295m"],
          ["Entry debt", "~€47m"],
          ["Sponsor equity", "~€248m"],
          ["Exit EBITDA 2030", money(buildTrajectory("base")[5].ebitda, 1)],
          ["Exit multiple", "~18.0x"],
          ["Exit enterprise value", `~${money(buildTrajectory("base")[5].ebitda * 18, 0)}`],
          ["Target sponsor IRR", "~22.5%"],
        ]} />
      </Panel>
      <MethodBox>
        <h2>How we built it · methodology</h2>
        <p>The LBO is solved for entry EV given target sponsor IRR, holding period, leverage, interest, exit EBITDA and exit multiple. Two levers drive most of the range: the IRR floor a sponsor will accept, and the exit multiple — which itself depends on the operating delivery of the holding period.</p>
      </MethodBox>
    </Page>
  );
}

export function FootballFieldPage() {
  const { activeScenario } = useSidetradeScenario();
  const ranges = [
    { method: "DCF", subtitle: "Fundamental", low: enterpriseValue("bear"), base: enterpriseValue(activeScenario), high: enterpriseValue("bull") },
    { method: "Trading", subtitle: "Stand-alone", ...VALUATION_CONTEXT.tradingRange },
    { method: "Transaction", subtitle: "Control", ...VALUATION_CONTEXT.transactionRange },
    { method: "LBO", subtitle: "Affordability", ...VALUATION_CONTEXT.lboRange },
  ];

  return (
    <Page
      eyebrow="07 — Football field"
      id="football"
      rightTag="Scroll back up to switch DCF scenario — the DCF bar below recomposes live."
      title="Four methods, one view"
      intro="Scroll back up to switch DCF scenario — the DCF bar below recomposes live."
    >
      <FootballField activeScenario={activeScenario} ranges={ranges} />
      <Panel title="Reference lines">
        <MetricGrid columns={3} items={[
          { label: "Stand-alone fair value", value: "€295m EV", detail: "Convergence of DCF + Trading Comps + LBO in Base case. The reference number." },
          { label: "Control case", value: "€410m EV", detail: "Convergence with transaction precedents. ~40% control premium embedded." },
          { label: "Implied share price · Base", value: "~€182", detail: "(€295m − €14.7m net debt) / 1.537m diluted shares = ~€182 / share." },
        ]} />
      </Panel>
      <Panel title="Bridge · EV → Equity → Share price">
        <BridgeVisual ev={295} />
        <p className="dense-prose">
          <strong>Stand-alone range:</strong> €185m - €425m EV → ~€110-€267 / share.<br />
          <strong>Extended range (incl. M&A / LBO):</strong> €135m - €545m EV → ~€78-€345 / share.
        </p>
      </Panel>
      <Panel title="Strategic read" className="strategic-read">
        <p className="dense-prose">Sidetrade shows a clean financial profile: profitable O2C SaaS, dominant subscription mix (87%), premium subscription gross margin (92%), solid 22% EBITDA already, with operating leverage still ramping. The O2C Intelligence 2030 plan (30-35% EBITDA target) supports the DCF Base case trajectory.</p>
        <p className="dense-prose">Stand-alone central value <strong>~€295m EV</strong> places Sidetrade in a defensible zone around €180-190 / share. The control case <strong>~€410m EV</strong> reflects a real M&A optionality — ideal target profile for a European strategic consolidator or a mid-market PE sponsor, in line with the Esker / Bridgepoint-General Atlantic precedent.</p>
        <p className="dense-prose"><em>Sidetrade's stand-alone fair value converges around ~€295m EV, supported by DCF, trading comps and LBO affordability. Transaction precedents suggest a control valuation closer to ~€410m EV, reflecting strategic scarcity in Office-of-CFO / Order-to-Cash software.</em></p>
      </Panel>
    </Page>
  );
}

export function EquityBridgePage() {
  return (
    <Page eyebrow="Equity bridge" title="From enterprise value to implied share price">
      <BridgeVisual ev={295} />
      <Panel title="Formula">
        <p className="dense-prose">Bridge EV €295m → −Net debt €14.7m → Equity €280m → /1,537k diluted shares → €182/share.</p>
      </Panel>
    </Page>
  );
}

export function CaveatsPage() {
  return (
    <Page
      eyebrow="08 — Caveats & limits"
      id="caveats"
      rightTag="Independent v1.0 model built from public data only. Not a research recommendation."
      title="What this model is not"
      intro="Independent v1.0 model built from public data only. Not a research recommendation."
    >
      <div className="dense-two-col">
        <Panel title="Methodological">
          <ul className="dense-list">
            <li>Independent v0 model built from public data only (FY25 statutory + press release + O2C Intelligence 2030 plan + public market data).</li>
            <li>Trading multiples are sensitive to market window — refresh before publication if market conditions shift.</li>
            <li>CIR treated as recurring cash given State-guaranteed reimbursement mechanism. Statutory view available as alternative for transparency.</li>
            <li>ezyCollect / SHS Viveon margins still converging through 2026-2028 — Base case assumes partial integration. Multi-acquisition execution risk acknowledged.</li>
            <li>Transaction comps embed a ~40% control premium — not directly comparable to a stand-alone fair value.</li>
            <li>LBO is an affordability test, not a fundamental fair value.</li>
            <li>D&A used (2.0% of revenue) is an economic proxy, distinct from French accounting D&A which includes receivable and operating provisions.</li>
            <li>Treasury shares (€20.6m market value) not included in the equity bridge — treated as optionality, value depends on spot price.</li>
          </ul>
        </Panel>
        <Panel title="Accounting specifics">
          <ul className="dense-list">
            <li><strong>Gross margin reconstruction.</strong> <em>Gross margin is taken from Sidetrade's FY25 investor communication. It cannot be perfectly reconstructed from the French statutory P&L alone because expenses are presented by nature, not by function.</em> The 77% / 81% LFL / 92% subscription figures come from the press release, not the statutory ANC.</li>
            <li><strong>ezyCollect PPA pending.</strong> <em>ezyCollect PPA still pending until 31 Dec 2026. Future allocation from goodwill to customer relationships could increase amortization and affect EBIT, while leaving EBITDA broadly unaffected.</em> Part of the €38m goodwill may be reclassified as 20-year-amortisable customer relations after the allocation due end-2026. EBIT-impacting, EBITDA-neutral.</li>
            <li><strong>Headcount discrepancy.</strong> 406 employees per statutory accounts at 31 December 2025 vs ~450 per corporate communication. The gap can reflect contractors, recent joiners not yet booked, or a rounded comms figure. Noted without dramatising.</li>
          </ul>
        </Panel>
      </div>
    </Page>
  );
}

function AnalysisFooter() {
  return (
    <footer className="analysis-footer">
      <div>
        <strong>Author</strong>
        <p>Hamza · ESSEC Grande École · Finance & Analytics</p>
        <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </div>
      <div>
        <strong>Sources</strong>
        <p>Sidetrade FY25 Annual Results; FY25 Statutory Report; O2C Intelligence 2030 Plan; Edison Group precedent transactions; Damodaran market data.</p>
      </div>
      <div>
        <strong>Market reference</strong>
        <p>Market data as of [DATE — to be filled before publication]. Current share price placeholder refreshed to €166 for this React pass.</p>
      </div>
      <p className="analysis-disclaimer">Independent pedagogical model built from public data. Does not constitute an investment recommendation. All multiples and ranges are indicative and reflect a market window — refresh before any external distribution.</p>
    </footer>
  );
}

export function AnalysisView() {
  return (
    <div className="analysis-longform">
      <CompanySnapshotPage />
      <MarketReferencePage />
      <DcfPage />
      <TradingCompsPage />
      <TransactionCompsPage />
      <LboPage />
      <FootballFieldPage />
      <CaveatsPage />
      <AnalysisFooter />
    </div>
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
          <li><a href="/PR_2025_Results_EN.pdf" target="_blank" rel="noopener noreferrer">Sidetrade FY25 Annual Results</a><span>Press release, FY25 financials and operating KPIs.</span></li>
          <li><a href="/Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf" target="_blank" rel="noopener noreferrer">FY25 Statutory Report</a><span>Cash flow, balance sheet, debt, shares and accounting notes.</span></li>
          <li><a href="/260407_O2C_Intelligence_2030_PR_EN.pdf" target="_blank" rel="noopener noreferrer">O2C Intelligence 2030 Plan</a><span>Long-term EBITDA margin and AI-native roadmap.</span></li>
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
    <Page eyebrow="Documents" title="Sources">
      <Panel title="PDF library">
        <DataTable columns={["File", "Date", "Pages", "Source"]} rows={[
          [<a href="/PR_2025_Results_EN.pdf" target="_blank" rel="noopener noreferrer" key="pr">PR_2025_Results_EN.pdf</a>, "FY25 / 2026 release", "4", "Sidetrade press release"],
          [<a href="/Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf" target="_blank" rel="noopener noreferrer" key="stat">FY25 statutory report</a>, "Apr. 2026", "38", "Consolidated statutory accounts"],
          [<a href="/260407_O2C_Intelligence_2030_PR_EN.pdf" target="_blank" rel="noopener noreferrer" key="plan">O2C Intelligence 2030 plan</a>, "Apr. 2026", "5", "Strategic plan press release"],
        ]} highlightColumn={0} />
      </Panel>
    </Page>
  );
}
