import fs from "node:fs/promises";

const rawDir = "../raw_data";
const auditDir = "../audit";
const cutoff = "2026-07-15";

const instruments = [
  { name: "Sidetrade", ticker: "ALBFR.PA", file: "yahoo_ALBFR_PA_daily.csv", market: "France", benchmark: "^FCHI", altBenchmark: "^STOXX" },
  { name: "BlackLine", ticker: "BL", file: "yahoo_BL_daily.csv", market: "US", benchmark: "^GSPC", altBenchmark: "^IXIC" },
  { name: "BILL", ticker: "BILL", file: "yahoo_BILL_daily.csv", market: "US", benchmark: "^GSPC", altBenchmark: "^IXIC" },
  { name: "nCino", ticker: "NCNO", file: "yahoo_NCNO_daily.csv", market: "US", benchmark: "^GSPC", altBenchmark: "^IXIC" },
  { name: "Workiva", ticker: "WK", file: "yahoo_WK_daily.csv", market: "US", benchmark: "^GSPC", altBenchmark: "^IXIC" },
  { name: "CAC 40", ticker: "^FCHI", file: "yahoo_IDX_FCHI_daily.csv", market: "France" },
  { name: "S&P 500", ticker: "^GSPC", file: "yahoo_IDX_GSPC_daily.csv", market: "US" },
  { name: "Nasdaq Composite", ticker: "^IXIC", file: "yahoo_IDX_IXIC_daily.csv", market: "US" },
  { name: "STOXX Europe 600", ticker: "^STOXX", file: "yahoo_IDX_STOXX_daily.csv", market: "Europe" },
];

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(value); value = ""; }
    else if (c === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.some((x) => x !== "")).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function writeCsv(rows, headers) {
  return headers.join(",") + "\n" + rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")).join("\n") + "\n";
}
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (date, n) => new Date(date.getTime() + n * 86400000);

const daily = {};
for (const inst of instruments) {
  const rows = parseCsv(await fs.readFile(`${rawDir}/${inst.file}`, "utf8"));
  daily[inst.ticker] = rows.map((r) => ({
    date: r.date,
    open: Number(r.open), high: Number(r.high), low: Number(r.low), close: Number(r.close), adj_close: Number(r.adj_close), volume: Number(r.volume),
  })).filter((r) => Number.isFinite(r.adj_close) && r.date <= cutoff);
}

const weekEnds = [];
for (let d = new Date("2024-07-12T00:00:00Z"); d <= new Date("2026-07-10T00:00:00Z"); d = addDays(d, 7)) weekEnds.push(iso(d));

const weekly = [];
for (let i = 0; i < weekEnds.length; i++) {
  const end = weekEnds[i];
  const startExclusive = i === 0 ? "2024-07-05" : weekEnds[i - 1];
  const out = { week_end: end };
  for (const inst of instruments) {
    const matches = daily[inst.ticker].filter((r) => r.date > startExclusive && r.date <= end);
    const last = matches.at(-1);
    out[inst.ticker] = last?.adj_close ?? null;
    out[`${inst.ticker}_price_date`] = last?.date ?? null;
  }
  weekly.push(out);
}

const priceHeaders = ["week_end", ...instruments.flatMap((x) => [x.ticker, `${x.ticker}_price_date`])];
await fs.writeFile(`${rawDir}/weekly_adjusted_prices.csv`, writeCsv(weekly, priceHeaders), "utf8");

const returns = weekly.slice(1).map((row, i) => {
  const previous = weekly[i];
  const out = { week_end: row.week_end };
  for (const inst of instruments) out[inst.ticker] = Math.log(row[inst.ticker] / previous[inst.ticker]);
  return out;
});
const returnHeaders = ["week_end", ...instruments.map((x) => x.ticker)];
await fs.writeFile(`${rawDir}/weekly_log_returns.csv`, writeCsv(returns, returnHeaders), "utf8");

