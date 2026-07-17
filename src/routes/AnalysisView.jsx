import { useMemo, useRef, useState } from "react";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import {
  enterpriseValue,
  equityBridge,
  buildTrajectory,
  sensitivityWaccG,
  sensitivityWaccExit,
  FY25,
  SCENARIOS,
  VALUATION_CONTEXT,
} from "../utils/dcfEngine.js";

const EURO = "€";
const FF_MIN = 100;
const FF_MAX = 600;
const WACCS = [0.085, 0.09, 0.095, 0.1, 0.105];
const GS = [0.035, 0.03, 0.025, 0.02, 0.015];
const EXIT_MULTIPLES = [13, 14, 15, 16, 17];
const SCENARIO_IDS = ["bear", "base", "bull"];

const scenarioCopy = {
  bear: {
    sub: "Cautious · margin caps at 26%",
    tag: "BEAR",
    title: "A profile that decelerates",
    narrative:
      "Organic growth slows despite acquisitions. ezyCollect / SHS Viveon integration is dilutive longer than planned (consolidated gross margin slips under 80%). AI agents struggle to monetise beyond early signings. EBITDA margin caps at 26% in 2030, below the bottom of the 30–35% guidance band. Adverse macro, IT budgets under pressure, North America slowdown.",
  },
  base: {
    sub: "2025 trajectory holds",
    tag: "BASE",
    title: "The 2025 trajectory holds",
    narrative:
      "Q1 2026 already published at +17% reported / +21% cc total, +27% on subscriptions cc, supports a sustained growth case. EBITDA margin reaches 32% by 2030, mid-range of the O2C Intelligence 2030 plan (30–35% target). The AI Cash Collection Agent signs a few large accounts in 2026–2027 without becoming a mass product. Margins of ezyCollect / SHS Viveon converge progressively toward the group's LFL standard (81%).",
  },
  bull: {
    sub: "AI-native scales · 35% margin",
    tag: "BULL",
    title: "AI-native changes the equation",
    narrative:
      '"Aimie" agent scales on the pre-committed signings (4 multinationals already announced). North America passes 40% of total revenue. Multiple re-rating toward AI-native peers comparable to post-deal Esker (~23x forward EBITDA). EBITDA margin reaches 35%, top of management guidance. The O2C Intelligence 2030 plan (€18–23m AI-native dedicated revenue in 2030) delivers.',
  },
};

function fmtM(value, decimals = 0) {
  return `${EURO}${value.toFixed(decimals)}m`;
}

