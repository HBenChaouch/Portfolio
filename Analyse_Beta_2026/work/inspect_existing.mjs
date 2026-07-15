import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = "C:/Users/Abbah/Downloads/Portefolio/Portefolio/Sidetrade/Sidetrade_Valuation_2026_v2.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 16000,
  tableMaxRows: 12,
  tableMaxCols: 12,
  tableMaxCellChars: 100,
});
await fs.writeFile("../audit/existing_workbook_summary.ndjson", summary.ndjson, "utf8");
console.log(summary.ndjson);

const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 10000 });
await fs.writeFile("../audit/existing_sheet_list.ndjson", sheets.ndjson, "utf8");
console.log(sheets.ndjson);

for (const target of ["Inputs", "Trading_comps", "Sources", "Sources_Audit"]) {
  try {
    const detail = await workbook.inspect({
      kind: "table,formula",
      sheetId: target,
      range: "A1:Z100",
      maxChars: 24000,
      tableMaxRows: 100,
      tableMaxCols: 26,
      options: { maxResults: 300 },
    });
    await fs.writeFile(`../audit/existing_${target}.ndjson`, detail.ndjson, "utf8");
    console.log(`TARGET ${target}\n${detail.ndjson}`);
  } catch (error) {
    console.log(`SKIP ${target}: ${error.message}`);
  }
}

const trading = workbook.worksheets.getItem("Trading_comps").getRange("A1:I28");
await fs.writeFile(
  "../audit/existing_trading_comps.json",
  JSON.stringify({ values: trading.values, formulas: trading.formulas }, null, 2),
  "utf8",
);
console.log(JSON.stringify({ tradingValues: trading.values, tradingFormulas: trading.formulas }, null, 2));