function ols(assetTicker, benchmarkTicker) {
  const pairs = returns.map((r) => [r[benchmarkTicker], r[assetTicker]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  const sxx = pairs.reduce((s, [x]) => s + (x - meanX) ** 2, 0);
  const sxy = pairs.reduce((s, [x, y]) => s + (x - meanX) * (y - meanY), 0);
  const syy = pairs.reduce((s, [, y]) => s + (y - meanY) ** 2, 0);
  const beta = sxy / sxx;
  const alphaWeekly = meanY - beta * meanX;
  const residuals = pairs.map(([x, y]) => y - alphaWeekly - beta * x);
  const sse = residuals.reduce((s, e) => s + e ** 2, 0);
  const seBeta = Math.sqrt((sse / (n - 2)) / sxx);
  const r2 = (sxy ** 2) / (sxx * syy);
  return { asset_ticker: assetTicker, benchmark_ticker: benchmarkTicker, observations: n, beta, alpha_weekly: alphaWeekly, alpha_annualized: Math.exp(alphaWeekly * 52) - 1, r_squared: r2, standard_error_beta: seBeta, t_stat_beta: beta / seBeta, first_return_week: returns[0].week_end, last_return_week: returns.at(-1).week_end };
}

const mainRegressions = instruments.slice(0, 5).map((x) => ({ company: x.name, specification: "Main", ...ols(x.ticker, x.benchmark) }));
const sensitivityRegressions = instruments.slice(0, 5).map((x) => ({ company: x.name, specification: "Alternative benchmark", ...ols(x.ticker, x.altBenchmark) }));

const spotPrice = Object.fromEntries(instruments.slice(0, 5).map((x) => [x.ticker, daily[x.ticker].find((r) => r.date === cutoff)?.close ?? daily[x.ticker].at(-1).close]));
const capital = [
  { company: "BlackLine", ticker: "BL", shares: 58660917, shares_as_of: "2026-04-30", gross_debt: 666728000, debt_as_of: "2026-03-31", debt_note: "Convertible debt + finance leases", tax_rate: 0.25, sec_accession: "0001628280-26-032255" },
  { company: "BILL", ticker: "BILL", shares: 99596727, shares_as_of: "2026-04-30", gross_debt: 1834854000, debt_as_of: "2026-03-31", debt_note: "Long-term debt carrying amount (includes convertible debt)", tax_rate: 0.25, sec_accession: "0001628280-26-032387" },
  { company: "nCino", ticker: "NCNO", shares: 109552950, shares_as_of: "2026-05-22", gross_debt: 313707000, debt_as_of: "2026-04-30", debt_note: "Long-term debt + finance leases", tax_rate: 0.25, sec_accession: "0001902733-26-000066" },
  { company: "Workiva", ticker: "WK", shares: 56885568, shares_as_of: "2026-03-31", gross_debt: 781634000, debt_as_of: "2026-03-31", debt_note: "Convertible debt + finance leases; shares = Q1 basic weighted average", tax_rate: 0.25, sec_accession: "0001445305-26-000045" },
].map((x) => {
  const regression = mainRegressions.find((r) => r.asset_ticker === x.ticker);
  const sensitivityRegression = sensitivityRegressions.find((r) => r.asset_ticker === x.ticker);
  const price = spotPrice[x.ticker];
  const marketCap = x.shares * price;
  const debtToEquity = x.gross_debt / marketCap;
  const unleveredBeta = regression.beta / (1 + (1 - x.tax_rate) * debtToEquity);
  const sensitivityUnleveredBeta = sensitivityRegression.beta / (1 + (1 - x.tax_rate) * debtToEquity);
  return { ...x, price_2026_07_15: price, market_cap: marketCap, debt_to_equity: debtToEquity, levered_beta: regression.beta, unlevered_beta: unleveredBeta, sensitivity_levered_beta: sensitivityRegression.beta, sensitivity_unlevered_beta: sensitivityUnleveredBeta };
});

const sortedUnlevered = capital.map((x) => x.unlevered_beta).sort((a, b) => a - b);
const medianUnlevered = (sortedUnlevered[1] + sortedUnlevered[2]) / 2;
const targetDebtWeight = 0.20;
const targetDebtToEquity = targetDebtWeight / (1 - targetDebtWeight);
const targetTax = 0.2583;
const targetReleveredBeta = medianUnlevered * (1 + (1 - targetTax) * targetDebtToEquity);
const sortedSensitivityUnlevered = capital.map((x) => x.sensitivity_unlevered_beta).sort((a, b) => a - b);
const medianSensitivityUnlevered = (sortedSensitivityUnlevered[1] + sortedSensitivityUnlevered[2]) / 2;
const targetReleveredBetaSensitivity = medianSensitivityUnlevered * (1 + (1 - targetTax) * targetDebtToEquity);
const waccBetaBridge = { median_unlevered_beta: medianUnlevered, target_debt_weight: targetDebtWeight, target_debt_to_equity: targetDebtToEquity, target_tax_rate: targetTax, target_relevered_beta: targetReleveredBeta, alternative_median_unlevered_beta: medianSensitivityUnlevered, alternative_target_relevered_beta: targetReleveredBetaSensitivity, current_model_beta: 1.15, difference_vs_model: targetReleveredBeta - 1.15 };

const regressionRows = [...mainRegressions, ...sensitivityRegressions];
await fs.writeFile(`${auditDir}/regression_results.json`, JSON.stringify({ main: mainRegressions, sensitivity: sensitivityRegressions, capital_structure: capital, wacc_beta_bridge: waccBetaBridge }, null, 2), "utf8");
await fs.writeFile(`${auditDir}/regression_results.csv`, writeCsv(regressionRows, ["company", "specification", "asset_ticker", "benchmark_ticker", "observations", "beta", "alpha_weekly", "alpha_annualized", "r_squared", "standard_error_beta", "t_stat_beta", "first_return_week", "last_return_week"]), "utf8");
await fs.writeFile(`${auditDir}/capital_structure_inputs.csv`, writeCsv(capital, ["company", "ticker", "price_2026_07_15", "shares", "shares_as_of", "market_cap", "gross_debt", "debt_as_of", "debt_to_equity", "tax_rate", "levered_beta", "unlevered_beta", "sensitivity_levered_beta", "sensitivity_unlevered_beta", "debt_note", "sec_accession"]), "utf8");

// Reliability controls: compare official Euronext/Nasdaq data with Yahoo on overlapping sessions.
const reliability = [];
const eur = parseCsv(await fs.readFile(`${rawDir}/euronext_ALBFR_official_spotcheck.csv`, "utf8"));
for (const row of eur) {
  const y = daily["ALBFR.PA"].find((x) => x.date === row.date);
  reliability.push({ provider: "Euronext", ticker: "ALBFR.PA", date: row.date, official_close: Number(row.close), yahoo_close: y?.close, close_difference: y ? y.close - Number(row.close) : null, official_volume: Number(row.volume), yahoo_volume: y?.volume, volume_difference: y ? y.volume - Number(row.volume) : null, status: y && Math.abs(y.close - Number(row.close)) < 0.011 && y.volume === Number(row.volume) ? "PASS" : "FAIL" });
}
for (const ticker of ["BL", "BILL", "NCNO", "WK"]) {
  const rows = parseCsv(await fs.readFile(`${rawDir}/nasdaq_${ticker}_official_spotcheck.csv`, "utf8"));
  for (const row of rows) {
    const [mm, dd, yyyy] = row.date.split("/");
    const date = `${yyyy}-${mm}-${dd}`;
    const num = (v) => Number(String(v).replaceAll("$", "").replaceAll(",", ""));
    const y = daily[ticker].find((x) => x.date === date);
    const volumeTolerance = Math.max(100, num(row.volume) * 0.001);
    reliability.push({ provider: "Nasdaq", ticker, date, official_close: num(row.close), yahoo_close: y?.close, close_difference: y ? y.close - num(row.close) : null, official_volume: num(row.volume), yahoo_volume: y?.volume, volume_difference: y ? y.volume - num(row.volume) : null, status: y && Math.abs(y.close - num(row.close)) < 0.011 && Math.abs(y.volume - num(row.volume)) <= volumeTolerance ? "PASS" : "FAIL" });
  }
}
await fs.writeFile(`${auditDir}/reliability_checks.csv`, writeCsv(reliability, ["provider", "ticker", "date", "official_close", "yahoo_close", "close_difference", "official_volume", "yahoo_volume", "volume_difference", "status"]), "utf8");

const quality = {
  weekly_price_observations: weekly.length,
  weekly_return_observations: returns.length,
  expected_weekly_prices: 105,
  expected_weekly_returns: 104,
  missing_weekly_prices: weekly.reduce((n, row) => n + instruments.filter((x) => !Number.isFinite(row[x.ticker])).length, 0),
  official_spotchecks: reliability.length,
  official_spotchecks_passed: reliability.filter((x) => x.status === "PASS").length,
  official_spotchecks_failed: reliability.filter((x) => x.status !== "PASS").length,
  target_beta: targetReleveredBeta,
};
await fs.writeFile(`${auditDir}/quality_summary.json`, JSON.stringify(quality, null, 2), "utf8");
console.log(JSON.stringify({ quality, mainRegressions, capital, waccBetaBridge }, null, 2));
