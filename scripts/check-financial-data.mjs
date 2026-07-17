import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CASH_CONVERSION,
  DISPLAY_VALUES,
  FY25,
  LBO_REFERENCE,
  NET_DEBT,
  QOE,
  SOURCES,
  VALUATION_CONTEXT,
  VALUATION_DATES,
} from "../src/data/sidetradeFinancials.js";
import { enterpriseValue, equityBridge } from "../src/utils/dcfEngine.js";

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

close(CASH_CONVERSION.statutoryOcf - CASH_CONVERSION.capex, CASH_CONVERSION.statutoryFcf);
close(CASH_CONVERSION.statutoryFcf + CASH_CONVERSION.cirTimingNormalisation, CASH_CONVERSION.normalisedFcf);
close(NET_DEBT.grossFinancialDebt - NET_DEBT.cash - NET_DEBT.marketableSecurities, NET_DEBT.strict);
close(QOE.publishedEbitdaInclCir - QOE.cirReported, QOE.publishedEbitdaExCir);
close(VALUATION_CONTEXT.marketCap, 267.40146, 1e-6);
close(VALUATION_CONTEXT.marketEv, 282.05546, 1e-6);
close(
  VALUATION_CONTEXT.controlEquityUpside,
  (VALUATION_CONTEXT.controlEv - NET_DEBT.strict) / VALUATION_CONTEXT.marketCap - 1
);
assert.equal(Math.round(VALUATION_CONTEXT.controlEquityUpside * 100), 48);
assert.equal(DISPLAY_VALUES.grossFinancialDebt, 30.8);

const sentinels = {
  bear: { ev: 157.888142308419, equity: 143.234142308419, share: 93.203458057652 },
  base: { ev: 301.124575075829, equity: 286.470575075829, share: 186.408406532987 },
  bull: { ev: 496.995043871749, equity: 482.341043871749, share: 313.862690329680 },
};

for (const [scenario, expected] of Object.entries(sentinels)) {
  const bridge = equityBridge(scenario);
  close(enterpriseValue(scenario), expected.ev, 1e-9);
  close(bridge.equity, expected.equity, 1e-9);
  close(bridge.sharePrice, expected.share, 1e-9);
}

assert.equal(FY25.netDebt, NET_DEBT.strict);
assert.equal(FY25.fcfNormalized, CASH_CONVERSION.normalisedFcf);
assert.equal(VALUATION_DATES.marketIso, "2026-07-15");
assert.match(SOURCES.market.status, /Manual market reference/);
assert.match(SOURCES.qoe.status, /Internally reviewed estimate/);
assert.equal(SOURCES.engine.status, "Audited engine · calculated");
assert.equal(LBO_REFERENCE.acquisitionDebt, 53.536);
assert.equal(LBO_REFERENCE.exitEbitda2030, 36.153);

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
