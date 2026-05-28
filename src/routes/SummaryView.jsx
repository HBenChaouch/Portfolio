import { motion } from "framer-motion";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import {
  FY25,
  SCENARIOS,
  VALUATION_CONTEXT,
  discountedCashflows,
  enterpriseValue,
  equityBridge,
  sensitivityWaccG,
  terminalValue,
} from "../utils/dcfEngine.js";

const waccs = [0.085, 0.09, 0.095, 0.1, 0.105];
const terminalGrowths = [0.035, 0.03, 0.025, 0.02, 0.015];

function money(value, decimals = 0) {
  return `€${value.toFixed(decimals)}m`;
}

function pct(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

function delta(value) {
  const formatted = `${Math.abs(value * 100).toFixed(1)}%`;
  return value < 0 ? `(${formatted})` : `+${formatted}`;
}

function cagr(start, end, years) {
  return Math.pow(end / start, 1 / years) - 1;
}

function KpiTile({ label, value }) {
  return (
    <div className="summary-kpi-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MiniEvTrajectory({ scenarioId }) {
  const pvFcfs = discountedCashflows(scenarioId);
  const scenario = SCENARIOS[scenarioId];
  const pvTerminal = terminalValue(scenarioId).gordon / Math.pow(1 + scenario.wacc, 5);
  const points = [
    { year: 2025, value: 0 },
    ...pvFcfs.map((item, index) => ({
      year: item.year,
      value: pvFcfs.slice(0, index + 1).reduce((sum, year) => sum + year.pv, 0),
    })),
  ];
  points[points.length - 1] = {
    year: 2030,
    value: points.at(-1).value + pvTerminal,
  };

  const width = 420;
  const height = 172;
  const pad = { left: 36, right: 54, top: 18, bottom: 28 };
  const max = Math.max(...points.map((point) => point.value)) * 1.08;
  const x = (index) => pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)} ${y(point.value)}`).join(" ");

  return (
    <div className="summary-panel mini-chart-panel">
      <div className="summary-panel-title">
        <span>EV trajectory</span>
        <small>PV running sum</small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 0.5, 1].map((tick) => (
          <line
            className="summary-grid-line"
            key={tick}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + tick * (height - pad.top - pad.bottom)}
            y2={pad.top + tick * (height - pad.top - pad.bottom)}
          />
        ))}
        <path className="summary-ev-line" d={path} />
        {points.map((point, index) => (
          <g key={point.year}>
            <circle className="summary-ev-point" cx={x(index)} cy={y(point.value)} r="3.8" />
            <text className="summary-axis-label" x={x(index)} y={height - 8} textAnchor="middle">
              {point.year}
            </text>
          </g>
        ))}
        <text className="summary-end-label" x={x(points.length - 1) + 8} y={y(points.at(-1).value) + 4}>
          {money(points.at(-1).value, 0)}
        </text>
      </svg>
    </div>
  );
}

function MiniSensitivity({ scenarioId }) {
  const scenario = SCENARIOS[scenarioId];
  const matrix = sensitivityWaccG(scenarioId, waccs, terminalGrowths);

  return (
    <div className="summary-panel mini-sensitivity-panel">
      <div className="summary-panel-title">
        <span>Sensitivity</span>
        <small>EV €m</small>
      </div>
      <table className="summary-sensitivity">
        <thead>
          <tr>
            <th />
            {waccs.map((wacc) => (
              <th key={wacc}>{pct(wacc, 1)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {terminalGrowths.map((g, rowIndex) => (
            <tr key={g}>
              <th>{pct(g, 1)}</th>
              {waccs.map((wacc, colIndex) => {
                const isCenter = Math.abs(wacc - scenario.wacc) < 0.0001 && Math.abs(g - scenario.g) < 0.0001;
                return (
                  <td className={isCenter ? "active" : ""} key={`${g}-${wacc}`}>
                    {matrix[rowIndex][colIndex].toFixed(0)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactFootballField({ scenarioId }) {
  const fairValue = enterpriseValue("base");
  const ranges = [
    { label: "DCF", low: enterpriseValue("bear"), base: enterpriseValue(scenarioId), high: enterpriseValue("bull") },
    { label: "Trading", ...VALUATION_CONTEXT.tradingRange },
    { label: "Transaction", ...VALUATION_CONTEXT.transactionRange },
    { label: "LBO", ...VALUATION_CONTEXT.lboRange },
  ];
  const min = 100;
  const max = 600;
  const pctX = (value) => Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="summary-football">
      <div className="summary-section-label">Valuation range (enterprise value)</div>
      <div className="summary-ff-stack">
        <div className="summary-ff-ref" style={{ left: `${pctX(fairValue)}%` }}>
          <span>{money(fairValue, 0)}</span>
        </div>
        {ranges.map((range) => (
          <div className="summary-ff-row" key={range.label}>
            <span>{range.label}</span>
            <div className="summary-ff-track">
              <motion.div
                animate={{ left: `${pctX(range.low)}%`, width: `${pctX(range.high) - pctX(range.low)}%` }}
                className={range.label === "DCF" ? "summary-ff-bar dcf" : "summary-ff-bar"}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
              <motion.i
                animate={{ left: `${pctX(range.base)}%` }}
                className="summary-ff-tick"
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </div>
            <strong>{money(range.base, 0)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomPanel({ title, children }) {
  return (
    <div className="summary-bottom-panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function MiniFinancialKpi({ label, value, yoy }) {
  return (
    <div className="summary-fin-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className="delta">{delta(yoy)}</small>
    </div>
  );
}

export default function SummaryView() {
  const { activeScenario, scenario } = useSidetradeScenario();
  const bridge = equityBridge(activeScenario);
  const current = SCENARIOS[activeScenario];
  const impliedEvEbitda = bridge.ev / FY25.ebitda;
  const revenueCagr = cagr(FY25.revenue, scenario.result.revenue2030, 5);
  const premiumDiscount = bridge.sharePrice / VALUATION_CONTEXT.sharePriceRef - 1;

  return (
    <section className="summary-view" aria-label="Valuation summary">
      <div className="summary-grid">
        <div className="summary-hero">
          <p className="summary-section-label">Indicative enterprise value</p>
          <h1>€{bridge.ev.toFixed(0)}m</h1>
          <p>Stand-alone · DCF + Comps + LBO convergence</p>
        </div>

        <div className="summary-top-right">
          <div className="summary-kpi-grid">
            <KpiTile label="Equity value" value={money(bridge.equity, 0)} />
            <KpiTile label="Net debt FY25E" value={money(bridge.netDebt, 0)} />
            <KpiTile label="Implied EV / EBITDA" value={`${impliedEvEbitda.toFixed(1)}x`} />
            <KpiTile label="WACC" value={pct(current.wacc, 1)} />
            <KpiTile label="Terminal growth" value={pct(current.g, 1)} />
          </div>
          <div className="summary-chart-grid">
            <MiniEvTrajectory scenarioId={activeScenario} />
            <MiniSensitivity scenarioId={activeScenario} />
          </div>
        </div>

        <CompactFootballField scenarioId={activeScenario} />

        <div className="summary-bottom-grid">
          <BottomPanel title="FY25 Financial Highlights">
            <div className="summary-fin-grid">
              <MiniFinancialKpi label="Revenue" value={money(FY25.revenue, 1)} yoy={FY25.yoy.revenue} />
              <MiniFinancialKpi label="EBITDA" value={money(FY25.ebitda, 1)} yoy={FY25.yoy.ebitda} />
              <MiniFinancialKpi label="EBIT" value={money(FY25.ebit, 1)} yoy={FY25.yoy.ebit} />
              <MiniFinancialKpi label="Net income" value={money(FY25.netIncome, 1)} yoy={FY25.yoy.netIncome} />
              <MiniFinancialKpi label="FCF" value={money(FY25.fcfNormalized, 1)} yoy={FY25.yoy.fcf} />
            </div>
          </BottomPanel>

          <BottomPanel title="Key Assumptions">
            <dl className="summary-dl">
              <div><dt>Revenue CAGR 25-30</dt><dd>{pct(revenueCagr, 1)}</dd></div>
              <div><dt>EBITDA margin 2030</dt><dd>{pct(current.ebitdaMargin2030, 1)}</dd></div>
              <div><dt>Capex (% sales)</dt><dd>{pct(current.capexPct, 1)}</dd></div>
            </dl>
          </BottomPanel>

          <BottomPanel title="Capital Structure">
            <dl className="summary-dl">
              <div><dt>Equity</dt><dd>{money(bridge.equity, 0)}</dd></div>
              <div><dt>Total debt</dt><dd>{money(FY25.totalDebt, 0)}</dd></div>
              <div><dt>Net debt / EBITDA</dt><dd>{(FY25.netDebt / FY25.ebitda).toFixed(1)}x</dd></div>
              <div><dt>Interest coverage</dt><dd>{VALUATION_CONTEXT.interestCoverage.toFixed(1)}x</dd></div>
            </dl>
          </BottomPanel>

          <BottomPanel title="Valuation Context">
            <dl className="summary-dl">
              <div><dt>Share price (ref.)</dt><dd>€{VALUATION_CONTEXT.sharePriceRef.toFixed(2)}</dd></div>
              <div><dt>Premium / (discount)</dt><dd className="delta">{delta(premiumDiscount)}</dd></div>
              <div><dt>Control premium</dt><dd>{pct(VALUATION_CONTEXT.controlPremium, 1)}</dd></div>
              <div><dt>Liquidity discount</dt><dd className="delta">{delta(VALUATION_CONTEXT.liquidityDiscount)}</dd></div>
            </dl>
          </BottomPanel>
        </div>
      </div>
      <p className="summary-note">Note: Valuation as of 09 May 2025. Figures may not sum due to rounding.</p>
    </section>
  );
}
