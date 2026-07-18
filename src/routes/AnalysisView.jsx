import { useMemo, useRef, useState } from "react";
import Localized from "../components/Localized.jsx";
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
import {
  CASH_CONVERSION,
  DISPLAY_VALUES,
  LBO_REFERENCE,
  NET_DEBT,
  QOE,
  SOURCE_STATUS,
  SOURCES,
  TRANSACTION_COMPS,
  VALUATION_DATES,
} from "../data/sidetradeFinancials.js";

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

function fmtNumber(value, decimals = 1) {
  return value.toFixed(decimals);
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
    <Localized><span className="tip">
      {children}
      <span className="tip-body">
        <span className="tip-k">{k}</span>
        {body}
        {v ? <span className="tip-v">{v}</span> : null}
      </span>
    </span></Localized>
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
    <Localized><div className="scenario-cards" role="tablist" aria-label="DCF scenario">
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
    </div></Localized>
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
    <Localized><div aria-label="Revenue and EBITDA chart" className="chart-wrap" role="region" style={{ position: "relative" }} tabIndex="0">
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
    </div></Localized>
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
    <Localized><div className="sensi-wrap">
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
    </div></Localized>
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
    <Localized><div aria-label={`Valuation football field with active DCF scenario ${activeScenario}`} className="ff" role="region" tabIndex="0">
      <div className="ff-canvas" id="ff-canvas">
        <div className="ff-rows">
          <div className="ref fair" style={{ left: `calc(130px + 14px + ${pctFromValue(VALUATION_CONTEXT.fairValueEv)}% * (100% - 244px) / 100)` }} />
          <div className="ref-label fair" style={{ left: `calc(130px + 14px + ${pctFromValue(VALUATION_CONTEXT.fairValueEv)}% * (100% - 244px) / 100)` }}>Fair value {fmtM(VALUATION_CONTEXT.fairValueEv)}</div>
          <div className="ref control" style={{ left: `calc(130px + 14px + ${pctFromValue(VALUATION_CONTEXT.controlEv)}% * (100% - 244px) / 100)` }} />
          <div className="ref-label control" style={{ left: `calc(130px + 14px + ${pctFromValue(VALUATION_CONTEXT.controlEv)}% * (100% - 244px) / 100)` }}>Control {fmtM(VALUATION_CONTEXT.controlEv)}</div>
          <div className="ref market" style={{ left: `calc(130px + 14px + ${pctFromValue(VALUATION_CONTEXT.marketEv)}% * (100% - 244px) / 100)` }} />
          <div className="ref-label market" style={{ left: `calc(130px + 14px + ${pctFromValue(VALUATION_CONTEXT.marketEv)}% * (100% - 244px) / 100)` }}>Market EV ~{fmtM(VALUATION_CONTEXT.marketEv)} ({VALUATION_DATES.marketMedium})</div>
          {row("dcf", "DCF", "Fundamental", `${scenarioResults[activeScenario].ev.toFixed(0)}m`)}
          {row("trading", "Trading", "Stand-alone", `${VALUATION_CONTEXT.tradingRange.base.toFixed(0)}m`)}
          {row("transaction", "Transaction", "Control", `${VALUATION_CONTEXT.transactionRange.base.toFixed(0)}m`)}
          {row("lbo", "LBO", "Affordability", `${VALUATION_CONTEXT.lboRange.base.toFixed(0)}m`)}
        </div>
      </div>
      <div className="ff-row ff-axis-row" aria-hidden="true">
        <div className="label">&nbsp;</div>
        <div className="ff-axis-inner">
          <span className="tick" style={{ left: "0%" }}>€100m</span>
          <span className="tick" style={{ left: "20%" }}>€200m</span>
          <span className="tick tick-accent fair" style={{ left: "40%" }}>{fmtM(VALUATION_CONTEXT.fairValueEv)}</span>
          <span className="tick tick-accent control" style={{ left: "62%" }}>{fmtM(VALUATION_CONTEXT.controlEv)}</span>
          <span className="tick" style={{ left: "80%" }}>€500m</span>
          <span className="tick" style={{ left: "100%" }}>€600m</span>
        </div>
        <div className="base-val">&nbsp;</div>
      </div>
    </div></Localized>
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
    <Localized><div aria-label="Enterprise value to share price bridge" className="waterfall-wrap" role="region" tabIndex="0">
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
        <text className="wf-sub" x={bar2X + barW / 2} y={baseline + 20} textAnchor="middle">{fmtM(DISPLAY_VALUES.grossFinancialDebt, 1)} debt − {fmtM(DISPLAY_VALUES.cashAndMarketableSecurities, 1)} cash = {fmtM(NET_DEBT.strict, 1)} net debt</text>
        <line x1="600" x2="600" y1="50" y2="240" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
        <path className="wf-arrow" d="M 620 145 L 700 145" />
        <path className="wf-arrow" d="M 692 139 L 702 145 L 692 151" />
        <text className="wf-label" x="720" y="95">Implied share price</text>
        <text className="wf-final" x="720" y="158">{EURO}{bridge.sharePrice.toFixed(0)}</text>
        <text className="wf-sub" x="815" y="158">/ share</text>
        <text className="wf-sub" x="720" y="188">{fmtM(bridge.equity)} equity ÷ {FY25.dilutedShares.toLocaleString("en-GB")} diluted shares</text>
        <text className="wf-sub" x="720" y="208">Stand-alone central case</text>
      </svg>
    </div></Localized>
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
    <Localized><article className="analysis-view">
      <header className="hero" id="executive">
        <div className="meta">
          <span className="dot" />
          <span>FY25 public financials</span>
          <span>·</span>
          <span>{SOURCE_STATUS.MARKET_AS_OF}</span>
        </div>
        <h1>Sidetrade stand-alone value centres on <span className="accent">~{fmtM(VALUATION_CONTEXT.fairValueEv)} EV (DCF)</span> — ~7% above the quoted market EV — with ~{fmtM(VALUATION_CONTEXT.controlEv)} EV in a control case.</h1>
        <p className="sub">
          A four-method triangulation — DCF, trading comps, transaction comps and LBO affordability — applied to <strong>Sidetrade</strong> (Euronext Growth: ALBFR), a profitable AI-native Order-to-Cash SaaS. Toggle Bear / Base / Bull to recompose the DCF and watch the football field react.
        </p>
        <div className="keystats">
          <div className="cell"><div className="k">Revenue FY25</div><div className="v">{fmtM(FY25.revenue, 1)}</div><div className="d up">+14% cc · +12% reported</div></div>
          <div className="cell"><div className="k">Subscriptions</div><div className="v">{fmtM(DISPLAY_VALUES.subscriptionRevenue, 1)}</div><div className="d up">+20% cc · 87% of revenue</div></div>
          <div className="cell"><div className="k">EBITDA margin</div><div className="v">{fmtPct(FY25.ebitdaMargin, 0)}</div><div className="d">{fmtM(FY25.ebitda, 1)} · +22% YoY</div></div>
          <div className="cell"><div className="k">Net debt (strict)</div><div className="v">{fmtM(NET_DEBT.strict, 1)}</div><div className="d">Financial debt less cash &amp; marketable securities</div></div>
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
                <tr><td className="label">Revenue</td><td className="num strong">{fmtNumber(FY25.revenue)}</td><td className="num">100%</td><td className="num">+14% cc</td></tr>
                <tr><td className="label">– of which Subscriptions</td><td className="num">{fmtNumber(DISPLAY_VALUES.subscriptionRevenue)}</td><td className="num">87%</td><td className="num">+20% cc</td></tr>
                <tr><td className="label">Subscriptions organic LFL</td><td className="num">—</td><td className="num">—</td><td className="num">+10%</td></tr>
                <tr><td className="label">Gross margin</td><td className="num strong">47.4</td><td className="num">77%</td><td className="num">+10%</td></tr>
                <tr><td className="label">– GM on subscription only</td><td className="num">—</td><td className="num">92%</td><td className="num">—</td></tr>
                <tr><td className="label">EBITDA (incl. CIR)</td><td className="num strong">{fmtNumber(FY25.ebitda)}</td><td className="num">22%</td><td className="num">+22%</td></tr>
                <tr><td className="label">EBIT (incl. CIR)</td><td className="num">{fmtNumber(FY25.ebit)}</td><td className="num">17%</td><td className="num">+23%</td></tr>
                <tr className="total"><td>Net profit</td><td className="num">{fmtNumber(FY25.netIncome)}</td><td className="num">15%</td><td className="num">+14%</td></tr>
              </tbody>
            </table>
            <cite>Source: {SOURCES.annualResults.label} · {SOURCES.annualResults.date} · {SOURCES.annualResults.status}.</cite>
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
              <li><span className="lbl">Cash + marketable sec.</span><span className="val">{fmtM(DISPLAY_VALUES.cashAndMarketableSecurities, 1)}</span></li>
              <li><span className="lbl">Financial debt</span><span className="val">{fmtM(DISPLAY_VALUES.grossFinancialDebt, 1)}</span></li>
              <li style={{ background: "var(--bg-quiet)" }}><span className="lbl" style={{ fontWeight: 500, color: "var(--ink)" }}>Net debt strict</span><span className="val" style={{ color: "var(--bordeaux)" }}>{fmtM(NET_DEBT.strict, 1)}</span></li>
              <li><span className="lbl">Treasury shares (85,300)</span><span className="val">€20.6m</span></li>
              <li><span className="lbl">Diluted shares outstanding</span><span className="val">{FY25.dilutedShares.toLocaleString("en-GB")}</span></li>
            </ul>
            <cite>Source: Statutory Report FY25 — Notes 6, 8, 10, 30.</cite>
          </div>
        </div>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <h3>Free cash flow — two views</h3>
            <div className="toggle-row" role="group" aria-label="FCF view toggle">
              <button aria-pressed={fcfView === "stat"} onClick={() => setFcfView("stat")} type="button">Statutory · {fmtM(CASH_CONVERSION.statutoryFcf, 1)}</button>
              <button aria-pressed={fcfView === "norm"} onClick={() => setFcfView("norm")} type="button">Normalised · {fmtM(CASH_CONVERSION.normalisedFcf, 1)}</button>
            </div>
          </div>
          <div className="twoup">
            <table className="data">
              <thead><tr><th scope="col">Metric</th><th className="num" scope="col">Statutory</th><th className="num" scope="col">Normalised</th></tr></thead>
              <tbody>
                <tr><th className="label" scope="row">Net operational cash flow</th><td className="num">{fmtNumber(CASH_CONVERSION.statutoryOcf)}</td><td className="num">{fmtNumber(CASH_CONVERSION.statutoryOcf)}</td></tr>
                <tr><th className="label" scope="row">(−) Capex</th><td className="num">({fmtNumber(CASH_CONVERSION.capex)})</td><td className="num">({fmtNumber(CASH_CONVERSION.capex)})</td></tr>
                <tr><th className="label" scope="row">(+) CIR timing adjustment</th><td className="num">—</td><td className="num">{fmtNumber(CASH_CONVERSION.cirTimingNormalisation)}</td></tr>
                <tr className="total"><th scope="row">FCF</th><td className="num" style={{ color: fcfView === "stat" ? "var(--bordeaux)" : undefined }}>{fmtNumber(CASH_CONVERSION.statutoryFcf)}</td><td className="num" style={{ color: fcfView === "norm" ? "var(--bordeaux)" : undefined }}>{fmtNumber(CASH_CONVERSION.normalisedFcf)}</td></tr>
                <tr><th className="label" scope="row">FCF margin</th><td className="num">{fmtPct(CASH_CONVERSION.statutoryMargin)}</td><td className="num">{fmtPct(CASH_CONVERSION.normalisedMargin)}</td></tr>
              </tbody>
            </table>
            <div className="narrative" data-s={fcfView === "stat" ? "bear" : "base"} style={{ marginTop: 0 }}>
              <h4>{fcfView === "stat" ? "Statutory view — CIR timing pressure" : "Normalised view — recurring cash capacity"}</h4>
              <p>{fcfView === "stat" ? `Sidetrade’s loss of immediate SME reimbursement status created a 3-year lag on CIR cash collection. That generated ${fmtM(CASH_CONVERSION.cirTimingNormalisation, 3)} of working-capital consumption in FY25 — and the lag repeats by vintage, so it is a timing effect rather than a pure one-off. Management separately communicates operating cash flow of ${fmtM(CASH_CONVERSION.managementOcfExCirTiming, 1)} "excluding the timing impact of the Research Tax Credit"; the public documents do not provide a complete bridge to that KPI.` : "This view neutralises the identified FY25 CIR timing drag to show economic cash generation. It is the DCF starting lens; because the deferral repeats by CIR vintage, the normalisation corrects the FY25 timing distortion without claiming that the recurring cash lag disappears."}</p>
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
            <div className="qoe-node primary"><span>Published EBITDA</span><strong>{fmtM(QOE.publishedEbitdaInclCir, 1)}</strong><small>including CIR</small></div>
            <div className="qoe-connector"><span>− {fmtM(QOE.cirReported, 1)}</span><small>CIR</small></div>
            <div className="qoe-node"><span>Published ex-CIR</span><strong>≈{fmtM(QOE.publishedEbitdaExCir, 1)}</strong><small>reported basis</small></div>
            <div className="qoe-connector positive"><span>+ {fmtM(QOE.adjustmentsEstimate, 1)} e</span><small>QoE adjustments</small></div>
            <div className="qoe-node adjusted"><span>Adjusted ex-CIR</span><strong>≈{fmtM(QOE.adjustedEbitdaExCir, 1)}</strong><small>estimated</small></div>
            <div className="qoe-connector positive"><span>+ {fmtM(QOE.cirReported, 1)}</span><small>FY25 CIR</small></div>
            <div className="qoe-node adjusted"><span>Adjusted EBITDA</span><strong>≈{fmtM(QOE.adjustedEbitdaInclCir, 1)}</strong><small>including CIR · estimated</small></div>
          </div>
        </div>
        <p className="qoe-source">The estimated {fmtM(QOE.adjustmentsEstimate, 1)} adjustment bridges published ex-CIR EBITDA to the adjusted ex-CIR reference. Its components require supporting evidence; adding back FY25 CIR then reconciles to the {fmtM(QOE.adjustedEbitdaInclCir, 1)} adjusted EBITDA reference. Pro forma adjusted EBITDA including CIR is estimated between {fmtM(QOE.proFormaRange.low)} and {fmtM(QOE.proFormaRange.high)}, subject to integration evidence and data-room confirmation.</p>
        <div className="qoe-evidence-grid">
          <div><span>Revenue quality</span><strong>87%</strong><p>Subscription mix, with 92% subscription gross margin.</p></div>
          <div><span>OCF communicated</span><strong>{fmtM(CASH_CONVERSION.managementOcfExCirTiming, 1)}</strong><p>Excluding the timing impact of the Research Tax Credit.</p></div>
          <div><span>FCF statutory</span><strong>{fmtM(CASH_CONVERSION.statutoryFcf, 3)}</strong><p>Cash conversion after reported CIR timing pressure.</p></div>
          <div><span>FCF normalised</span><strong>{fmtM(CASH_CONVERSION.normalisedFcf, 3)}</strong><p>Timing-normalised view used as the economic cash lens.</p></div>
        </div>
        <div className="ts-workbench" id="cash-conversion">
          <div className="ts-panel cash-conversion-panel">
            <div className="section-kicker">Cash conversion · FY25</div>
            <h3>Separate reported cash, timing normalisation and management’s KPI</h3>
            <div className="cash-bridge" aria-label="FY25 statutory to normalised free cash flow bridge">
              <div><span>Statutory OCF</span><strong>{fmtM(CASH_CONVERSION.statutoryOcf, 3)}</strong><small>Cash-flow statement</small></div>
              <div className="cash-bridge-step"><span>− {fmtM(CASH_CONVERSION.capex, 3)}</span><small>Capex</small></div>
              <div><span>Statutory FCF</span><strong>{fmtM(CASH_CONVERSION.statutoryFcf, 3)}</strong><small>{fmtPct(CASH_CONVERSION.statutoryMargin)} margin</small></div>
              <div className="cash-bridge-step positive"><span>+ {fmtM(CASH_CONVERSION.cirTimingNormalisation, 3)}</span><small>CIR timing normalisation</small></div>
              <div className="cash-bridge-output"><span>Normalised FCF</span><strong>{fmtM(CASH_CONVERSION.normalisedFcf, 3)}</strong><small>{fmtPct(CASH_CONVERSION.normalisedMargin)} margin</small></div>
            </div>
            <p className="ts-interpretation"><strong>Do not plug {fmtM(CASH_CONVERSION.managementOcfExCirTiming, 1)} into this bridge.</strong> Management’s OCF excluding the CIR timing impact is a separately communicated KPI. It supports the direction of travel, but the public documents do not provide a line-by-line reconciliation from statutory OCF to {fmtM(CASH_CONVERSION.managementOcfExCirTiming, 1)}.</p>
          </div>
          <div className="ts-panel cir-panel">
            <div className="section-kicker">CIR · three distinct lenses</div>
            <h3>One programme, three different transaction questions</h3>
            <div className="cir-lenses">
              <div><span>Accounting</span><strong>{fmtM(QOE.cirReported, 3)} FY25</strong><p>Reclassified into operating income under the statutory presentation and included in reported EBITDA.</p></div>
              <div><span>Cash timing</span><strong>{fmtM(CASH_CONVERSION.cirTimingNormalisation, 3)} FY25 drag</strong><p>Loss of immediate SME reimbursement creates a three-year lag. The lag repeats by vintage; normalising FY25 does not mean the cash-cycle drag disappears.</p></div>
              <div><span>Underwriting</span><strong>{fmtM(FY25.cir, 1)} p.a. modelled</strong><p>Illustrative assumption held flat through 2030. Eligibility, eligible spend, tax-review exposure and reimbursement timing remain to be confirmed.</p></div>
            </div>
          </div>
        </div>
        <div className="debt-like-panel" id="debt-like">
          <div className="sec-head compact"><div className="left"><div className="section-kicker">Equity cheque perimeter</div><h3>Strict net debt is the modelled bridge; debt-like remains an SPA question</h3></div><div className="right">These items are excluded from modelled net debt unless confirmed through diligence.</div></div>
          <div className="debt-like-layout">
            <div className="strict-debt-bridge">
              <div><span>Gross financial debt</span><strong>{fmtM(NET_DEBT.grossFinancialDebt, 3)}</strong></div>
              <div><span>Less cash</span><strong>−{fmtM(NET_DEBT.cash, 3)}</strong></div>
              <div><span>Less marketable securities</span><strong>−{fmtM(NET_DEBT.marketableSecurities, 3)}</strong></div>
              <div className="total"><span>Net debt · strict</span><strong>{fmtM(NET_DEBT.strict, 3)}</strong></div>
            </div>
            <div className="debt-like-register">
              <div><span>Earn-outs disclosed</span><strong>~{fmtM(NET_DEBT.earnOuts, 1)}</strong><p>Amalto and CreditPoint. Confirm settlement status and SPA classification.</p></div>
              <div><span>ezyCollect acquisition balance</span><strong>~{fmtM(NET_DEBT.ezyCollectBalance, 1)}</strong><p>Confirm deferred consideration, completion accounts and payment timetable.</p></div>
              <div><span>Deferred revenue</span><strong>~{fmtM(NET_DEBT.deferredRevenueApprox, 0)}</strong><p>Not financial debt by default. Assess delivery obligations and interaction with the normal working-capital peg.</p></div>
              <div><span>Operating leases</span><strong>Not modelled</strong><p>Not capitalised and described as immaterial in Note 25; verify completeness and change-of-control effects.</p></div>
            </div>
          </div>
          <p className="ts-interpretation"><strong>Transaction convention.</strong> Enterprise value converts to equity value using {fmtM(NET_DEBT.strict, 3)} strict net debt only. Any adjustment for the excluded items requires evidence, non-duplication with working capital and explicit SPA treatment.</p>
        </div>
        <div className="qoe-flags"><strong>Underwrite before signing</strong><span>CIR eligibility and reimbursement timing</span><span>ezyCollect / SHS Viveon pro forma integration</span><span>Normalised tax and working-capital evidence</span></div>
        <p className="qoe-source">Source: {QOE.source.label} ({QOE.source.status}) and {SOURCES.workbook.label} ({SOURCES.workbook.status}). Adjusted figures are estimates; figures shown in €m unless stated otherwise.</p>
      </section>

      <section className="block" id="market">
        <div className="sec-head"><div className="left"><div className="num-tag">03 — Market sanity check</div><h2>Theoretical valuation vs current listed price</h2></div><div className="right">Quoted-price comparisons use the dated market reference shown below.</div></div>
        <div className="market-card">
          <div className="meta-row"><span className="placeholder-flag">As of {VALUATION_DATES.marketMedium}</span><span>{SOURCES.market.status}</span></div>
          <div className="grid">
            <div className="cell"><div className="k">Current share price</div><div className="v">€{VALUATION_CONTEXT.sharePriceRef.toFixed(2)}</div></div>
            <div className="cell"><div className="k">Market cap</div><div className="v">{fmtM(VALUATION_CONTEXT.marketCap)}</div></div>
            <div className="cell"><div className="k">Implied EV</div><div className="v">{fmtM(VALUATION_CONTEXT.marketEv)}</div></div>
            <div className="cell"><div className="k">Upside to fair value ({fmtM(VALUATION_CONTEXT.fairValueEv)} EV, DCF)</div><div className="v upside">+{(VALUATION_CONTEXT.fairValueEquityUpside * 100).toFixed(0)}%</div></div>
            <div className="cell"><div className="k">Upside to control case ({fmtM(VALUATION_CONTEXT.controlEv)} EV)</div><div className="v upside">+{(VALUATION_CONTEXT.controlEquityUpside * 100).toFixed(0)}%</div></div>
          </div>
          <p className="note">The dotted vertical line on the football field below mirrors the current market reference. Market reference filled as of {VALUATION_DATES.marketMedium}: €{VALUATION_CONTEXT.sharePriceRef.toFixed(2)}/share × {(FY25.dilutedShares / 1_000_000).toFixed(3)}m diluted shares + {fmtM(NET_DEBT.strict, 1)} strict net debt ≈ {fmtM(VALUATION_CONTEXT.marketEv)} EV.</p>
        </div>
      </section>

      <section className="block" id="dcf">
        <div className="sec-head"><div className="left"><div className="num-tag">04 — DCF · Bear / Base / Bull</div><h2>Switch the scenario to recompose the model live</h2></div><div className="right">Assumptions, end-state and narrative all update in step. The football field DCF bar follows. <strong>{SOURCES.engine.status}</strong>.</div></div>
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
              <thead><tr><th scope="col">Metric</th><th className="num" scope="col">Bear</th><th className="num" scope="col">Base</th><th className="num" scope="col">Bull</th></tr></thead>
              <tbody>
                <tr><th className="label" scope="row">Revenue 2030</th><td className="num">{fmtM(scenarioResults.bear.rev, 1)}</td><td className="num strong">{fmtM(scenarioResults.base.rev, 1)}</td><td className="num">{fmtM(scenarioResults.bull.rev, 1)}</td></tr>
                <tr><th className="label" scope="row">EBITDA 2030</th><td className="num">{fmtM(scenarioResults.bear.ebitda, 1)}</td><td className="num strong">{fmtM(scenarioResults.base.ebitda, 1)}</td><td className="num">{fmtM(scenarioResults.bull.ebitda, 1)}</td></tr>
                <tr><th className="label" scope="row">FCF 2030</th><td className="num">{fmtM(scenarioResults.bear.fcf, 1)}</td><td className="num strong">{fmtM(scenarioResults.base.fcf, 1)}</td><td className="num">{fmtM(scenarioResults.bull.fcf, 1)}</td></tr>
                <tr className="total"><th scope="row">EV implicit</th><td className="num">{fmtM(scenarioResults.bear.ev)}</td><td className="num">{fmtM(scenarioResults.base.ev)}</td><td className="num">{fmtM(scenarioResults.bull.ev)}</td></tr>
                <tr><th className="label" scope="row">EV / FY25 Sales</th><td className="num">{scenarioResults.bear.evSales.toFixed(1)}x</td><td className="num strong">{scenarioResults.base.evSales.toFixed(1)}x</td><td className="num">{scenarioResults.bull.evSales.toFixed(1)}x</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <SensitivityHeatmap activeScenario={activeScenario} />
        <details className="method" id="methodology">
          <summary>Methodology</summary>
          <div className="body">
            <p><strong>Starting point.</strong> EBITDA 2025 incl. CIR = {fmtM(FY25.ebitda, 1)}, consistent with Sidetrade's reporting convention. CIR recurrence is an illustrative assumption; eligibility, amount and timing remain subject to tax review.</p>
            <p><strong>Core formula.</strong></p>
            <pre>{`EBIT = EBITDA − D&A
FCF  = EBIT × (1 − tax) + D&A − Capex − ΔWC`}</pre>
            <ol>
              <li><strong>Economic vs accounting D&amp;A.</strong> Statutory shows ~€3.6m "amortization, depreciation and provisions", including receivables and operational provisions. Pure economic D&amp;A is ~€1.1m. The model uses 2% of revenue as an illustrative economic proxy, distinct from the 5.9% accounting figure.</li>
              <li><strong>Normalised tax rate.</strong> 2025 P&amp;L shows a €2.15m net tax credit including CIR effects. Scenario assumptions are 25% Bear, 22% Base and 20% Bull.</li>
              <li><strong>WACC.</strong> The workbook bridges a 9.7% Base WACC and retains 9.5%; scenario bounds are 10.5% Bear and 8.5% Bull.</li>
              <li><strong>Terminal growth.</strong> 2.0%–3.0%, capped at 3% in Bull.</li>
              <li><strong>Q1 2026 actuals.</strong> Published growth of +17% reported / +21% constant currency total and +27% constant currency subscriptions is consistent with, but does not prove, the Base 2026 growth assumption.</li>
            </ol>
          </div>
        </details>
      </section>

      <section className="block" id="trading">
        <div className="sec-head"><div className="left"><div className="num-tag">05 — Trading comps</div><h2>Market value, stand-alone</h2></div><div className="right">Listed B2B SaaS with comparable subscription mix, double-digit EBITDA margins, and CFO-office exposure. Hover any row for rationale.</div></div>
        <table className="data">
          <thead><tr><th>Peer</th><th>Why comparable</th><th className="num">EV / Sales (indicative)</th><th>Geo</th></tr></thead>
          <tbody>
            <tr><td><Tip k="Central benchmark" body="French listed O2C/P2P SaaS, exact same sector and geography. Pre-Bridgepoint take-private trading multiple. Best read-through to Sidetrade's standalone listed multiple." v="FY+1 EV/Sales ~5.5–6.0x"><strong>Esker</strong> <span className="star">★</span></Tip></td><td>O2C/P2P · French SaaS · pre-buyout reference</td><td className="num">~5.5–6.0x</td><td>FR</td></tr>
            <tr><td><Tip k="Finance automation" body="Closer to accounting workflow than O2C, but directly Office-of-CFO. Used as a mid-range anchor for SaaS premium multiples on a mature profile." v={`FY+1 EV/Sales ~2.4x (${VALUATION_DATES.marketMedium})`}><strong>BlackLine</strong></Tip></td><td>Finance automation · accounting workflow</td><td className="num">~2.4x</td><td>US</td></tr>
            <tr><td><Tip k="AP/AR + payments" body="Adjacent O2C in the SME US market — useful low-end anchor for AR automation multiples." v={`FY+1 EV/Sales ~2.4x, ~2.6x core (${VALUATION_DATES.marketMedium})`}><strong>BILL</strong></Tip></td><td>AP/AR automation + payments</td><td className="num">~2.4x</td><td>US</td></tr>
            <tr><td><Tip k="Vertical SaaS" body="Vertical banking SaaS — profitable, sticky, multi-year contracts. Adds vertical-SaaS premium reference." v={`FY+1 EV/Sales ~3.2x (${VALUATION_DATES.marketMedium})`}><strong>nCino</strong></Tip></td><td>Vertical SaaS banking</td><td className="num">~3.2x</td><td>US</td></tr>
            <tr><td><Tip k="B2B finance SaaS" body="Digital banking SaaS — comparable subscription mix and growth band." v="FY+1 EV/Sales ~3.0–3.5x"><strong>Q2 Holdings</strong></Tip></td><td>Digital banking SaaS</td><td className="num">~3.0–3.5x</td><td>US</td></tr>
            <tr><td><Tip k="Profitable B2B network" body='Network SaaS, vertical-led, profitable. Useful for the "profitable SaaS at scale" multiple anchor.' v="FY+1 EV/Sales ~2.0–2.5x"><strong>SPS Commerce</strong></Tip></td><td>B2B network · profitable SaaS</td><td className="num">~2.0–2.5x</td><td>US</td></tr>
            <tr><td><Tip k="CFO adjacency" body="Reporting / compliance SaaS — Office-of-CFO adjacency, not direct O2C." v={`FY+1 EV/Sales ~2.8x (${VALUATION_DATES.marketMedium})`}><strong>Workiva</strong></Tip></td><td>Reporting / compliance SaaS</td><td className="num">~2.8x</td><td>US</td></tr>
          </tbody>
        </table>
        <cite>Ranges as of {VALUATION_DATES.marketLong} (prices {VALUATION_DATES.marketIso}, May-2026 guidances, EUR/USD 1.1424) · {SOURCES.market.status}. BlackLine / BILL / nCino / Workiva refreshed; Esker is the pre-buyout historical reference; Q2 Holdings and SPS Commerce indicative (H1-2025, not refreshed). Multiples are forward FY+1. EV/EBITDA tiers marked * use non-GAAP operating income as proxy (not a true EBITDA).</cite>
        <div className="twoup" style={{ marginTop: 32 }}>
          <div><h3>Retained multiples for Sidetrade</h3><table className="data" style={{ marginTop: 10 }}><thead><tr><th>Tier</th><th className="num">EV / Sales</th><th className="num">EV / EBITDA</th></tr></thead><tbody><tr><td className="label">Low — min of refreshed peers</td><td className="num">2.4x</td><td className="num">10.0x*</td></tr><tr><td className="label">Base — median of refreshed peers</td><td className="num strong">2.6x</td><td className="num strong">12.6x*</td></tr><tr><td className="label">High — max of refreshed peers</td><td className="num">3.2x</td><td className="num">17.2x*</td></tr></tbody></table></div>
          <div><h3>Range implied — stand-alone</h3><div className="result-strip three" style={{ marginTop: 10 }}><div className="cell"><div className="k">Low</div><div className="v">{fmtM(VALUATION_CONTEXT.tradingRange.low)}</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">Base</div><div className="v accent">{fmtM(VALUATION_CONTEXT.tradingRange.base)}</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">High</div><div className="v">{fmtM(VALUATION_CONTEXT.tradingRange.high)}</div><div className="d">EV implicit</div></div></div><p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>The refreshed peer range sits below both the DCF (<strong style={{ color: "var(--bordeaux)" }}>~{fmtM(VALUATION_CONTEXT.fairValueEv)} EV</strong>) and Sidetrade’s own market EV (~{fmtM(VALUATION_CONTEXT.marketEv)} at €{VALUATION_CONTEXT.sharePriceRef.toFixed(0)}/share, {VALUATION_DATES.marketMedium}): derated US peers act as a sentiment floor. The gap is an assumed premium debate — organic growth, profitability, FR small-cap scarcity — not a convergence.</p></div>
        </div>
        <details className="method"><summary>Methodology</summary><div className="body"><p><strong>Logic.</strong> Sidetrade is compared with listed European and North-American B2B SaaS companies sharing subscription, profitability, growth and Office-of-CFO characteristics.</p><p><strong>Limitations.</strong> Sidetrade's size and liquidity may warrant a discount to larger listed peers. Forward FY+1 multiples reflect the market window dated {VALUATION_DATES.marketLong}.</p></div></details>
      </section>

      <section className="block" id="transaction">
        <div className="sec-head"><div className="left"><div className="num-tag">06 — Transaction comps</div><h2>Control value · what buyers paid</h2></div><div className="right">LTM multiples for the five Office-of-CFO / O2C precedents retained in the workbook.</div></div>
        <table className="data">
          <thead><tr><th>Target</th><th>Buyer</th><th>Date</th><th className="num">EV / Sales LTM</th><th className="num">EV / EBITDA LTM</th></tr></thead>
          <tbody>
            {TRANSACTION_COMPS.rows.map((comp) => (
              <tr key={comp.target}><td className="label">{comp.target}</td><td>{comp.buyer}</td><td>{comp.year}</td><td className="num">{comp.evSales.toFixed(1)}x</td><td className="num">{comp.evEbitda === null ? "n.m." : `${comp.evEbitda.toFixed(1)}x`}</td></tr>
            ))}
          </tbody>
        </table>
        <cite>Source: {SOURCES.workbook.label}, Transaction_comps · LTM financials · {SOURCES.workbook.status}.</cite>
        <div className="twoup" style={{ marginTop: 24 }}>
          <div><h3>Sidetrade's M&amp;A references</h3><p style={{ fontSize: 13.5 }}><strong>ezyCollect (Oct 2025) ·</strong> Total consideration €37.6m. Revenue contributed since 1 Oct 2025 implies an annualised run-rate near €9m and an indicative ~4.2x revenue multiple. The smaller APAC/SME perimeter limits direct comparability.</p><p style={{ fontSize: 13.5 }}><strong>SHS Viveon (2024) ·</strong> The delisting context and incomplete public valuation bridge make this a qualitative reference only.</p></div>
          <div><h3>Selected range · FY25 revenue basis</h3><p style={{ fontSize: 12, color: "var(--ink-3)" }}>The workbook applies 4.7x / 6.7x / 8.9x to FY25 revenue of {fmtM(FY25.reportedRevenue, 3)}. EV/EBITDA is not used for the selected range because Esker EBITDA is unavailable and Coupa was near breakeven at the transaction date.</p><table className="data" style={{ marginTop: 8 }}><thead><tr><th>Tier</th><th className="num">EV / Sales</th><th className="num">EV impl.</th></tr></thead><tbody><tr><td className="label">Low</td><td className="num">{TRANSACTION_COMPS.selectedMultiples.low.toFixed(1)}x</td><td className="num">{fmtM(VALUATION_CONTEXT.transactionRange.low)}</td></tr><tr><td className="label">Base</td><td className="num strong">{TRANSACTION_COMPS.selectedMultiples.base.toFixed(1)}x</td><td className="num strong">{fmtM(VALUATION_CONTEXT.transactionRange.base)}</td></tr><tr><td className="label">High</td><td className="num">{TRANSACTION_COMPS.selectedMultiples.high.toFixed(1)}x</td><td className="num">{fmtM(VALUATION_CONTEXT.transactionRange.high)}</td></tr></tbody></table></div>
        </div>
        <div className="result-strip three" style={{ marginTop: 18 }}><div className="cell"><div className="k">Low</div><div className="v">{fmtM(VALUATION_CONTEXT.transactionRange.low)}</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">Base · control</div><div className="v accent">{fmtM(VALUATION_CONTEXT.transactionRange.base)}</div><div className="d">EV implicit</div></div><div className="cell"><div className="k">High</div><div className="v">{fmtM(VALUATION_CONTEXT.transactionRange.high)}</div><div className="d">EV implicit</div></div></div>
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 12 }}>Deliberately above trading comps — these embed control premium (~20–40%), strategic scarcity and synergy potential. Read as <strong>M&amp;A value</strong>, not stand-alone.</p>
        <details className="method"><summary>Methodology</summary><div className="body"><p><strong>Logic.</strong> Precedent transactions describe control value and may include strategic premiums or synergies; they are not directly comparable with stand-alone trading value.</p><p><strong>Source.</strong> The five LTM precedents and the selected FY25 revenue multiples reproduce the current Transaction_comps workbook convention.</p></div></details>
      </section>

      <section className="block" id="lbo">
        <div className="sec-head"><div className="left"><div className="num-tag">07 — LBO</div><h2>Sponsor affordability · what a PE could pay for a 20–25% IRR</h2></div><div className="right">Not a fundamental fair value — an affordability test that frames the sponsor pricing logic.</div></div>
        <div className="twoup"><div><h3>Base case assumptions</h3><table className="data" style={{ marginTop: 10 }}><tbody><tr><td className="label">Entry EV (Base affordability)</td><td className="num strong">{fmtM(LBO_REFERENCE.entryEv, 1)}</td></tr><tr><td className="label">EBITDA 2025</td><td className="num">{fmtM(FY25.ebitda, 1)}</td></tr><tr><td className="label">Acquisition debt (4.0x EBITDA)</td><td className="num">~{fmtM(LBO_REFERENCE.acquisitionDebt, 1)}</td></tr><tr><td className="label">Sponsor equity</td><td className="num">~{fmtM(LBO_REFERENCE.sponsorEquity, 0)} (after ~{fmtM(LBO_REFERENCE.founderRollover, 0)} founder rollover)</td></tr><tr><td className="label">Holding period</td><td className="num">{LBO_REFERENCE.holdingPeriodYears} years</td></tr><tr><td className="label">Interest rate</td><td className="num">~{fmtPct(LBO_REFERENCE.interestRate)} all-in (E3M + 479bps)</td></tr><tr><td className="label">Cash sweep</td><td className="num">{fmtPct(LBO_REFERENCE.cashSweep, 0)} of excess FCF + 1% mandatory amort.</td></tr><tr><td className="label">Exit EBITDA 2030 (Base)</td><td className="num">{fmtM(LBO_REFERENCE.exitEbitda2030, 1)}</td></tr><tr><td className="label">Exit multiple (Base)</td><td className="num">{LBO_REFERENCE.exitMultiple.toFixed(1)}x EBITDA</td></tr><tr className="total"><td>Target IRR (Base)</td><td className="num">~{fmtPct(LBO_REFERENCE.baseIrr)}</td></tr></tbody></table><p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 12 }}><strong>Leverage convention.</strong> The 4.0x assumption reflects an illustrative acquisition financing package in which existing debt is refinanced; it is distinct from the current balance-sheet covenant.</p></div><div><h3>Range</h3><div className="result-strip three" style={{ marginTop: 10 }}><div className="cell"><div className="k">Low</div><div className="v">{fmtM(VALUATION_CONTEXT.lboRange.low, 1)}</div><div className="d">IRR target {fmtPct(VALUATION_CONTEXT.lboIrr.low, 0)}</div></div><div className="cell"><div className="k">Base</div><div className="v accent">{fmtM(VALUATION_CONTEXT.lboRange.base, 1)}</div><div className="d">IRR target {fmtPct(VALUATION_CONTEXT.lboIrr.base)}</div></div><div className="cell"><div className="k">High</div><div className="v">{fmtM(VALUATION_CONTEXT.lboRange.high, 1)}</div><div className="d">IRR target {fmtPct(VALUATION_CONTEXT.lboIrr.high, 0)}</div></div></div><p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>The range reflects sponsor IRR hurdles of {fmtPct(VALUATION_CONTEXT.lboIrr.low, 0)} to {fmtPct(VALUATION_CONTEXT.lboIrr.high, 0)} at a fixed {LBO_REFERENCE.exitMultiple.toFixed(0)}x exit multiple. Base affordability is ~{fmtM(VALUATION_CONTEXT.lboRange.base)} versus the {fmtM(VALUATION_CONTEXT.fairValueEv)} DCF reference. <strong>{SOURCES.engine.status}</strong> · sponsor affordability, not fundamental fair value.</p></div></div>
        <details className="method"><summary>Methodology</summary><div className="body"><p>Entry EV is solved from target sponsor IRR, holding period, leverage, interest, exit EBITDA and exit multiple. The result is most sensitive to the IRR hurdle and exit multiple.</p><p className="src">Exit sensitivity range: {fmtM(waccExit.flat()[0])} to {fmtM(waccExit.flat().at(-1))}.</p></div></details>
      </section>

      <section className="block" id="football">
        <div className="sec-head"><div className="left"><div className="num-tag">08 — Football field</div><h2>Four methods, one view</h2></div><div className="right">Scroll back up to switch DCF scenario — the DCF bar below recomposes live.</div></div>
        <FootballField activeScenario={activeScenario} scenarioResults={scenarioResults} />
        <div className="grid-3" style={{ marginTop: 24 }}>
          <div className="card" style={{ borderTop: "3px solid var(--bordeaux)" }}><div className="mono-k" style={{ color: "var(--bordeaux)" }}>Stand-alone fair value</div><div className="big-card-value">{fmtM(VALUATION_CONTEXT.fairValueEv)} EV</div><p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>DCF Gordon Growth central value — ~{((VALUATION_CONTEXT.fairValueEv / VALUATION_CONTEXT.marketEv - 1) * 100).toFixed(0)}% above the quoted market EV (~{fmtM(VALUATION_CONTEXT.marketEv)} at €{VALUATION_CONTEXT.sharePriceRef.toFixed(0)}/share, {VALUATION_DATES.marketMedium}). The reference number.</p></div>
          <div className="card" style={{ borderTop: "3px solid var(--bull)" }}><div className="mono-k" style={{ color: "var(--bull)" }}>Control case</div><div className="big-card-value">{fmtM(VALUATION_CONTEXT.controlEv)} EV</div><p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>Convergence with transaction precedents. ~40% control premium embedded.</p></div>
          <div className="card" style={{ borderTop: "3px solid var(--market)" }}><div className="mono-k" style={{ color: "var(--market)" }}>Implied share price · Base</div><div className="big-card-value">~€{equityBridge("base").sharePrice.toFixed(0)}</div><p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>({fmtM(VALUATION_CONTEXT.fairValueEv)} − {fmtM(NET_DEBT.strict, 1)} net debt) / {(FY25.dilutedShares / 1_000_000).toFixed(3)}m diluted shares = ~€{equityBridge("base").sharePrice.toFixed(0)} / share.</p></div>
        </div>
        <div className="equity-bridge-section" id="equity-bridge"><div className="section-kicker">EV → Equity → Share price</div><h3>From enterprise value to the shareholder outcome</h3><WaterfallBridge activeScenario={activeScenario} /><p><strong>Stand-alone range:</strong> {fmtM(VALUATION_CONTEXT.tradingRange.low)} – {fmtM(scenarioResults.bull.ev)} EV → ~€{((VALUATION_CONTEXT.tradingRange.low - NET_DEBT.strict) * 1_000_000 / FY25.dilutedShares).toFixed(0)}–€{equityBridge("bull").sharePrice.toFixed(0)} / share. <br /><strong>Extended range (incl. M&amp;A / LBO):</strong> {fmtM(VALUATION_CONTEXT.tradingRange.low)} – {fmtM(VALUATION_CONTEXT.transactionRange.high)} EV → ~€{((VALUATION_CONTEXT.tradingRange.low - NET_DEBT.strict) * 1_000_000 / FY25.dilutedShares).toFixed(0)}–€{((VALUATION_CONTEXT.transactionRange.high - NET_DEBT.strict) * 1_000_000 / FY25.dilutedShares).toFixed(0)} / share.</p></div>
        <div className="conclusion-panel" id="conclusions"><div className="mono-k">Valuation synthesis</div><h3>Recurring revenue supports the stand-alone case; control value remains conditional.</h3><div className="conclusion-grid"><p>Published metrics show a profitable O2C SaaS profile, 87% subscription mix and 92% subscription gross margin; the 30–35% 2030 EBITDA margin is a company target, not an achieved result.</p><p>The Base DCF indicates <strong>~{fmtM(VALUATION_CONTEXT.fairValueEv)} EV</strong>, around <strong>€{equityBridge("base").sharePrice.toFixed(0)} per share</strong>, subject to the stated operating and discount-rate assumptions.</p><p>Workbook transaction comps indicate a <strong>~{fmtM(VALUATION_CONTEXT.controlEv)} EV</strong> control case, subject to comparability, CIR diligence and integration delivery.</p></div></div>
      </section>

      <section className="block" id="red-flags">
        <span className="anchor-alias" id="caveats" aria-hidden="true" />
        <div className="sec-head"><div className="left"><div className="num-tag">09 — Red flags &amp; limits</div><h2>Open diligence points and model limits</h2></div><div className="right">Public information does not resolve the items below.</div></div>
        <div className="ts-deal-grid">
          <div className="ts-panel"><div className="section-kicker">Transaction implications</div><h3>Where QoE changes the deal discussion</h3><ul className="ts-list"><li><strong>Price multiple.</strong> Published, ex-CIR and estimated adjusted EBITDA require separate valuation multiples; {fmtM(QOE.adjustedEbitdaExCir, 1)} and {fmtM(QOE.adjustedEbitdaInclCir, 1)} are estimated, not statutory measures.</li><li><strong>Working capital.</strong> The peg depends on separating the CIR reimbursement cycle from ordinary receivables and contract liabilities.</li><li><strong>Equity cheque.</strong> Strict net debt requires completion-account reconciliation; earn-outs, acquisition balances and restricted cash remain open classifications.</li><li><strong>Protections.</strong> Tax/CIR, leakage and acquisition-liability protections depend on evidence not available publicly.</li></ul></div>
          <div className="ts-panel" id="diligence"><div className="section-kicker">Priority diligence requests</div><h3>Evidence required before signing</h3><ol className="diligence-list"><li><strong>CIR file.</strong> Claims by vintage, eligible-cost bridge, tax opinions, audits, correspondence and reimbursement calendar.</li><li><strong>Cash conversion.</strong> Monthly OCF-to-FCF bridge, working-capital ageing, capex ledger and reconciliation of management’s {fmtM(CASH_CONVERSION.managementOcfExCirTiming, 1)} KPI.</li><li><strong>Debt and cash.</strong> Bank statements, facilities, accrued interest, covenants, guarantees, restricted cash and marketable-security liquidity.</li><li><strong>Acquisition liabilities.</strong> ezyCollect, Amalto and CreditPoint SPAs, earn-outs, deferred consideration and completion-account settlements.</li><li><strong>Revenue quality.</strong> ARR/NRR by cohort, churn, concessions, deferred revenue, top contracts and post-close delivery obligations.</li><li><strong>Integration.</strong> Stand-alone and pro-forma P&amp;Ls for ezyCollect/SHS Viveon, synergies, PPA status and one-off costs.</li></ol></div>
          <div className="ts-panel" id="conventions"><div className="section-kicker">Data status</div><h3>How to read the numbers</h3><dl className="convention-list"><div><dt>{SOURCE_STATUS.PUBLISHED}</dt><dd>Reported or reconstructed from public disclosures.</dd></div><div><dt>{SOURCE_STATUS.CALCULATED}</dt><dd>Derived from stated inputs and formulas.</dd></div><div><dt>{SOURCE_STATUS.ILLUSTRATIVE_ASSUMPTION}</dt><dd>A scenario input rather than a reported fact.</dd></div><div><dt>{SOURCE_STATUS.ESTIMATED}</dt><dd>An analytical estimate requiring supporting evidence.</dd></div><div><dt>{SOURCE_STATUS.TO_BE_CONFIRMED}</dt><dd>An open item for diligence.</dd></div><div><dt>{SOURCE_STATUS.MARKET_AS_OF}</dt><dd>Dated price and market-multiple reference.</dd></div></dl><p className="ts-interpretation">€m unless stated. FY25 actuals are at {VALUATION_DATES.fy25Cutoff}. Strict net debt is gross financial debt less cash and marketable securities; debt-like items remain outside the bridge unless confirmed.</p></div>
        </div>
        <div className="caveats"><div><h3>Methodological</h3><ul><li>The analysis uses FY25 statutory information, company releases and dated public market data.</li><li>Trading multiples reflect the market window at {VALUATION_DATES.marketLong}.</li><li>CIR is included in modelled EBITDA but remains subject to eligibility, tax-review and reimbursement-timing risk.</li><li>The Base case assumes partial ezyCollect / SHS Viveon integration through 2026–2028.</li><li>Transaction comps include control value and are not directly comparable with stand-alone fair value.</li><li>LBO outputs are affordability results rather than fundamental fair value.</li><li>D&amp;A at 2.0% of revenue is an illustrative economic proxy, distinct from French accounting D&amp;A and provisions.</li><li>Treasury shares are excluded from the equity bridge; treatment depends on legal ownership, intended use and spot value.</li></ul></div><div><h3>Accounting specifics</h3><ul><li><strong>Gross margin reconstruction.</strong> The 77% / 81% LFL / 92% subscription figures come from company communication and cannot be fully reconstructed from an expenses-by-nature statutory P&amp;L.</li><li><strong>ezyCollect PPA pending.</strong> Allocation remains open until 31 Dec 2026. Reclassification from goodwill to customer relationships could increase amortisation and affect EBIT while remaining EBITDA-neutral.</li><li><strong>Headcount discrepancy.</strong> 406 employees per statutory accounts at 31 Dec 2025 versus ~450 in company communication; payroll, contractors, perimeter and cut-off remain to be reconciled.</li></ul></div></div>
      </section>

      <section className="block" id="sources">
        <div className="sec-head"><div className="left"><div className="num-tag">Reference</div><h2>Sources</h2></div><div className="right">Workbook and original public-source downloads.</div></div>
        <div className="grid-3">
          <a className="card source-card" download={SOURCES.workbook.file} href={SOURCES.workbook.href}><h3>{SOURCES.workbook.label}</h3><p>Valuation model · XLSX download<br />{SOURCES.workbook.status}</p></a>
          <a className="card source-card" href={SOURCES.annualResults.href} target="_blank" rel="noopener"><h3>{SOURCES.annualResults.label}</h3><p>Press release · {SOURCES.annualResults.date}<br />{SOURCES.annualResults.status}</p></a>
          <a className="card source-card" href={SOURCES.statutoryReport.href} target="_blank" rel="noopener"><h3>{SOURCES.statutoryReport.label}</h3><p>KPMG / Yuma Audit · {SOURCES.statutoryReport.date}<br />{SOURCES.statutoryReport.status}</p></a>
          <a className="card source-card" href={SOURCES.strategicPlan.href} target="_blank" rel="noopener"><h3>{SOURCES.strategicPlan.label}</h3><p>Strategic Plan · {SOURCES.strategicPlan.date}<br />{SOURCES.strategicPlan.status}</p></a>
        </div>
      </section>

      <footer className="site">
        <div className="inner"><div><h4>Author</h4><div className="name">Hamza Ben Chaouch</div><p>ESSEC Grande École · Finance &amp; Analytics<br /><a href="mailto:hamza.benchaouch@essec.edu">hamza.benchaouch@essec.edu</a><br /><a href="tel:+33769913946">+33 7 69 91 39 46</a></p></div><div><h4>Sources</h4><p>{SOURCES.annualResults.label} ({SOURCES.annualResults.shortDate}) · {SOURCES.statutoryReport.label} (KPMG / Yuma Audit, {SOURCES.statutoryReport.shortDate}) · {SOURCES.strategicPlan.label} ({SOURCES.strategicPlan.shortDate}) · {SOURCES.workbook.label}.</p></div><div><h4>Market reference</h4><p>{SOURCES.market.status}</p></div></div>
      </footer>
    </article></Localized>
  );
}