function fmtPct(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

function pctFromValue(value) {
  return Math.max(0, Math.min(100, ((value - FF_MIN) / (FF_MAX - FF_MIN)) * 100));
}

function evScenario(id) {
  return enterpriseValue(id);
}

function resultFor(id) {
  const trajectory = buildTrajectory(id);
  const last = trajectory[trajectory.length - 1];
  const ev = evScenario(id);
  return {
    rev: last.revenue,
    ebitda: last.ebitda,
    fcf: last.fcf,
    ev,
    evSales: ev / FY25.revenue,
    margin: last.ebitdaMargin,
    fcfMargin: last.fcf / last.revenue,
  };
}

function Tip({ children, k, body, v }) {
  return (
    <span className="tip">
      {children}
      <span className="tip-body">
        <span className="tip-k">{k}</span>
        {body}
        {v ? <span className="tip-v">{v}</span> : null}
      </span>
    </span>
  );
}

function ScenarioCards({ activeScenario, setActiveScenario, scenarioResults }) {
  const tabRefs = useRef({});

  function selectScenario(id, moveFocus = false) {
    setActiveScenario(id);
    if (moveFocus) {
      window.requestAnimationFrame(() => tabRefs.current[id]?.focus());
    }
  }

  function handleScenarioKeyDown(event, currentId) {
    const currentIndex = SCENARIO_IDS.indexOf(currentId);
    let nextId;

    if (event.key === "ArrowRight") {
      nextId = SCENARIO_IDS[(currentIndex + 1) % SCENARIO_IDS.length];
    } else if (event.key === "ArrowLeft") {
      nextId = SCENARIO_IDS[(currentIndex - 1 + SCENARIO_IDS.length) % SCENARIO_IDS.length];
    } else if (event.key === "Home") {
      nextId = SCENARIO_IDS[0];
    } else if (event.key === "End") {
      nextId = SCENARIO_IDS[SCENARIO_IDS.length - 1];
    } else {
      return;
    }

    event.preventDefault();
    selectScenario(nextId, true);
  }

  return (
    <div className="scenario-cards" role="tablist" aria-label="DCF scenario">
      {SCENARIO_IDS.map((id) => (
        <button
          aria-selected={activeScenario === id}
          className="sc-card"
          data-s={id}
          data-active={activeScenario === id ? "true" : "false"}
          key={id}
          onClick={() => selectScenario(id)}
          onKeyDown={(event) => handleScenarioKeyDown(event, id)}
          ref={(node) => {
            if (node) tabRefs.current[id] = node;
          }}
          role="tab"
          tabIndex={activeScenario === id ? 0 : -1}
          type="button"
        >
          <div className="sc-row">
            <span className="sc-tag">{id[0].toUpperCase() + id.slice(1)}</span>
            <span className="sc-sub">{scenarioCopy[id].sub}</span>
          </div>
          <div className="sc-ev">{fmtM(scenarioResults[id].ev)} EV</div>
        </button>
      ))}
    </div>
  );
}

function TrajectoryChart({ activeScenario }) {
  const [tip, setTip] = useState(null);
  const trajectory = useMemo(() => buildTrajectory(activeScenario), [activeScenario]);
  const w = 800;
  const h = 300;
  const mL = 56;
  const mR = 70;
  const mT = 28;
  const mB = 40;
  const maxY = 140;
  const innerW = w - mL - mR;
  const innerH = h - mT - mB;
  const baseline = mT + innerH;
  const x = (i) => mL + (i / 5) * innerW;
  const y = (v) => mT + innerH - (v / maxY) * innerH;
  const rev = trajectory.map((d) => d.revenue);
  const ebitda = trajectory.map((d) => d.ebitda);
  const path = (arr) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const area = `${path(rev)} L ${x(5).toFixed(2)} ${baseline.toFixed(2)} L ${x(0).toFixed(2)} ${baseline.toFixed(2)} Z`;

  return (
    <div aria-label="Revenue and EBITDA chart" className="chart-wrap" role="region" style={{ position: "relative" }} tabIndex="0">
      <div className="chart-head">
        <div className="left">
          <h3>Revenue &amp; EBITDA trajectory · 2025 → 2030</h3>
          <div className="sub">Recomposes live with the active scenario above. Hover any year for the bridge.</div>
        </div>
        <div className="chart-legend">
          <span><span className="swatch rev" />Revenue</span>
          <span><span className="swatch ebitda" />EBITDA</span>
        </div>
      </div>
      <svg aria-labelledby="trajectory-chart-title trajectory-chart-desc" className="chart-svg" id="traj-chart" role="img" viewBox="0 0 800 300" preserveAspectRatio="none">
        <title id="trajectory-chart-title">Revenue and EBITDA trajectory from 2025 to 2030</title>
        <desc id="trajectory-chart-desc">The chart updates with the selected DCF scenario. Revenue and EBITDA values are also provided as accessible text immediately after the chart.</desc>
        {[0, 35, 70, 105, 140].map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={mL} x2={w - mR} y1={y(tick)} y2={y(tick)} />
            <text className="axis-text" x={mL - 10} y={y(tick) + 3} textAnchor="end">{EURO}{tick}m</text>
          </g>
        ))}
        <line stroke="var(--line-strong)" x1={mL} x2={w - mR} y1={baseline} y2={baseline} />
        {trajectory.map((d, i) => (
          <text className="axis-text year" key={d.year} x={x(i)} y={baseline + 22} textAnchor="middle">{d.year}</text>
        ))}
        <path className="rev-area" d={area} />
        <path className="rev-line" d={path(rev)} />
        <path className="ebitda-line" d={path(ebitda)} />
        {trajectory.map((d, i) => (
          <g key={d.year}>
            <circle className="pt rev" cx={x(i)} cy={y(d.revenue)} r="3.5" />
            <circle className="pt ebitda" cx={x(i)} cy={y(d.ebitda)} r="3" />
            <rect
              className="pt-hit"
              x={x(i) - innerW / 10}
              y={mT}
              width={innerW / 5}
              height={innerH}
              onMouseLeave={() => setTip(null)}
              onMouseMove={(event) => {
                const rect = event.currentTarget.ownerSVGElement.closest(".chart-wrap").getBoundingClientRect();
                setTip({
                  year: d.year,
                  revenue: d.revenue,
                  ebitda: d.ebitda,
                  margin: d.ebitdaMargin,
                  left: Math.min(event.clientX - rect.left + 14, rect.width - 200),
                  top: Math.max(event.clientY - rect.top - 10, 0),
                });
              }}
            />
          </g>
        ))}
        <text className="end-label rev" x={x(5) + 8} y={y(rev[5]) + 3}>{EURO}{rev[5].toFixed(0)}m</text>
        <text className="end-label ebitda" x={x(5) + 8} y={y(ebitda[5]) + 3}>{EURO}{ebitda[5].toFixed(0)}m</text>
      </svg>
      <p className="sr-only">
        {trajectory.map((point) => `${point.year}: revenue ${fmtM(point.revenue, 1)}, EBITDA ${fmtM(point.ebitda, 1)}, EBITDA margin ${fmtPct(point.ebitdaMargin, 0)}.`).join(" ")}
      </p>
      <div className={tip ? "chart-tip on" : "chart-tip"} id="chart-tip" style={tip ? { left: tip.left, top: tip.top } : undefined}>
        {tip ? (
          <>
            <div className="y">{tip.year} · {activeScenario.toUpperCase()}</div>
            <div className="row"><span className="lbl">Revenue</span><span>{fmtM(tip.revenue, 1)}</span></div>
            <div className="row"><span className="lbl">EBITDA</span><span>{fmtM(tip.ebitda, 1)}</span></div>
            <div className="row"><span className="lbl">Margin</span><span>{fmtPct(tip.margin, 0)}</span></div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SensitivityHeatmap({ activeScenario }) {
  const values = sensitivityWaccG(activeScenario, WACCS, GS);
  const flat = values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);

  function color(value, center) {
    if (center) return undefined;
    const t = (value - min) / (max - min);
    const light = 94 - t * 28;
    const sat = 28 + t * 25;
    return { background: `hsl(351, ${sat}%, ${light}%)` };
  }

  return (
    <div className="sensi-wrap">
      <div className="sensi-head">
        <div className="left">
          <h3>Sensitivity · WACC × Terminal growth</h3>
          <div className="sub">DCF EV in €m, Base case FCF profile held constant. Recomputed on the fly — center cell is the Base case input.</div>
        </div>
        <div className="right">FCF 2026–2030 · Base case</div>
      </div>
      <div aria-label="DCF sensitivity table" className="table-scroll" role="region" tabIndex="0">
        <table className="sensi" id="sensi-table">
          <caption className="sr-only">Enterprise value sensitivity by WACC and terminal growth rate for the active DCF scenario.</caption>
          <thead>
            <tr>
              <th className="corner" scope="col">EV €m · WACC →</th>
              {WACCS.map((wacc) => <th key={wacc} scope="col">{fmtPct(wacc)}</th>)}
            </tr>
          </thead>
          <tbody>
            {GS.map((g, row) => (
              <tr key={g}>
                <th className="row-h" scope="row">g = {fmtPct(g)}</th>
                {WACCS.map((wacc, col) => {
                  const center = Math.abs(wacc - SCENARIOS[activeScenario].wacc) < 1e-6 && Math.abs(g - SCENARIOS[activeScenario].g) < 1e-6;
                  return (
                    <td className={center ? "cell center" : "cell"} key={wacc} style={color(values[row][col], center)}>
                      {fmtM(values[row][col])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ink-4)", fontStyle: "italic", marginTop: 10 }}>
        Cells shaded by intensity (darker = higher EV). The Base case at WACC 9.5% / g 2.5% is highlighted bordeaux and reconciles with the live DCF output.
      </p>
    </div>
  );
}

function FootballField({ activeScenario, scenarioResults }) {
  const ranges = {
    dcf: { low: scenarioResults.bear.ev, base: scenarioResults[activeScenario].ev, high: scenarioResults.bull.ev },
    trading: VALUATION_CONTEXT.tradingRange,
    transaction: VALUATION_CONTEXT.transactionRange,
    lbo: VALUATION_CONTEXT.lboRange,
  };

  function row(method, label, sub, baseText) {
    const range = ranges[method];
    const low = pctFromValue(range.low);
    const high = pctFromValue(range.high);
    const base = pctFromValue(range.base);
    return (
      <div className="ff-row" data-method={method}>
        <div className="label">{label}<span className="sub">{sub}</span></div>
        <div className="range-track" id={`ff-track-${method}`}>
          <div className="range-bar" style={{ left: `${low}%`, width: `${high - low}%` }} />
          <div className="base-tick" style={{ left: `calc(${base}% - 1px)` }} />
          <div className="endpoint left" style={{ left: `${low}%` }}>{fmtM(range.low)}</div>
          <div className="endpoint right" style={{ left: `${high}%` }}>{fmtM(range.high)}</div>
        </div>
        <div className="base-val"><span className="euro">€</span>{method === "dcf" ? <span id="ff-dcf-base">{baseText}</span> : baseText}</div>
      </div>
    );
  }

  return (
    <div aria-label={`Valuation football field with active DCF scenario ${activeScenario}`} className="ff" role="region" tabIndex="0">
      <div className="ff-canvas" id="ff-canvas">
        <div className="ff-rows">
          <div className="ref fair" style={{ left: `calc(130px + 14px + ${pctFromValue(301)}% * (100% - 244px) / 100)` }} />
          <div className="ref-label fair" style={{ left: `calc(130px + 14px + ${pctFromValue(301)}% * (100% - 244px) / 100)` }}>Fair value €301m</div>
          <div className="ref control" style={{ left: `calc(130px + 14px + ${pctFromValue(410)}% * (100% - 244px) / 100)` }} />
          <div className="ref-label control" style={{ left: `calc(130px + 14px + ${pctFromValue(410)}% * (100% - 244px) / 100)` }}>Control €410m</div>
          <div className="ref market" style={{ left: `calc(130px + 14px + ${pctFromValue(282)}% * (100% - 244px) / 100)` }} />
          <div className="ref-label market" style={{ left: `calc(130px + 14px + ${pctFromValue(282)}% * (100% - 244px) / 100)` }}>Market EV ~€282m (15 Jul 2026)</div>
          {row("dcf", "DCF", "Fundamental", `${scenarioResults[activeScenario].ev.toFixed(0)}m`)}
          {row("trading", "Trading", "Stand-alone", "202m")}
          {row("transaction", "Transaction", "Control", "411m")}
          {row("lbo", "LBO", "Affordability", "242m")}
        </div>
      </div>
      <div className="ff-row ff-axis-row" aria-hidden="true">
        <div className="label">&nbsp;</div>
        <div className="ff-axis-inner">
          <span className="tick" style={{ left: "0%" }}>€100m</span>
          <span className="tick" style={{ left: "20%" }}>€200m</span>
          <span className="tick tick-accent fair" style={{ left: "40%" }}>€301m</span>
          <span className="tick tick-accent control" style={{ left: "62%" }}>€410m</span>
          <span className="tick" style={{ left: "80%" }}>€500m</span>
          <span className="tick" style={{ left: "100%" }}>€600m</span>
        </div>
        <div className="base-val">&nbsp;</div>
      </div>
    </div>
  );
}

function WaterfallBridge({ activeScenario }) {
  const bridge = equityBridge(activeScenario);
  const baseline = 230;
  const maxV = 560;
  const maxH = 175;
  const yFor = (value) => baseline - (value / maxV) * maxH;
  const bar1X = 50;
  const bar2X = 320;
  const barW = 180;
  const evTop = yFor(bridge.ev);
  const equityTop = yFor(bridge.equity);

  return (
    <div aria-label="Enterprise value to share price bridge" className="waterfall-wrap" role="region" tabIndex="0">
      <svg aria-labelledby="waterfall-title waterfall-desc" className="waterfall-svg" id="waterfall-svg" role="img" viewBox="0 0 1000 280" preserveAspectRatio="xMidYMid meet">
        <title id="waterfall-title">Enterprise value to implied share price bridge</title>
        <desc id="waterfall-desc">Enterprise value {fmtM(bridge.ev)}, less net debt {fmtM(bridge.netDebt, 1)}, equals equity value {fmtM(bridge.equity)} and an implied share price of {EURO}{bridge.sharePrice.toFixed(0)}.</desc>
        <rect className="wf-bar ev" x={bar1X} y={evTop} width={barW} height={baseline - evTop} />
        <rect className="wf-bar equity" x={bar2X} y={equityTop} width={barW} height={baseline - equityTop} />
        <line className="wf-deduct-line" x1={bar1X + barW} y1={evTop} x2={bar2X} y2={evTop} />
        <rect className="wf-bar deduct" x={bar2X} y={evTop} width={barW} height={equityTop - evTop} />
        <line x1="30" x2="560" y1={baseline} y2={baseline} stroke="var(--line-strong)" strokeWidth="1" />
        <text className="wf-label" x={bar1X + barW / 2} y={evTop - 30} textAnchor="middle">Enterprise Value</text>
        <text className="wf-value accent" x={bar1X + barW / 2} y={evTop - 10} textAnchor="middle">{fmtM(bridge.ev)}</text>
        <text className="wf-label" x={bar1X + barW + (bar2X - bar1X - barW) / 2} y={evTop - 8} textAnchor="middle">(−) Net debt {fmtM(bridge.netDebt, 1)}</text>
        <text className="wf-label" x={bar2X + barW / 2} y={equityTop - 30} textAnchor="middle">Equity Value</text>
        <text className="wf-value accent" x={bar2X + barW / 2} y={equityTop - 10} textAnchor="middle">{fmtM(bridge.equity)}</text>
        <text className="wf-sub" x={bar1X + barW / 2} y={baseline + 20} textAnchor="middle">EV · DCF + comps central case</text>
        <text className="wf-sub" x={bar2X + barW / 2} y={baseline + 20} textAnchor="middle">€30.8m debt − €16.3m cash = €14.7m net debt</text>
        <line x1="600" x2="600" y1="50" y2="240" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
        <path className="wf-arrow" d="M 620 145 L 700 145" />
        <path className="wf-arrow" d="M 692 139 L 702 145 L 692 151" />
        <text className="wf-label" x="720" y="95">Implied share price</text>
        <text className="wf-final" x="720" y="158">{EURO}{bridge.sharePrice.toFixed(0)}</text>
        <text className="wf-sub" x="815" y="158">/ share</text>
        <text className="wf-sub" x="720" y="188">{fmtM(bridge.equity)} equity ÷ 1,536,790 diluted shares</text>
        <text className="wf-sub" x="720" y="208">Stand-alone central case</text>
      </svg>
    </div>
  );
}

export default function AnalysisView() {
  const { activeScenario, setActiveScenario } = useSidetradeScenario();
  const [fcfView, setFcfView] = useState("norm");
  const scenarioResults = useMemo(() => ({
    bear: resultFor("bear"),
    base: resultFor("base"),
    bull: resultFor("bull"),
  }), []);
  const active = scenarioResults[activeScenario];
  const cagr = Math.pow(active.rev / FY25.revenue, 1 / 5) - 1;
  const waccExit = sensitivityWaccExit(activeScenario, WACCS, EXIT_MULTIPLES);

  return (
    <article className="analysis-view">
      <header className="hero" id="executive">
        <div className="meta">
          <span className="dot" />
          <span>Independent valuation model · v1.0</span>
          <span>·</span>
          <span>Updated May 2026</span>
        </div>
        <h1>Sidetrade stand-alone value centres on <span className="accent">~€301m EV (DCF)</span> — ~7% above the quoted market EV — with ~€410m EV in a control case.</h1>
        <p className="sub">
          A four-method triangulation — DCF, trading comps, transaction comps and LBO affordability — applied to <strong>Sidetrade</strong> (Euronext Growth: ALBFR), a profitable AI-native Order-to-Cash SaaS. Toggle Bear / Base / Bull to recompose the DCF and watch the football field react.
        </p>
        <div className="keystats">
          <div className="cell"><div className="k">Revenue FY25</div><div className="v">€61.4m</div><div className="d up">+14% cc · +12% reported</div></div>
          <div className="cell"><div className="k">Subscriptions</div><div className="v">€53.5m</div><div className="d up">+20% cc · 87% of revenue</div></div>
          <div className="cell"><div className="k">EBITDA margin</div><div className="v">22%</div><div className="d">€13.4m · +22% YoY</div></div>
          <div className="cell"><div className="k">Net debt (strict)</div><div className="v">€14.7m</div><div className="d">Financial debt less cash &amp; marketable securities · ~€1.5B coverage capacity</div></div>
        </div>
        <nav className="desktop-chapter-index" aria-label="Sidetrade analysis chapters">
          <a href="#snapshot"><span>01</span>Investment case</a>
          <a href="#dcf"><span>02</span>Valuation</a>
          <a href="#football"><span>03</span>Synthesis</a>
          <a href="#red-flags"><span>04</span>Audit trail</a>
        </nav>
      </header>

      <section className="block tight" id="snapshot">
        <div className="sec-head">
          <div className="left"><div className="num-tag">01 — Company snapshot</div><h2>Office-of-CFO SaaS, profitable, founder-led, accessible target size</h2></div>
          <div className="right">SaaS Order-to-Cash AI-native · Founded by Olivier Novasque · 406 employees (statutory) / ~450 (corp. comm.) · Present in 85 countries · Agentic AI <em>Aimie</em> trained on $8T of B2B transactions.</div>
        </div>
        <p className="lede">
          Clean financial profile — 87% subscription mix, 92% subscription gross margin, 22% EBITDA already, operating leverage still ramping. Modest size (~€61m revenue) makes it accessible to PE mid-cap or a strategic consolidator. Documented 2030 plan and US investors building positions (<Tip k="US shareholder" body="Specialist in compounders; >10% stake disclosed.">Briarwood Chase &gt;10%</Tip>, Mission Trail Capital 5%).
        </p>
        <div className="twoup" style={{ marginTop: 32 }}>
          <div>
            <h3>FY25 P&amp;L — reported</h3>
            <table className="data" style={{ marginTop: 10 }}>
              <thead><tr><th>Metric</th><th className="num">€m</th><th className="num">% of revenue</th><th className="num">YoY</th></tr></thead>
              <tbody>
                <tr><td className="label">Revenue</td><td className="num strong">61.4</td><td className="num">100%</td><td className="num">+14% cc</td></tr>
                <tr><td className="label">– of which Subscriptions</td><td className="num">53.5</td><td className="num">87%</td><td className="num">+20% cc</td></tr>
                <tr><td className="label">Subscriptions organic LFL</td><td className="num">—</td><td className="num">—</td><td className="num">+10%</td></tr>
                <tr><td className="label">Gross margin</td><td className="num strong">47.4</td><td className="num">77%</td><td className="num">+10%</td></tr>
                <tr><td className="label">– GM on subscription only</td><td className="num">—</td><td className="num">92%</td><td className="num">—</td></tr>
                <tr><td className="label">EBITDA (incl. CIR)</td><td className="num strong">13.4</td><td className="num">22%</td><td className="num">+22%</td></tr>
                <tr><td className="label">EBIT (incl. CIR)</td><td className="num">10.3</td><td className="num">17%</td><td className="num">+23%</td></tr>
                <tr className="total"><td>Net profit</td><td className="num">9.0</td><td className="num">15%</td><td className="num">+14%</td></tr>
              </tbody>
            </table>
            <cite>Source: Sidetrade FY25 Annual Results · March 30, 2026.</cite>
          </div>
          <div>
            <h3>Geographic mix</h3>
            <table className="data" style={{ marginTop: 10 }}>
              <thead><tr><th>Region</th><th className="num">€m</th><th className="num">% rev.</th></tr></thead>
              <tbody>
                <tr><td>France</td><td className="num">18.8</td><td className="num">31%</td></tr>
                <tr><td>International</td><td className="num strong">42.6</td><td className="num">69%</td></tr>
                <tr><td className="label">– North America (subs.)</td><td className="num">—</td><td className="num">30%</td></tr>
                <tr><td className="label">– APAC (via ezyCollect)</td><td className="num">—</td><td className="num">new</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}><strong>69%</strong> of total revenue and <strong>71%</strong> of subscription revenue generated outside France. North America is now the leading region with <strong>+25% cc</strong> growth in 2025.</p>
            <h3 style={{ marginTop: 24 }}>Balance sheet</h3>
            <ul className="kpi-list" style={{ marginTop: 8 }}>
              <li><span className="lbl">Cash + marketable sec.</span><span className="val">€16.3m</span></li>
              <li><span className="lbl">Financial debt</span><span className="val">€30.8m</span></li>
              <li style={{ background: "var(--bg-quiet)" }}><span className="lbl" style={{ fontWeight: 500, color: "var(--ink)" }}>Net debt strict</span><span className="val" style={{ color: "var(--bordeaux)" }}>€14.7m</span></li>
              <li><span className="lbl">Treasury shares (85,300)</span><span className="val">€20.6m</span></li>
              <li><span className="lbl">Diluted shares outstanding</span><span className="val">1,536,790</span></li>
            </ul>
            <cite>Source: Statutory Report FY25 — Notes 6, 8, 10, 30.</cite>
          </div>
        </div>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <h3>Free cash flow — two views</h3>
            <div className="toggle-row" role="group" aria-label="FCF view toggle">
              <button aria-pressed={fcfView === "stat"} onClick={() => setFcfView("stat")} type="button">Statutory · €4.2m</button>
              <button aria-pressed={fcfView === "norm"} onClick={() => setFcfView("norm")} type="button">Normalised · €7.2m</button>
            </div>
          </div>
          <div className="twoup">
            <table className="data">
              <thead><tr><th></th><th className="num">Statutory</th><th className="num">Normalised</th></tr></thead>
              <tbody>
                <tr><td className="label">Net operational cash flow</td><td className="num">5.2</td><td className="num">5.2</td></tr>
                <tr><td className="label">(−) Capex</td><td className="num">(1.0)</td><td className="num">(1.0)</td></tr>
                <tr><td className="label">(+) CIR timing adjustment</td><td className="num">—</td><td className="num">2.9</td></tr>
                <tr className="total"><td>FCF</td><td className="num" style={{ color: fcfView === "stat" ? "var(--bordeaux)" : undefined }}>4.2</td><td className="num" style={{ color: fcfView === "norm" ? "var(--bordeaux)" : undefined }}>7.2</td></tr>
                <tr><td className="label">FCF margin</td><td className="num">6.9%</td><td className="num">11.7%</td></tr>
              </tbody>
            </table>
            <div className="narrative" data-s={fcfView === "stat" ? "bear" : "base"} style={{ marginTop: 0 }}>
              <h4>{fcfView === "stat" ? "Statutory view — CIR timing pressure" : "Normalised view — recurring cash capacity"}</h4>
              <p>{fcfView === "stat" ? "Sidetrade’s 2025 transition to European mid-cap status triggered a 3-year deferral on the State’s CIR reimbursement. That creates a €2.9m working-capital consumption weighing on 2025 FCF — and after the loss of SME status, the 3-year deferral repeats by vintage, so it is a timing effect rather than a pure one-off. Management itself communicates an operating cash flow of €8.7m \"excluding the timing impact of the Research Tax Credit\"." : "This view neutralises the CIR timing decalage to reflect the model’s recurring cash capacity. It is the preferred lens for the DCF; note the deferral repeats by CIR vintage until reimbursement cycles stabilise (~2028) — the normalisation corrects timing, it does not erase a recurring lag."}</p>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 40 }}>
          <h3>SaaS unit economics</h3>
          <div className="grid-3" style={{ marginTop: 14 }}>
            <div className="card"><div className="k mono-k">2025 new bookings</div><div className="big-stat">€11.04m</div><div className="small-muted">ACV new contracts · €4.32m New ARR · €6.71m services</div></div>
            <div className="card"><div className="k mono-k">Avg. initial contract length</div><div className="big-stat accent">46.4 months</div><div className="small-muted">Far above SaaS industry standards.</div></div>
            <div className="card"><div className="k mono-k">Customer quality</div><div className="big-stat">85%</div><div className="small-muted">of total revenue generated by enterprises &gt;$1B revenue. 54% Corporate portfolio &gt;€2.5B.</div></div>
          </div>
        </div>
      </section>

      <section className="block qoe-block" id="qoe">
        <div className="sec-head">
          <div className="left"><div className="num-tag">02 — Quality of Earnings</div><h2>Good recurring revenue, with a material CIR dependency to underwrite</h2></div>
          <div className="right">Public-data QoE bridge. Estimated adjustments remain explicitly marked and require confirmation in a data room.</div>
        </div>
        <div className="qoe-layout">
          <div className="qoe-bridge" aria-label="EBITDA quality of earnings bridge">
            <div className="qoe-node primary"><span>Published EBITDA</span><strong>€13.4m</strong><small>including CIR</small></div>
            <div className="qoe-connector"><span>− €3.5m</span><small>CIR</small></div>
            <div className="qoe-node"><span>Published ex-CIR</span><strong>≈€9.9m</strong><small>reported basis</small></div>
            <div className="qoe-connector positive"><span>+ €0.8m e</span><small>QoE adjustments</small></div>
            <div className="qoe-node adjusted"><span>Adjusted ex-CIR</span><strong>≈€10.7m</strong><small>estimated</small></div>
          </div>
          <aside className="qoe-readout">
            <p className="mono-k">Adjusted earnings reference</p>
            <strong>≈€14.2m</strong>
            <span>Adjusted EBITDA including CIR</span>
            <p>Pro forma adjusted EBITDA including CIR is estimated at <strong>€13.7–14.7m</strong>, subject to integration evidence and data-room confirmation.</p>
          </aside>
        </div>
        <div className="qoe-evidence-grid">
          <div><span>Revenue quality</span><strong>87%</strong><p>Subscription mix, with 92% subscription gross margin.</p></div>
          <div><span>OCF communicated</span><strong>€8.7m</strong><p>Excluding the timing impact of the Research Tax Credit.</p></div>
          <div><span>FCF statutory</span><strong>€4.216m</strong><p>Cash conversion after reported CIR timing pressure.</p></div>
          <div><span>FCF normalised</span><strong>€7.163m</strong><p>Timing-normalised view used as the economic cash lens.</p></div>
        </div>
        <div className="qoe-flags"><strong>Underwrite before signing</strong><span>CIR eligibility and reimbursement timing</span><span>ezyCollect / SHS Viveon pro forma integration</span><span>Normalised tax and working-capital evidence</span></div>
        <p className="qoe-source">Source: internally reviewed QoE note and canonical workbook. No new financial definition introduced in S3; “e” denotes an estimate to confirm.</p>
      </section>

      <section className="block" id="market">
        <div className="sec-head"><div className="left"><div className="num-tag">03 — Market sanity check</div><h2>Theoretical valuation vs current listed price</h2></div><div className="right">The only data point on this page that decays fast. To be refreshed immediately before any external distribution.</div></div>
        <div className="market-card">
          <div className="meta-row"><span className="placeholder-flag">As of 15 Jul 2026</span><span>Market data as of <strong>15 July 2026</strong></span></div>
          <div className="grid">
            <div className="cell"><div className="k">Current share price</div><div className="v">€174.00</div></div>
            <div className="cell"><div className="k">Market cap</div><div className="v">€267m</div></div>
            <div className="cell"><div className="k">Implied EV</div><div className="v">€282m</div></div>
            <div className="cell"><div className="k">Upside to fair value (€301m EV, DCF)</div><div className="v upside">+7%</div></div>
            <div className="cell"><div className="k">Upside to control case (€410m EV)</div><div className="v upside">+48%</div></div>
          </div>
          <p className="note">The dotted vertical line on the football field below mirrors the current market reference. Market reference filled as of 15 Jul 2026: €174.00/share × 1.537m diluted shares + €14.7m strict net debt ≈ €282m EV.</p>
        </div>
      </section>

      <section className="block" id="dcf">
        <div className="sec-head"><div className="left"><div className="num-tag">04 — DCF · Bear / Base / Bull</div><h2>Switch the scenario to recompose the model live</h2></div><div className="right">Assumptions, end-state and narrative all update in step. The football field DCF bar follows.</div></div>
        <ScenarioCards activeScenario={activeScenario} scenarioResults={scenarioResults} setActiveScenario={setActiveScenario} />
        <TrajectoryChart activeScenario={activeScenario} />
        <div className="result-strip" style={{ marginTop: 24 }}>
          <div className="cell"><div className="k">Revenue 2030</div><div className="v figure">{fmtM(active.rev, 1)}</div><div className="d">CAGR 25–30: {fmtPct(cagr)}</div></div>
          <div className="cell"><div className="k">EBITDA 2030</div><div className="v figure">{fmtM(active.ebitda, 1)}</div><div className="d">{fmtPct(active.margin, 1)} margin</div></div>
          <div className="cell"><div className="k">FCF 2030</div><div className="v figure">{fmtM(active.fcf, 1)}</div><div className="d">{fmtPct(active.fcfMargin, 1)} FCF margin</div></div>
          <div className="cell"><div className="k">Enterprise Value (DCF)</div><div className="v figure accent">{fmtM(active.ev)}</div><div className="d">EV / FY25 Sales: {active.evSales.toFixed(1)}x</div></div>
        </div>
        <div className="twoup" style={{ marginTop: 32 }}>
          <div>
            <h3>Key assumptions</h3>
            <table className="data" style={{ marginTop: 10 }}>
              <thead><tr><th>Driver</th><th className="num">Bear</th><th className="num">Base</th><th className="num">Bull</th></tr></thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => <tr key={i}><td className="label">Revenue growth {2026 + i}</td><td className="num">{fmtPct(SCENARIOS.bear.growth[i], 0)}</td><td className="num strong">{fmtPct(SCENARIOS.base.growth[i], 0)}</td><td className="num">{fmtPct(SCENARIOS.bull.growth[i], 0)}</td></tr>)}
                <tr><td className="label">EBITDA margin 2030</td><td className="num">26%</td><td className="num strong">32%</td><td className="num">35%</td></tr>
                <tr><td className="label">Effective tax rate</td><td className="num">25%</td><td className="num strong">22%</td><td className="num">20%</td></tr>
                <tr><td className="label">Capex / revenue</td><td className="num">3.0%</td><td className="num strong">2.7%</td><td className="num">2.5%</td></tr>
                <tr><td className="label">ΔWC / Δrevenue</td><td className="num">10%</td><td className="num strong">7%</td><td className="num">5%</td></tr>
                <tr><td className="label">WACC</td><td className="num">10.5%</td><td className="num strong">9.5%</td><td className="num">8.5%</td></tr>
                <tr><td className="label">Terminal growth</td><td className="num">2.0%</td><td className="num strong">2.5%</td><td className="num">3.0%</td></tr>
              </tbody>
            </table>
            <cite>D&amp;A held constant at 2.0% of revenue (economic proxy, vs ~5.9% reported accounting D&amp;A).</cite>
          </div>
          <div>
            <h3>Narrative</h3>
            <div className="narrative" data-s={activeScenario}><h4><span className="tag">{scenarioCopy[activeScenario].tag}</span><span>{scenarioCopy[activeScenario].title}</span></h4><p>{scenarioCopy[activeScenario].narrative}</p></div>
            <h3 style={{ marginTop: 24 }}>DCF result · all scenarios</h3>
            <table className="data" style={{ marginTop: 10 }}>
              <thead><tr><th></th><th className="num">Bear</th><th className="num">Base</th><th className="num">Bull</th></tr></thead>
              <tbody>
                <tr><td className="label">Revenue 2030</td><td className="num">{fmtM(scenarioResults.bear.rev, 1)}</td><td className="num strong">{fmtM(scenarioResults.base.rev, 1)}</td><td className="num">{fmtM(scenarioResults.bull.rev, 1)}</td></tr>
                <tr><td className="label">EBITDA 2030</td><td className="num">{fmtM(scenarioResults.bear.ebitda, 1)}</td><td className="num strong">{fmtM(scenarioResults.base.ebitda, 1)}</td><td className="num">{fmtM(scenarioResults.bull.ebitda, 1)}</td></tr>
                <tr><td className="label">FCF 2030</td><td className="num">{fmtM(scenarioResults.bear.fcf, 1)}</td><td className="num strong">{fmtM(scenarioResults.base.fcf, 1)}</td><td className="num">{fmtM(scenarioResults.bull.fcf, 1)}</td></tr>
                <tr className="total"><td>EV implicit</td><td className="num">{fmtM(scenarioResults.bear.ev)}</td><td className="num">{fmtM(scenarioResults.base.ev)}</td><td className="num">{fmtM(scenarioResults.bull.ev)}</td></tr>
                <tr><td className="label">EV / FY25 Sales</td><td className="num">{scenarioResults.bear.evSales.toFixed(1)}x</td><td className="num strong">{scenarioResults.base.evSales.toFixed(1)}x</td><td className="num">{scenarioResults.bull.evSales.toFixed(1)}x</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <SensitivityHeatmap activeScenario={activeScenario} />
        <details className="method" id="methodology"><summary>How we built it · methodology</summary><div className="body"><p><strong>Starting point.</strong> EBITDA 2025 incl. CIR = €13.4m. We anchor here because (i) Sidetrade communicates in EBITDA incl. CIR, (ii) the CIR is a recurring cash item under a long-standing statutory mechanism (CGI art. 244 quater B) — but eligibility, amount and timing remain subject to tax audit: recurrence is an assumption, not a guarantee.</p><p><strong>Core formula.</strong></p><pre>{`EBIT = EBITDA − D&A
FCF  = EBIT × (1 − tax) + D&A − Capex − ΔWC`}</pre><ol><li><strong>Economic vs accounting D&amp;A.</strong> Statutory shows ~€3.6m "amortization, depreciation and provisions" but that includes receivables provisions and operational provisions. Pure economic D&amp;A is ~€1.1m (intangibles €285k + tangibles €540k + goodwill/customer relations €296k). We use 2% of revenue as an economic proxy — not the 5.9% accounting figure.</li><li><strong>Normalised tax rate.</strong> 2025 P&amp;L shows +€2.15m net tax credit thanks to CIR. Theoretical reconcilable rate is ~17%. We spread by scenario: 25% Bear (progressive CIR erosion), 22% Base (stable regime), 20% Bull (international optimisation).</li><li><strong>WACC.</strong> Risk-free OAT 10Y ~3.2% + ERP Europe ~5.5% + small-cap SaaS relevered beta ~1.25 + size premium. Yields 8.5%–11.0% across scenarios.</li><li><strong>Terminal growth.</strong> 2.0%–3.0%, capped at 3% in Bull (above long-run European nominal GDP).</li><li><strong>Q1 2026 actuals.</strong> Already published at +17% reported / +21% cc total, +27% cc subscriptions — directly supports the Base case 17% 2026 growth assumption.</li></ol></div></details>
      </section>

      <section className="block" id="trading">
        <div className="sec-head"><div className="left"><div className="num-tag">05 — Trading comps</div><h2>Market value, stand-alone</h2></div><div className="right">Listed B2B SaaS with comparable subscription mix, double-digit EBITDA margins, and CFO-office exposure. Hover any row for rationale.</div></div>
        <table className="data">
          <thead><tr><th>Peer</th><th>Why comparable</th><th className="num">EV / Sales (indicative)</th><th>Geo</th></tr></thead>
          <tbody>
            <tr><td><Tip k="Central benchmark" body="French listed O2C/P2P SaaS, exact same sector and geography. Pre-Bridgepoint take-private trading multiple. Best read-through to Sidetrade's standalone listed multiple." v="FY+1 EV/Sales ~5.5–6.0x"><strong>Esker</strong> <span className="star">★</span></Tip></td><td>O2C/P2P · French SaaS · pre-buyout reference</td><td className="num">~5.5–6.0x</td><td>FR</td></tr>
            <tr><td><Tip k="Finance automation" body="Closer to accounting workflow than O2C, but directly Office-of-CFO. Used as a mid-range anchor for SaaS premium multiples on a mature profile." v="FY+1 EV/Sales ~2.4x (15 Jul 2026)"><strong>BlackLine</strong></Tip></td><td>Finance automation · accounting workflow</td><td className="num">~2.4x</td><td>US</td></tr>
            <tr><td><Tip k="AP/AR + payments" body="Adjacent O2C in the SME US market — useful low-end anchor for AR automation multiples." v="FY+1 EV/Sales ~2.4x, ~2.6x core (15 Jul 2026)"><strong>BILL</strong></Tip></td><td>AP/AR automation + payments</td><td className="num">~2.4x</td><td>US</td></tr>
            <tr><td><Tip k="Vertical SaaS" body="Vertical banking SaaS — profitable, sticky, multi-year contracts. Adds vertical-SaaS premium reference." v="FY+1 EV/Sales ~3.2x (15 Jul 2026)"><strong>nCino</strong></Tip></td><td>Vertical SaaS banking</td><td className="num">~3.2x</td><td>US</td></tr>
            <tr><td><Tip k="B2B finance SaaS" body="Digital banking SaaS — comparable subscription mix and growth band." v="FY+1 EV/Sales ~3.0–3.5x"><strong>Q2 Holdings</strong></Tip></td><td>Digital banking SaaS</td><td className="num">~3.0–3.5x</td><td>US</td></tr>
            <tr><td><Tip k="Profitable B2B network" body='Network SaaS, vertical-led, profitable. Useful for the "profitable SaaS at scale" multiple anchor.' v="FY+1 EV/Sales ~2.0–2.5x"><strong>SPS Commerce</strong></Tip></td><td>B2B network · profitable SaaS</td><td className="num">~2.0–2.5x</td><td>US</td></tr>
            <tr><td><Tip k="CFO adjacency" body="Reporting / compliance SaaS — Office-of-CFO adjacency, not direct O2C." v="FY+1 EV/Sales ~2.8x (15 Jul 2026)"><strong>Workiva</strong></Tip></td><td>Reporting / compliance SaaS</td><td className="num">~2.8x</td><td>US</td></tr>
          </tbody>
        </table>
        <cite>Ranges as of 15 July 2026 (prices 15/07/2026, May-2026 guidances, EUR/USD 1.1424). BlackLine / BILL / nCino / Workiva refreshed; Esker is the pre-buyout historical reference; Q2 Holdings and SPS Commerce indicative (H1-2025, not refreshed). Multiples are forward FY+1. EV/EBITDA tiers marked * use non-GAAP operating income as proxy (not a true EBITDA).</cite>
        <div className="twoup" style={{ marginTop: 32 }}>
          <div><h3>Retained multiples for Sidetrade</h3><table className="data" style={{ marginTop: 10 }}><thead><tr><th>Tier</th><th className="num">EV / Sales</th><th className="num">EV / EBITDA</th></tr></thead><tbody><tr><td className="label">Low — min of refreshed peers</td><td className="num">2.4x</td><td className="num">10.0x*</td></tr><tr><td className="label">Base — median of refreshed peers</td><td className="num strong">2.6x</td><td className="num strong">12.6x*</td></tr><tr><td className="label">High — max of refreshed peers</td><td className="num">3.2x</td><td className="num">17.2x*</td></tr></tbody></table></div>
          <div><h3>Range implied — stand-alone</h3><div className="result-strip three" style={{ marginTop: 10 }}><div className="cell"><div className="k">Low</div><div className="v">€171m</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">Base</div><div className="v accent">€202m</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">High</div><div className="v">€264m</div><div className="d">EV implicit</div></div></div><p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>The refreshed peer range sits below both the DCF (<strong style={{ color: "var(--bordeaux)" }}>~€301m EV</strong>) and Sidetrade’s own market EV (~€282m at €174/share, 15 Jul 2026): derated US peers act as a sentiment floor. The gap is an assumed premium debate — organic growth, profitability, FR small-cap scarcity — not a convergence.</p></div>
        </div>
        <details className="method"><summary>How we built it · methodology</summary><div className="body"><p><strong>Logic.</strong> Value Sidetrade through comparison with listed European and North-American B2B SaaS that share its financial profile: dominant subscription mix, double-digit EBITDA margin, &gt;10% growth, Office-of-CFO or finance-productivity exposure.</p><p><strong>Limitations.</strong> Sidetrade is small-cap and not very liquid on Euronext Growth — a natural discount applies vs mid-caps listed on Euronext Paris or US markets. We retain forward (FY+1) multiples to neutralise 2025 one-offs. Multiples move daily; this range reflects a market window and should be refreshed before any external publication.</p></div></details>
      </section>

      <section className="block" id="transaction">
        <div className="sec-head"><div className="left"><div className="num-tag">06 — Transaction comps</div><h2>Control value · what a buyer has actually paid</h2></div><div className="right">Forward FY1e multiples on Office-of-CFO / O2C / finance automation precedents. Hover any row for context.</div></div>
        <table className="data">
          <thead><tr><th>Target</th><th>Buyer</th><th>Date</th><th className="num">EV / Sales FY1e</th><th className="num">EV / EBITDA FY1e</th></tr></thead>
          <tbody>
            <tr><td><Tip k="Central comp" body="Same sector (O2C), same geography (France), same financial profile, similar starting size. The single most relevant precedent for Sidetrade." v="7.8x sales · 40.6x EBITDA FY1e"><strong>Esker</strong> <span className="star">★</span></Tip></td><td>Bridgepoint / General Atlantic</td><td>2024/25</td><td className="num strong">7.8x</td><td className="num strong">40.6x</td></tr>
            <tr><td><Tip k="Premium comp" body="Sponsor take-private at peak multiple — sets the high anchor for strategic / sponsor pricing of O2C-adjacent SaaS." v="9.5x sales · 38.8x EBITDA FY1e"><strong>Coupa</strong></Tip></td><td>Thoma Bravo</td><td>2023</td><td className="num">9.5x</td><td className="num">38.8x</td></tr>
            <tr><td><Tip k="O2C, loss-making" body="Direct O2C peer but unprofitable — EBITDA multiple n/m, but revenue multiple confirms the sales-based premium." v="9.2x sales">Billtrust</Tip></td><td>EQT</td><td>2022</td><td className="num">9.2x</td><td className="num">n/m</td></tr>
            <tr><td><Tip k="Strategic e-invoicing" body="Strategic acquisition by a global data player — premium reflects e-invoicing scarcity." v="7.9x sales">Pagero</Tip></td><td>Thomson Reuters</td><td>2024</td><td className="num">7.9x</td><td className="num">n/m</td></tr>
            <tr><td><Tip k="B2B payments" body="Mature B2B payments SaaS — a useful mid-range anchor." v="5.0x sales · 24.7x EBITDA FY1e">Bottomline</Tip></td><td>Thoma Bravo</td><td>2022</td><td className="num">5.0x</td><td className="num">24.7x</td></tr>
            <tr><td><Tip k="European comp" body="European Office-of-CFO SaaS taken private — closest geographical and profile comp after Esker." v="4.1x sales · 27.2x EBITDA FY1e"><strong>Basware</strong></Tip></td><td>Accel-KKR</td><td>2022</td><td className="num">4.1x</td><td className="num">27.2x</td></tr>
            <tr><td><Tip k="Legacy · low anchor" body="Legacy e-invoicing transition — sets the floor for the range." v="1.8x sales · 14.3x EBITDA FY1e">Tungsten</Tip></td><td>Kofax</td><td>2022</td><td className="num">1.8x</td><td className="num">14.3x</td></tr>
            <tr><td><Tip k="Small · low anchor" body="Small UK procurement — distressed-end of the range, included for floor." v="2.4x sales · 9.5x EBITDA FY1e">Proactis</Tip></td><td>Pollen Street</td><td>2021</td><td className="num">2.4x</td><td className="num">9.5x</td></tr>
          </tbody>
        </table>
        <cite>Source: Edison Group precedent transactions table (Esker offer, 2024/25), augmented.</cite>
        <div className="twoup" style={{ marginTop: 24 }}><div><h3>Sidetrade's own M&amp;A — internal benchmarks</h3><p style={{ fontSize: 13.5 }}><strong>ezyCollect (Oct 2025) ·</strong> Total consideration €37.6m (€34.8m cash + €2.6m stock). Contributed €2.241m revenue since 1 Oct 2025, i.e. ~€9m annualised run-rate → implicit multiple ~4.2x revenue run-rate. Lower-mid anchor: smaller, APAC, SME, lower gross margin — not directly comparable to Sidetrade's core but useful as a floor.</p><p style={{ fontSize: 13.5 }}><strong>SHS Viveon (2024) ·</strong> Special situation (delisting tender at €3.00/share). €4.4m revenue since July 2024 i.e. ~€8.8m annualised. Implicit multiple is very low and reflects forced delisting context — use as qualitative floor only.</p></div><div><h3>Retained multiples — forward 2026E</h3><p style={{ fontSize: 12, color: "var(--ink-3)" }}>Base 2026E from model: Revenue €71.9m · EBITDA €17.1m. **EV/EBITDA control multiples n.m. — Esker EBITDA n.d., Coupa near-breakeven at deal (cf. workbook Transaction_comps).</p><table className="data" style={{ marginTop: 8 }}><thead><tr><th>Tier</th><th className="num">EV / Sales</th><th className="num">EV / EBITDA</th><th className="num">EV impl.</th></tr></thead><tbody><tr><td className="label">Low</td><td className="num">4.0x</td><td className="num">n.m.**</td><td className="num">€289m</td></tr><tr><td className="label">Base</td><td className="num strong">5.7x</td><td className="num strong">n.m.**</td><td className="num strong">€411m</td></tr><tr><td className="label">High</td><td className="num">7.6x</td><td className="num">n.m.**</td><td className="num">€547m</td></tr></tbody></table></div></div>
        <div className="result-strip three" style={{ marginTop: 18 }}><div className="cell"><div className="k">Low</div><div className="v">€289m</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">Base · control</div><div className="v accent">€411m</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">High</div><div className="v">€547m</div><div className="d">EV implicit</div></div></div>
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 12 }}>Deliberately above trading comps — these embed control premium (~20–40%), strategic scarcity and synergy potential. Read as <strong>M&amp;A value</strong>, not stand-alone.</p>
        <details className="method"><summary>How we built it · methodology</summary><div className="body"><p><strong>Logic.</strong> Precedent transactions answer "what did a buyer pay to take control of a comparable", not "what does the market value a comparable". By construction, these embed: (i) control premium 20–40%, (ii) strategic / scarcity premium, (iii) potential synergies, (iv) the buyer's ability to accept a longer horizon.</p><p><strong>Source.</strong> Primary source is the Edison Group table compiled for the Esker take-private (2024/25), covering O2C / P2P / AP automation / finance workflow deals with forward FY1e / FY2e multiples. We augment with Sidetrade's own M&amp;A as internal benchmarks.</p></div></details>
      </section>

      <section className="block" id="lbo">
        <div className="sec-head"><div className="left"><div className="num-tag">07 — LBO</div><h2>Sponsor affordability · what a PE could pay for a 20–25% IRR</h2></div><div className="right">Not a fundamental fair value — an affordability test that frames the sponsor pricing logic.</div></div>
        <div className="twoup"><div><h3>Base case assumptions</h3><table className="data" style={{ marginTop: 10 }}><tbody><tr><td className="label">Entry EV (Base affordability)</td><td className="num strong">€241.9m</td></tr><tr><td className="label">EBITDA 2025</td><td className="num">€13.4m</td></tr><tr><td className="label">Acquisition debt (4.0x EBITDA)</td><td className="num">~€53.5m</td></tr><tr><td className="label">Sponsor equity</td><td className="num">~€179m (after ~€28m founder rollover)</td></tr><tr><td className="label">Holding period</td><td className="num">5 years</td></tr><tr><td className="label">Interest rate</td><td className="num">~7.2% all-in (E3M + 479bps)</td></tr><tr><td className="label">Cash sweep</td><td className="num">75% of excess FCF + 1% mandatory amort.</td></tr><tr><td className="label">Exit EBITDA 2030 (Base)</td><td className="num">€36.2m</td></tr><tr><td className="label">Exit multiple (Base)</td><td className="num">15.0x EBITDA</td></tr><tr className="total"><td>Target IRR (Base)</td><td className="num">~22.5%</td></tr></tbody></table><p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 12 }}><strong>On leverage:</strong> the existing covenant (Net debt / EBITDA &lt; 2.5x on the BNP/LCL loans tied to ezyCollect) does not constrain a future LBO — in a PE take-control, existing debt is refinanced inside a new package. The 4.0x reflects sensible LBO capacity for a profitable SaaS, not the current balance sheet.</p></div><div><h3>Range</h3><div className="result-strip three" style={{ marginTop: 10 }}><div className="cell"><div className="k">Low</div><div className="v">€222.5m</div><div className="d">IRR target 25%</div></div><div className="cell"><div className="k">Base</div><div className="v accent">€241.9m</div><div className="d">IRR target 22.5%</div></div><div className="cell"><div className="k">High</div><div className="v">€283.5m</div><div className="d">IRR target 18%</div></div></div><p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>Low/High swing driven by the sponsor IRR hurdle (25% Low → 18% High) at a fixed 15x exit. Base affordability (~€242m) sits ~20% below the DCF (€301m): at a 22.5% hurdle a sponsor cannot outbid intrinsic value — consistent with take-privates requiring a control premium. Engine-solved (lbo_engine.py, CIR single-count fixed 15 Jul 2026). Use as <strong>sponsor affordability test</strong>, not fundamental fair value.</p></div></div>
        <details className="method"><summary>How we built it · methodology</summary><div className="body"><p>The LBO is solved for entry EV given target sponsor IRR, holding period, leverage, interest, exit EBITDA and exit multiple. Two levers drive most of the range: the IRR floor a sponsor will accept, and the exit multiple — which itself depends on the operating delivery of the holding period.</p><p className="src">Exit sensitivity range checked against WACC × exit multiple outputs: {fmtM(waccExit.flat()[0])} to {fmtM(waccExit.flat().at(-1))}.</p></div></details>
      </section>

      <section className="block" id="football">
        <div className="sec-head"><div className="left"><div className="num-tag">08 — Football field</div><h2>Four methods, one view</h2></div><div className="right">Scroll back up to switch DCF scenario — the DCF bar below recomposes live.</div></div>
        <FootballField activeScenario={activeScenario} scenarioResults={scenarioResults} />
        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card" style={{ borderTop: "3px solid var(--bordeaux)" }}><div className="mono-k" style={{ color: "var(--bordeaux)" }}>Stand-alone fair value</div><div className="big-card-value">€301m EV</div><p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>DCF Gordon Growth central value — ~7% above the quoted market EV (~€282m at €174/share, 15 Jul 2026). The reference number.</p></div>
          <div className="card" style={{ borderTop: "3px solid var(--bull)" }}><div className="mono-k" style={{ color: "var(--bull)" }}>Control case</div><div className="big-card-value">€410m EV</div><p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>Convergence with transaction precedents. ~40% control premium embedded.</p></div>
          <div className="card" style={{ borderTop: "3px solid var(--market)" }}><div className="mono-k" style={{ color: "var(--market)" }}>Implied share price · Base</div><div className="big-card-value">~€186</div><p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>(€301m − €14.7m net debt) / 1.537m diluted shares = ~€186 / share.</p></div>
        </div>
        <div className="equity-bridge-section" id="equity-bridge"><div className="section-kicker">EV → Equity → Share price</div><h3>From enterprise value to the shareholder outcome</h3><WaterfallBridge activeScenario={activeScenario} /><p><strong>Stand-alone range:</strong> €171m – €497m EV → ~€102–€314 / share. <br /><strong>Extended range (incl. M&amp;A / LBO):</strong> €171m – €547m EV → ~€102–€346 / share.</p></div>
        <div className="conclusion-panel" id="conclusions"><div className="mono-k">Investment committee conclusion</div><h3>Quality supports the stand-alone case; control value remains the strategic upside.</h3><div className="conclusion-grid"><p>Sidetrade combines a profitable O2C SaaS profile, 87% subscription mix, 92% subscription gross margin and a documented path toward 30–35% EBITDA margin.</p><p>Stand-alone value centres on <strong>~€301m EV</strong>, around <strong>€186 per share</strong>, while derated public peers and sponsor affordability frame the downside.</p><p>Transaction precedents support a control case near <strong>~€410m EV</strong>, subject to CIR diligence, integration delivery and a refreshed market reference.</p></div></div>
      </section>

      <section className="block" id="red-flags">
        <span className="anchor-alias" id="caveats" aria-hidden="true" />
        <div className="sec-head"><div className="left"><div className="num-tag">09 — Red flags &amp; limits</div><h2>What must be diligenced — and what this model is not</h2></div><div className="right">Independent v1.0 model built from public data only. Not a research recommendation.</div></div>
        <div className="caveats"><div><h3>Methodological</h3><ul><li>Independent v0 model built from public data only (FY25 statutory + press release + O2C Intelligence 2030 plan + public market data).</li><li>Trading multiples are sensitive to market window — refresh before publication if market conditions shift.</li><li>CIR treated as recurring cash (statutory mechanism; subject to tax-audit and timing risk — not economically guaranteed). Statutory view available as alternative for transparency.</li><li>ezyCollect / SHS Viveon margins still converging through 2026–2028 — Base case assumes partial integration. Multi-acquisition execution risk acknowledged.</li><li>Transaction comps embed a ~40% control premium — not directly comparable to a stand-alone fair value.</li><li>LBO is an affordability test, not a fundamental fair value.</li><li>D&amp;A used (2.0% of revenue) is an economic proxy, distinct from French accounting D&amp;A which includes receivable and operating provisions.</li><li>Treasury shares (€20.6m market value) not included in the equity bridge — treated as optionality, value depends on spot price.</li></ul></div><div><h3>Accounting specifics</h3><ul><li><strong>Gross margin reconstruction.</strong> <em>Gross margin is taken from Sidetrade's FY25 investor communication. It cannot be perfectly reconstructed from the French statutory P&amp;L alone because expenses are presented by nature, not by function.</em> The 77% / 81% LFL / 92% subscription figures come from the press release, not the statutory ANC.</li><li><strong>ezyCollect PPA pending.</strong> <em>ezyCollect PPA still pending until 31 Dec 2026. Future allocation from goodwill to customer relationships could increase amortization and affect EBIT, while leaving EBITDA broadly unaffected.</em> Part of the €38m goodwill may be reclassified as 20-year-amortisable customer relations after the allocation due end-2026. EBIT-impacting, EBITDA-neutral.</li><li><strong>Headcount discrepancy.</strong> 406 employees per statutory accounts at 31 December 2025 vs ~450 per corporate communication. The gap can reflect contractors, recent joiners not yet booked, or a rounded comms figure. Noted without dramatising.</li></ul></div></div>
      </section>

      <section className="block" id="sources">
        <div className="sec-head"><div className="left"><div className="num-tag">Reference</div><h2>Sources</h2></div><div className="right">Native links to the three PDFs stored in public/.</div></div>
        <div className="grid-3">
          <a className="card source-card" href="/PR_2025_Results_EN.pdf" target="_blank" rel="noopener"><h3>Sidetrade FY25 Annual Results</h3><p>Press release · March 30, 2026</p></a>
          <a className="card source-card" href="/Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf" target="_blank" rel="noopener"><h3>Statutory Report FY25</h3><p>KPMG / Yuma Audit · April 21, 2026</p></a>
          <a className="card source-card" href="/260407_O2C_Intelligence_2030_PR_EN.pdf" target="_blank" rel="noopener"><h3>O2C Intelligence 2030</h3><p>Strategic Plan · April 7, 2026</p></a>
        </div>
      </section>

      <footer className="site">
        <div className="inner"><div><h4>Author</h4><div className="name">Hamza Ben Chaouch</div><p>ESSEC Grande École · Finance &amp; Analytics<br /><a href="mailto:hamza.benchaouch@essec.edu">hamza.benchaouch@essec.edu</a><br /><a href="tel:+33769913946">+33 7 69 91 39 46</a></p></div><div><h4>Sources</h4><p>Sidetrade FY25 Annual Results (Mar 30, 2026) · Statutory Report FY25 (KPMG / Yuma Audit, Apr 21, 2026) · O2C Intelligence 2030 Strategic Plan (Apr 7, 2026) · Edison Group precedent transactions table · Damodaran European ERP &amp; sector betas.</p></div><div><h4>Market reference</h4><p>Market data as of <strong>15 July 2026</strong>.</p></div></div>
        <div className="inner"><p className="disclaimer">Independent pedagogical model built from public data. Does not constitute an investment recommendation. All multiples and ranges are indicative and reflect a market window — refresh before any external distribution.</p></div>
      </footer>
    </article>
  );
}
