import fs from "node:fs/promises";

const tickers = ["BL", "BILL", "NCNO", "WK"];
const cutoff = "2026-07-15";

function latestFact(fact, unit) {
  const rows = fact?.units?.[unit] ?? [];
  return rows
    .filter((x) => x.end && x.end <= cutoff && ["10-Q", "10-K", "8-K"].includes(x.form))
    .sort((a, b) => a.end.localeCompare(b.end) || (a.filed ?? "").localeCompare(b.filed ?? ""))
    .at(-1) ?? null;
}

const output = {};
for (const ticker of tickers) {
  const payload = JSON.parse(await fs.readFile(`../raw_data/sec_${ticker}_companyfacts.json`, "utf8"));
  const gaap = payload.facts?.["us-gaap"] ?? {};
  const dei = payload.facts?.dei ?? {};
  const candidates = Object.entries(gaap)
    .filter(([tag]) => /debt|notespayable|convertible|financelease|borrowings|lineofcredit/i.test(tag))
    .map(([tag, fact]) => ({ tag, label: fact.label, latest_USD: latestFact(fact, "USD") }))
    .filter((x) => x.latest_USD)
    .sort((a, b) => a.tag.localeCompare(b.tag));
  output[ticker] = {
    entity: payload.entityName,
    shares: Object.entries(dei)
      .filter(([tag]) => /SharesOutstanding/i.test(tag))
      .map(([tag, fact]) => ({ tag, label: fact.label, latest_shares: latestFact(fact, "shares") })),
    share_candidates_all_taxonomies: Object.entries(payload.facts ?? {}).flatMap(([taxonomy, facts]) => Object.entries(facts)
      .filter(([tag]) => /SharesOutstanding|WeightedAverageNumberOf.*Shares/i.test(tag))
      .map(([tag, fact]) => ({ taxonomy, tag, label: fact.label, latest_shares: latestFact(fact, "shares") })))
      .filter((x) => x.latest_shares),
    debt_candidates: candidates,
  };
}

await fs.writeFile("../audit/sec_debt_candidates.json", JSON.stringify(output, null, 2), "utf8");
const concise = Object.fromEntries(Object.entries(output).map(([ticker, data]) => [ticker, {
  entity: data.entity,
  shares: data.shares,
  share_candidates_all_taxonomies: data.share_candidates_all_taxonomies,
  debt_candidates: data.debt_candidates.filter((x) => /^(ConvertibleDebt(Current|Noncurrent)?|LongTermDebt(Current|Noncurrent)?|LongTermDebtAndFinanceLeaseObligations(Current|Noncurrent)?|FinanceLeaseLiability(Current|Noncurrent)?|ShortTermBorrowings|NotesPayable(Current|Noncurrent)?|DebtCurrent|DebtNoncurrent|DebtAndFinanceLeaseObligations|RevolvingCreditFacility(Current|Noncurrent)?)$/i.test(x.tag) && x.latest_USD.end >= "2025-12-31"),
}]));
await fs.writeFile("../audit/sec_capital_structure_concise.json", JSON.stringify(concise, null, 2), "utf8");
console.log(JSON.stringify(concise, null, 2));
