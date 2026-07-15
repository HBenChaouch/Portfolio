import fs from "node:fs/promises";

const outDir = "../raw_data";
await fs.mkdir(outDir, { recursive: true });

const start = Math.floor(Date.parse("2024-07-08T00:00:00Z") / 1000);
const end = Math.floor(Date.parse("2026-07-16T00:00:00Z") / 1000);
const instruments = [
  ["Sidetrade", "ALBFR.PA", "EUR", "France"],
  ["BlackLine", "BL", "USD", "US"],
  ["BILL", "BILL", "USD", "US"],
  ["nCino", "NCNO", "USD", "US"],
  ["Workiva", "WK", "USD", "US"],
  ["CAC 40", "^FCHI", "EUR", "France"],
  ["S&P 500", "^GSPC", "USD", "US"],
  ["Nasdaq Composite", "^IXIC", "USD", "US"],
  ["STOXX Europe 600", "^STOXX", "EUR", "Europe"],
];

const csvEscape = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

const manifest = [];
for (const [name, ticker, currency, market] of instruments) {
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?period1=${start}&period2=${end}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`${ticker}: Yahoo HTTP ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`${ticker}: ${JSON.stringify(payload?.chart?.error)}`);
  const quote = result.indicators.quote[0];
  const adj = result.indicators.adjclose?.[0]?.adjclose ?? quote.close;
  const rows = result.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: quote.open[i],
    high: quote.high[i],
    low: quote.low[i],
    close: quote.close[i],
    adj_close: adj[i],
    volume: quote.volume[i],
  })).filter((r) => r.adj_close !== null && r.adj_close !== undefined);

  const safe = ticker.replaceAll("^", "IDX_").replaceAll(".", "_");
  await fs.writeFile(`${outDir}/yahoo_${safe}.json`, JSON.stringify(payload, null, 2), "utf8");
  const header = "date,open,high,low,close,adj_close,volume\n";
  const body = rows.map((r) => [r.date, r.open, r.high, r.low, r.close, r.adj_close, r.volume].map(csvEscape).join(",")).join("\n");
  await fs.writeFile(`${outDir}/yahoo_${safe}_daily.csv`, header + body + "\n", "utf8");
  manifest.push({ name, ticker, currency, market, provider: "Yahoo Finance chart API via yfinance-compatible endpoint", url, first_date: rows[0]?.date, last_date: rows.at(-1)?.date, observations: rows.length, filename: `yahoo_${safe}_daily.csv` });
  console.log(`${ticker}: ${rows.length} rows, ${rows[0]?.date} -> ${rows.at(-1)?.date}`);
}

await fs.writeFile(`${outDir}/source_manifest.json`, JSON.stringify({ retrieved_at_utc: new Date().toISOString(), requested_start: "2024-07-08", requested_end_exclusive: "2026-07-16", instruments: manifest }, null, 2), "utf8");

// Independent spot checks for US securities. Nasdaq is the official listing venue
// for this peer set; Stooq is retained as a fallback secondary vendor.
const secondaryLog = [];
for (const ticker of ["BL", "BILL", "NCNO", "WK"]) {
  const nasdaqUrl = `https://api.nasdaq.com/api/quote/${ticker}/historical?assetclass=stocks&fromdate=2026-07-01&todate=2026-07-15&limit=50`;
  try {
    const response = await fetch(nasdaqUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.nasdaq.com",
        "Referer": `https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}/historical`,
      },
    });
    const text = await response.text();
    await fs.writeFile(`${outDir}/nasdaq_${ticker}_official_spotcheck.json`, text, "utf8");
    let rows = [];
    try { rows = JSON.parse(text)?.data?.tradesTable?.rows ?? []; } catch {}
    if (rows.length) {
      const fields = ["date", "close", "volume", "open", "high", "low"];
      const csv = fields.join(",") + "\n" + rows.map((row) => fields.map((f) => csvEscape(row[f])).join(",")).join("\n") + "\n";
      await fs.writeFile(`${outDir}/nasdaq_${ticker}_official_spotcheck.csv`, csv, "utf8");
    }
    secondaryLog.push({ ticker, provider: "Nasdaq", url: nasdaqUrl, http_status: response.status, observations: rows.length });
    console.log(`Nasdaq ${ticker}: ${response.status}, ${rows.length} rows`);
  } catch (error) {
    secondaryLog.push({ ticker, provider: "Nasdaq", url: nasdaqUrl, error: error.message });
    console.log(`Nasdaq ${ticker}: ${error.message}`);
  }

  const stooqUrl = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&d1=20260701&d2=20260715&i=d`;
  try {
    const response = await fetch(stooqUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await response.text();
    const blocked = /^\s*<!DOCTYPE html/i.test(text);
    const observations = blocked ? 0 : Math.max(0, text.trim().split(/\r?\n/).length - 1);
    if (!blocked) await fs.writeFile(`${outDir}/stooq_${ticker}_secondary_spotcheck.csv`, text, "utf8");
    secondaryLog.push({ ticker, provider: "Stooq", url: stooqUrl, http_status: response.status, observations, status: blocked ? "blocked_by_browser_verification" : "downloaded" });
    console.log(`Stooq ${ticker}: ${response.status}, ${observations} rows${blocked ? " (browser verification)" : ""}`);
  } catch (error) {
    secondaryLog.push({ ticker, provider: "Stooq", url: stooqUrl, error: error.message });
    console.log(`Stooq ${ticker}: ${error.message}`);
  }
}
await fs.writeFile(`${outDir}/secondary_source_log.json`, JSON.stringify({ retrieved_at_utc: new Date().toISOString(), controls: secondaryLog }, null, 2), "utf8");

// SEC company facts are archived as primary-source support for peer capital structures.
const secHeaders = {
  "User-Agent": "Sidetrade beta research / OpenAI Codex",
  "Accept-Encoding": "gzip, deflate",
};
const tickersResponse = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: secHeaders });
if (!tickersResponse.ok) throw new Error(`SEC tickers HTTP ${tickersResponse.status}`);
const tickersPayload = await tickersResponse.json();
await fs.writeFile(`${outDir}/sec_company_tickers.json`, JSON.stringify(tickersPayload, null, 2), "utf8");

for (const ticker of ["BL", "BILL", "NCNO", "WK"]) {
  const match = Object.values(tickersPayload).find((x) => x.ticker === ticker);
  if (!match) throw new Error(`SEC CIK not found for ${ticker}`);
  const cik = String(match.cik_str).padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const response = await fetch(url, { headers: secHeaders });
  if (!response.ok) throw new Error(`SEC ${ticker} HTTP ${response.status}`);
  const payload = await response.json();
  await fs.writeFile(`${outDir}/sec_${ticker}_companyfacts.json`, JSON.stringify(payload, null, 2), "utf8");
  console.log(`SEC ${ticker}: CIK ${cik}, ${Object.keys(payload.facts?.["us-gaap"] ?? {}).length} US-GAAP facts`);
}
