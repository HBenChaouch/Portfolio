import { buildTrajectory, sensitivityWaccG } from "./dcfEngine.js";

export function fmtMoney(value, decimals = 0) {
  return `EUR${value.toFixed(decimals)}m`;
}

export function fmtPercent(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function scenarioSeries(scenarioId) {
  const trajectory = buildTrajectory(scenarioId);

  return {
    revenue: trajectory.map((year) => year.revenue),
    ebitda: trajectory.map((year) => year.ebitda),
    margin: trajectory.map((year) => year.ebitdaMargin),
    years: trajectory.map((year) => year.year),
  };
}

export function dcfEvFromInputs(scenarioId, wacc, terminalGrowth) {
  return sensitivityWaccG(scenarioId, [wacc], [terminalGrowth])[0][0];
}

export function pctInRange(value, min = 100, max = 600) {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}
