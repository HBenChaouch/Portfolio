import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CASH_CONVERSION,
  DISPLAY_VALUES,
  FY25,
  LBO_REFERENCE,
  NET_DEBT,
  QOE,
  SCENARIOS,
  SOURCE_STATUS,
  SOURCES,
  TRANSACTION_COMPS,
  VALUATION_CONTEXT,
  VALUATION_DATES,
} from "../src/data/sidetradeFinancials.js";
import {
  crossCheckFcf,
  enterpriseValue,
  equityBridge,
  marginPathSensitivity,
  sensitivityWaccExit,
  sensitivityWaccG,
} from "../src/utils/dcfEngine.js";

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

close(CASH_CONVERSION.statutoryOcf - CASH_CONVERSION.capex, CASH_CONVERSION.statutoryFcf);
close(CASH_CONVERSION.statutoryFcf + CASH_CONVERSION.cirTimingNormalisation, CASH_CONVERSION.normalisedFcf);
close(NET_DEBT.grossFinancialDebt - NET_DEBT.cash - NET_DEBT.marketableSecurities, NET_DEBT.strict);
close(QOE.publishedEbitdaInclCir - QOE.cirReported, QOE.publishedEbitdaExCir);
close(QOE.publishedEbitdaExCir + QOE.adjustmentsEstimate, QOE.adjustedEbitdaExCir);
close(QOE.adjustedEbitdaExCir + QOE.cirReported, QOE.adjustedEbitdaInclCir);
close(VALUATION_CONTEXT.marketCap, 267.40146, 1e-6);
close(VALUATION_CONTEXT.marketEv, 282.05546, 1e-6);
close(
  VALUATION_CONTEXT.controlEquityUpside,
  (VALUATION_CONTEXT.controlEv - NET_DEBT.strict) / VALUATION_CONTEXT.marketCap - 1
);
assert.equal(Math.round(VALUATION_CONTEXT.controlEquityUpside * 100), 48);
assert.equal(VALUATION_CONTEXT.controlEv, 411);
assert.equal(DISPLAY_VALUES.grossFinancialDebt, 30.8);

const sentinels = {
  bear: { ev: 157.888142308419, equity: 143.234142308419, share: 93.203458057652 },
  base: { ev: 301.124575075829, equity: 286.470575075829, share: 186.408406532987 },
  bull: { ev: 496.995043871749, equity: 482.341043871749, share: 313.862690329680 },
};

const workbookDcfReference = {
  bear: 157.921887541378,
  base: 301.194526161080,
  bull: 497.115135162864,
};
const workbookSensitivityReference = {
  waccGrowthBase: 301.194526161080,
  waccExitBase: 413.201025610471,
  marginPath: {
    linear: 301.194526161080,
    frontLoaded: 303.621907918345,
    backLoaded: 298.712371397616,
  },
};

for (const [scenario, expected] of Object.entries(sentinels)) {
  const bridge = equityBridge(scenario);
  close(enterpriseValue(scenario), expected.ev, 1e-9);
  close(bridge.equity, expected.equity, 1e-9);
  close(bridge.sharePrice, expected.share, 1e-9);
  assert.ok(
    Math.abs(expected.ev - workbookDcfReference[scenario]) <= 0.15,
    `${scenario} site/workbook DCF delta exceeds €0.15m`
  );
}

assert.deepEqual(SCENARIOS.bear.growth, [0.12, 0.10, 0.08, 0.07, 0.06]);
assert.deepEqual(SCENARIOS.base.growth, [0.17, 0.15, 0.13, 0.11, 0.09]);
assert.deepEqual(SCENARIOS.bull.growth, [0.21, 0.18, 0.16, 0.14, 0.12]);
assert.deepEqual(
  Object.fromEntries(Object.entries(SCENARIOS).map(([id, scenario]) => [id, {
    margin2030: scenario.ebitdaMargin2030,
    taxRate: scenario.taxRate,
    daPct: scenario.daPct,
    capexPct: scenario.capexPct,
    wcPct: scenario.wcPct,
    wacc: scenario.wacc,
    g: scenario.g,
  }])),
  {
    bear: { margin2030: 0.26, taxRate: 0.25, daPct: 0.02, capexPct: 0.03, wcPct: 0.10, wacc: 0.105, g: 0.02 },
    base: { margin2030: 0.32, taxRate: 0.22, daPct: 0.02, capexPct: 0.027, wcPct: 0.07, wacc: 0.095, g: 0.025 },
    bull: { margin2030: 0.35, taxRate: 0.20, daPct: 0.02, capexPct: 0.025, wcPct: 0.05, wacc: 0.085, g: 0.03 },
  }
);

