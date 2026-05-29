import { pctInRange } from "../utils/finance.js";
import { FY25, VALUATION_CONTEXT, enterpriseValue } from "../utils/dcfEngine.js";

export default function FootballField({ ranges, activeScenario }) {
  const fairValue = VALUATION_CONTEXT.tradingRange.base;
  const controlValue = VALUATION_CONTEXT.controlEv;
  const marketValue = (VALUATION_CONTEXT.sharePriceRef * FY25.dilutedShares) / 1000000 + FY25.netDebt;

  return (
    <div className="football-field">
      <div className="range-stack">
        <div className="reference fair" style={{ left: `${pctInRange(fairValue)}%` }}>
          <span>Fair €{fairValue.toFixed(0)}m</span>
        </div>
        <div className="reference control" style={{ left: `${pctInRange(controlValue)}%` }}>
          <span>Control €{controlValue.toFixed(0)}m</span>
        </div>
        <div className="reference market" style={{ left: `${pctInRange(marketValue)}%` }}>
          <span>Market ref. €{marketValue.toFixed(0)}m</span>
        </div>
        {ranges.map((range) => {
          const left = pctInRange(range.low);
          const right = pctInRange(range.high);
          const base = pctInRange(range.base);
          const tone = range.method === "DCF" ? activeScenario : "base";

          return (
            <div className="range-row" data-tone={tone} key={range.method}>
              <div className="range-label">
                <strong>{range.method}</strong>
                <span>{range.subtitle}</span>
              </div>
              <div className="range-track">
                <div className="range-bar" style={{ left: `${left}%`, width: `${right - left}%` }} />
                <div className="range-tick" style={{ left: `${base}%` }} />
                <span className="range-end left" style={{ left: `${left}%` }}>
                  €{range.low.toFixed(0)}m
                </span>
                <span className="range-end right" style={{ left: `${right}%` }}>
                  €{range.high.toFixed(0)}m
                </span>
              </div>
              <div className="range-value">€{range.base.toFixed(0)}m</div>
            </div>
          );
        })}
      </div>
      <div className="range-axis">
        {[100, 200, 300, 400, 500, 600].map((tick) => (
          <span key={tick} style={{ left: `${pctInRange(tick)}%` }}>
            €{tick}m
          </span>
        ))}
      </div>
    </div>
  );
}
