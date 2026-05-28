import { useMemo, useState } from "react";
import { scenarioSeries } from "../utils/finance.js";

const chart = { width: 800, height: 300, left: 58, right: 72, top: 28, bottom: 42, maxY: 140 };

function chartAxis() {
  const innerWidth = chart.width - chart.left - chart.right;
  const innerHeight = chart.height - chart.top - chart.bottom;

  return {
    x: (index) => chart.left + (index / 5) * innerWidth,
    y: (value) => chart.top + innerHeight - (value / chart.maxY) * innerHeight,
    baseline: chart.top + innerHeight,
    innerWidth,
    innerHeight,
  };
}

function pathFrom(values, axis) {
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${axis.x(index).toFixed(2)} ${axis.y(value).toFixed(2)}`)
    .join(" ");
}

function areaFrom(values, axis) {
  const line = pathFrom(values, axis);
  return `${line} L ${axis.x(values.length - 1).toFixed(2)} ${axis.baseline.toFixed(2)} L ${axis
    .x(0)
    .toFixed(2)} ${axis.baseline.toFixed(2)} Z`;
}

export default function TrajectoryChart({ scenarioId }) {
  const axis = chartAxis();
  const series = useMemo(() => scenarioSeries(scenarioId), [scenarioId]);
  const [hoverIndex, setHoverIndex] = useState(null);
  const hover = hoverIndex === null ? null : {
    year: series.years[hoverIndex],
    revenue: series.revenue[hoverIndex],
    ebitda: series.ebitda[hoverIndex],
    margin: series.margin[hoverIndex],
  };

  return (
    <div className="chart-panel">
      <div className="panel-head compact">
        <div>
          <p className="eyebrow">Trajectory</p>
          <h3>Revenue and EBITDA, 2025-2030</h3>
        </div>
        <div className="legend">
          <span><i className="swatch revenue" /> Revenue</span>
          <span><i className="swatch ebitda" /> EBITDA</span>
        </div>
      </div>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none">
          {[0, 35, 70, 105, 140].map((tick) => (
            <g key={tick}>
              <line className="grid-line" x1={chart.left} x2={chart.width - chart.right} y1={axis.y(tick)} y2={axis.y(tick)} />
              <text className="axis-text" x={chart.left - 10} y={axis.y(tick) + 4} textAnchor="end">
                EUR{tick}m
              </text>
            </g>
          ))}
          <line className="axis-line" x1={chart.left} x2={chart.width - chart.right} y1={axis.baseline} y2={axis.baseline} />
          {series.years.map((year, index) => (
            <text className="axis-text year" key={year} x={axis.x(index)} y={axis.baseline + 24} textAnchor="middle">
              {year}
            </text>
          ))}
          <path className="revenue-area" d={areaFrom(series.revenue, axis)} />
          <path className="revenue-line" d={pathFrom(series.revenue, axis)} />
          <path className="ebitda-line" d={pathFrom(series.ebitda, axis)} />
          {series.years.map((year, index) => (
            <g key={year}>
              <circle className="point revenue" cx={axis.x(index)} cy={axis.y(series.revenue[index])} r="4" />
              <circle className="point ebitda" cx={axis.x(index)} cy={axis.y(series.ebitda[index])} r="3.5" />
              <rect
                className="hit-zone"
                x={axis.x(index) - axis.innerWidth / 10}
                y={chart.top}
                width={axis.innerWidth / 5}
                height={axis.innerHeight}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          ))}
          <text className="end-label revenue" x={axis.x(5) + 8} y={axis.y(series.revenue[5]) + 4}>
            EUR{series.revenue[5].toFixed(0)}m
          </text>
          <text className="end-label ebitda" x={axis.x(5) + 8} y={axis.y(series.ebitda[5]) + 4}>
            EUR{series.ebitda[5].toFixed(0)}m
          </text>
        </svg>
        {hover ? (
          <div className="chart-tooltip">
            <strong>{hover.year}</strong>
            <span>Revenue: EUR{hover.revenue.toFixed(1)}m</span>
            <span>EBITDA: EUR{hover.ebitda.toFixed(1)}m</span>
            <span>Margin: {(hover.margin * 100).toFixed(0)}%</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