const waccs = [0.085, 0.09, 0.095, 0.10, 0.105];
const terminalGrowthRates = [0.035, 0.03, 0.025, 0.02, 0.015];
const exitMultiples = [13, 14, 15, 16, 17];
const waccGrowthSensitivity = sensitivityWaccG("base", waccs, terminalGrowthRates);
const waccExitSensitivity = sensitivityWaccExit("base", waccs, exitMultiples);
close(waccGrowthSensitivity[2][2], sentinels.base.ev);
assert.ok(Math.abs(waccGrowthSensitivity[2][2] - workbookSensitivityReference.waccGrowthBase) <= 0.15);
close(waccGrowthSensitivity[0][0], 414.430266959694, 1e-9);
close(waccGrowthSensitivity[4][4], 238.084720601020, 1e-9);
close(waccExitSensitivity[2][2], 413.101894767646, 1e-9);
assert.ok(Math.abs(waccExitSensitivity[2][2] - workbookSensitivityReference.waccExitBase) <= 0.15);
close(waccExitSensitivity[0][0], 382.937381638919, 1e-9);
close(waccExitSensitivity[4][4], 440.001666088685, 1e-9);

const marginPath = marginPathSensitivity("base");
close(marginPath.linear, sentinels.base.ev);
close(marginPath.frontLoaded, 305.408403155064, 1e-9);
close(marginPath.backLoaded, 296.493180822050, 1e-9);
assert.ok(Math.abs(marginPath.linear - workbookSensitivityReference.marginPath.linear) <= 0.15);
assert.ok(Math.abs(marginPath.frontLoaded - workbookSensitivityReference.marginPath.frontLoaded) <= 2.5);
assert.ok(Math.abs(marginPath.backLoaded - workbookSensitivityReference.marginPath.backLoaded) <= 2.5);

for (const scenario of Object.keys(sentinels)) {
  assert.ok(crossCheckFcf(scenario).every((year) => year.ok), `${scenario} FCF cross-check failed`);
}

assert.equal(FY25.netDebt, NET_DEBT.strict);
assert.equal(FY25.fcfNormalized, CASH_CONVERSION.normalisedFcf);
assert.equal(VALUATION_DATES.marketIso, "2026-07-15");
assert.deepEqual(Object.values(SOURCE_STATUS), [
  "Published",
  "Calculated",
  "Illustrative assumption",
  "Estimated",
  "To be confirmed",
  "Market data as of 15 July 2026",
]);
assert.equal(SOURCES.market.status, SOURCE_STATUS.MARKET_AS_OF);
assert.equal(SOURCES.qoe.status, SOURCE_STATUS.ESTIMATED);
assert.equal(SOURCES.engine.status, SOURCE_STATUS.CALCULATED);
assert.equal(LBO_REFERENCE.acquisitionDebt, 53.536);
assert.equal(LBO_REFERENCE.exitEbitda2030, 36.153);
assert.equal(LBO_REFERENCE.entryEv, 241.93);
assert.equal(LBO_REFERENCE.interestRate, 0.07163);
assert.equal(LBO_REFERENCE.cashSweep, 0.75);
assert.equal(LBO_REFERENCE.exitMultiple, 15);
assert.equal(LBO_REFERENCE.baseIrr, 0.225);
assert.equal(LBO_REFERENCE.dcfEntryIrr, 0.1636);
assert.deepEqual(VALUATION_CONTEXT.tradingRange, { low: 171, base: 202, high: 264 });
assert.deepEqual(VALUATION_CONTEXT.transactionRange, { low: 289, base: 411, high: 547 });
assert.deepEqual(TRANSACTION_COMPS.selectedMultiples, { low: 4.7, base: 6.7, high: 8.9 });
assert.equal(TRANSACTION_COMPS.selectedBasis, "FY25 revenue");
assert.deepEqual(VALUATION_CONTEXT.lboRange, { low: 222.5, base: 241.9, high: 283.5 });

const analysisSource = await readFile(
  new URL("../src/routes/AnalysisView.jsx", import.meta.url),
  "utf8"
);
assert.match(analysisSource, /VALUATION_CONTEXT\.controlEquityUpside/);
assert.match(analysisSource, /DISPLAY_VALUES\.grossFinancialDebt/);
assert.match(analysisSource, /SOURCES\.engine\.status/);

console.log("Canonical registry: OK");
for (const [scenario, expected] of Object.entries(sentinels)) {
  console.log(`${scenario}: EV ${expected.ev.toFixed(12)} | equity ${expected.equity.toFixed(12)} | share ${expected.share.toFixed(12)}`);
}
