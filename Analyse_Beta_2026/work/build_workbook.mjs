import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "../outputs/beta_sidetrade_20260715";
const previewDir = "../audit/previews";
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

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
  const headers = rows.shift();
  return rows.filter((r) => r.some((x) => x !== "")).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

const weekly = parseCsv(await fs.readFile("../raw_data/weekly_adjusted_prices.csv", "utf8"));
const reliability = parseCsv(await fs.readFile("../audit/reliability_checks.csv", "utf8"));
const analysis = JSON.parse(await fs.readFile("../audit/regression_results.json", "utf8"));
const quality = JSON.parse(await fs.readFile("../audit/quality_summary.json", "utf8"));
const manifest = JSON.parse(await fs.readFile("../raw_data/source_manifest.json", "utf8"));

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: "User" });
const summary = workbook.worksheets.add("Synthese");
const assumptions = workbook.worksheets.add("Hypotheses");
const prices = workbook.worksheets.add("Cours Hebdo");
const returns = workbook.worksheets.add("Rendements");
const regressions = workbook.worksheets.add("Regressions");
const capital = workbook.worksheets.add("Structure Capital");
const controls = workbook.worksheets.add("Controles");
const sources = workbook.worksheets.add("Sources");

const C = {
  navy: "#17365D", dark: "#1F2937", blue: "#D9EAF7", blueText: "#0000FF",
  greenText: "#008000", paleGreen: "#E2F0D9", paleRed: "#FCE8E6", paleYellow: "#FFF2CC",
  gray: "#E7E6E6", lightGray: "#F3F4F6", white: "#FFFFFF", black: "#000000", border: "#B7C3D0",
};
const fmt = {
  pct: "0.0%;[Red](0.0%);-", pct2: "0.00%;[Red](0.00%);-", beta: "0.00x;[Red](0.00x);-",
  priceUsd: '"$"0.00;[Red]("$"0.00);-', priceEur: '"€"0.00;[Red]("€"0.00);-',
  usd: '"$"#,##0;[Red]("$"#,##0);-', integer: "#,##0;[Red](#,##0);-", decimal: "0.000;[Red](0.000);-", date: "yyyy-mm-dd",
};
const title = (sheet, range, text) => {
  range.merge();
  range.values = [[text]];
  range.format = { fill: C.navy, font: { bold: true, color: C.white }, verticalAlignment: "center" };
  range.format.rowHeight = 28;
};
const section = (sheet, range, text) => {
  range.merge();
  range.values = [[text]];
  range.format = { fill: C.navy, font: { bold: true, color: C.white }, verticalAlignment: "center" };
  range.format.rowHeight = 22;
};
const header = (range) => {
  range.format = { fill: C.gray, font: { bold: true, color: C.black }, borders: { preset: "outside", style: "thin", color: C.border }, verticalAlignment: "center", wrapText: true };
  range.format.rowHeight = 28;
};
const crossSheet = (range) => { range.format.font = { color: C.greenText }; };
const inputStyle = (range) => { range.format = { fill: C.blue, font: { color: C.blueText }, borders: { preset: "outside", style: "thin", color: C.border } }; };
for (const sheet of [summary, assumptions, prices, returns, regressions, capital, controls, sources]) sheet.showGridLines = false;

// Hypotheses
title(assumptions, assumptions.getRange("A1:F1"), "SIDETRADE — HYPOTHÈSES DE L’ANALYSE BÊTA");
assumptions.getRange("A2:F2").merge();
assumptions.getRange("A2").values = [["Fenêtre de deux ans, fréquence hebdomadaire, clôtures ajustées — version au 15 juillet 2026"]];
assumptions.getRange("A2:F2").format = { fill: C.lightGray, font: { color: C.dark }, wrapText: true };
assumptions.getRange("A4:F4").values = [["Paramètre", "Valeur", "Unité", "Source / logique", "Statut", "Notes"]];
header(assumptions.getRange("A4:F4"));
const assumptionRows = [
  ["Date d'analyse", new Date("2026-07-15T00:00:00Z"), "date", "Date de récupération", "Fixe", "Les régressions s'arrêtent à la dernière semaine complète"],
  ["Première clôture hebdomadaire", new Date("2024-07-12T00:00:00Z"), "date", "Dernière séance disponible de la semaine", "Fixe", "Point de départ nécessaire pour calculer 104 rendements"],
  ["Dernière clôture hebdomadaire", new Date("2026-07-10T00:00:00Z"), "date", "Dernière semaine complète", "Fixe", "La semaine au 15/07 est volontairement exclue car incomplète"],
  ["Nombre de rendements", 104, "semaines", "105 prix hebdomadaires moins 1", "Contrôlé", "Environ deux ans"],
  ["Type de rendement", "Logarithmique", "ln(Pt/Pt-1)", "Convention de régression", "Fixe", "Les prix sont ajustés des distributions et splits par la source"],
  ["Source homogène", "Yahoo Finance", "Adjusted Close", "API chart compatible yfinance", "Contrôlé", "Extraction quotidienne puis resampling vendredi"],
  ["Indice principal — Sidetrade", "CAC 40", "^FCHI", "Indice large France", "Principal", "Le titre Sidetrade est coté à Paris"],
  ["Indice alternatif — Sidetrade", "STOXX Europe 600", "^STOXX", "Sensibilité Europe", "Sensibilité", "Contrôle de robustesse"],
  ["Indice principal — peers US", "S&P 500", "^GSPC", "Marché actions US large", "Principal", "Préféré au Nasdaq pour éviter un biais sectoriel"],
  ["Indice alternatif — peers US", "Nasdaq Composite", "^IXIC", "Sensibilité technologique", "Sensibilité", "Produit des bêtas plus faibles sur cette fenêtre"],
  ["Désendettement", "Hamada", "βU=βL/[1+(1−T)D/E]", "Dette brute / capitalisation boursière", "Formule", "Taux normalisé de 25% pour les peers"],
  ["Réendettement Sidetrade", "Hamada", "βL=βU×[1+(1−T)D/E]", "Structure cible du modèle", "Formule", "D/(D+E)=20%, IS France=25,83%"],
];
assumptions.getRange(`A5:F${4 + assumptionRows.length}`).values = assumptionRows;
assumptions.getRange("B5:B7").format.numberFormat = fmt.date;
assumptions.getRange("A5:F16").format.borders = { preset: "inside", style: "thin", color: "#D9E2F3" };
assumptions.getRange("D5:F16").format.wrapText = true;
assumptions.getRange("A18:F18").merge();
assumptions.getRange("A18").values = [["Point de vigilance : le bêta propre de Sidetrade est présenté comme contrôle, pas comme estimateur principal du WACC. Sa faible liquidité et son R² très bas rendent la médiane des comparables désendettés plus robuste."]];
assumptions.getRange("A18:F18").format = { fill: C.paleYellow, font: { color: C.dark }, wrapText: true, borders: { preset: "outside", style: "thin", color: C.border } };
assumptions.getRange("A18:F18").format.rowHeight = 48;
assumptions.getRange("A1:A18").format.columnWidth = 30;
assumptions.getRange("B1:B18").format.columnWidth = 24;
assumptions.getRange("C1:C18").format.columnWidth = 22;
assumptions.getRange("D1:D18").format.columnWidth = 32;
assumptions.getRange("E1:E18").format.columnWidth = 16;
assumptions.getRange("F1:F18").format.columnWidth = 46;
assumptions.freezePanes.freezeRows(4);

// Weekly adjusted prices
title(prices, prices.getRange("A1:J1"), "COURS HEBDOMADAIRES AJUSTÉS — 105 OBSERVATIONS");
prices.getRange("A2:J2").merge();
prices.getRange("A2").values = [["Dernière clôture disponible de chaque semaine civile, du 12/07/2024 au 10/07/2026. Les dates de prix exactes sont conservées dans raw_data/weekly_adjusted_prices.csv."]];
prices.getRange("A2:J2").format = { fill: C.lightGray, wrapText: true };
const priceCols = [
  ["Semaine fin", "week_end", "date"], ["Sidetrade", "ALBFR.PA", "eur"], ["CAC 40", "^FCHI", "index"],
  ["BlackLine", "BL", "usd"], ["BILL", "BILL", "usd"], ["nCino", "NCNO", "usd"], ["Workiva", "WK", "usd"],
  ["S&P 500", "^GSPC", "index"], ["Nasdaq", "^IXIC", "index"], ["STOXX 600", "^STOXX", "index"],
];
prices.getRange("A4:J4").values = [priceCols.map((x) => x[0])];
header(prices.getRange("A4:J4"));
const priceRows = weekly.map((r) => priceCols.map(([, key, type]) => type === "date" ? new Date(`${r[key]}T00:00:00Z`) : Number(r[key])));
prices.getRange(`A5:J${4 + priceRows.length}`).values = priceRows;
prices.getRange(`A5:A${4 + priceRows.length}`).format.numberFormat = fmt.date;
prices.getRange(`B5:B${4 + priceRows.length}`).format.numberFormat = fmt.priceEur;
prices.getRange(`C5:C${4 + priceRows.length}`).format.numberFormat = "#,##0.0";
prices.getRange(`D5:G${4 + priceRows.length}`).format.numberFormat = fmt.priceUsd;
prices.getRange(`H5:J${4 + priceRows.length}`).format.numberFormat = "#,##0.0";
prices.getRange("A1:A109").format.columnWidth = 14;
prices.getRange("B1:J109").format.columnWidth = 14;
prices.freezePanes.freezeRows(4);

// Weekly returns, formula-driven
title(returns, returns.getRange("A1:J1"), "RENDEMENTS LOGARITHMIQUES HEBDOMADAIRES — 104 OBSERVATIONS");
returns.getRange("A2:J2").merge();
returns.getRange("A2").values = [["Chaque cellule de rendement est une formule LN(Pt/Pt−1) liée à l’onglet Cours Hebdo."]];
returns.getRange("A2:J2").format = { fill: C.lightGray, wrapText: true };
returns.getRange("A4:J4").values = [priceCols.map((x) => x[0])];
header(returns.getRange("A4:J4"));
returns.getRange("A5:J5").values = [["Point initial", null, null, null, null, null, null, null, null, null]];
returns.getRange("A5").format.font = { italic: true, color: C.dark };
const returnDates = weekly.slice(1).map((r) => [new Date(`${r.week_end}T00:00:00Z`)]);
returns.getRange(`A6:A${5 + returnDates.length}`).values = returnDates;
for (let col = 1; col <= 9; col++) {
  const letter = String.fromCharCode(65 + col);
  returns.getRange(`${letter}6`).formulas = [[`=LN('Cours Hebdo'!${letter}6/'Cours Hebdo'!${letter}5)`]];
  returns.getRange(`${letter}6:${letter}${5 + returnDates.length}`).fillDown();
}
returns.getRange(`A6:A${5 + returnDates.length}`).format.numberFormat = fmt.date;
returns.getRange(`B6:J${5 + returnDates.length}`).format.numberFormat = fmt.pct2;
returns.getRange("A1:A109").format.columnWidth = 14;
returns.getRange("B1:J109").format.columnWidth = 14;
returns.freezePanes.freezeRows(4);

// Regression calculations
title(regressions, regressions.getRange("A1:N1"), "RÉGRESSIONS OLS — BÊTAS LEVERED");
regressions.getRange("A2:N2").merge();
regressions.getRange("A2").values = [["Régression : rendement action = alpha + bêta × rendement marché + erreur. Les intervalles utilisent la loi de Student à 95%."]];
regressions.getRange("A2:N2").format = { fill: C.lightGray, wrapText: true };
section(regressions, regressions.getRange("A4:N4"), "SPÉCIFICATION PRINCIPALE — marché large");
const regHeaders = ["Société", "Action", "Indice", "N", "Bêta", "Alpha hebdo", "Alpha annualisé", "R²", "SE bêta", "t-stat", "p-value", "IC 95% bas", "IC 95% haut", "Lecture"];
regressions.getRange("A5:N5").values = [regHeaders];
header(regressions.getRange("A5:N5"));
const mainSpecs = [
  ["Sidetrade", "ALBFR.PA", "CAC 40", "B", "C"],
  ["BlackLine", "BL", "S&P 500", "D", "H"],
  ["BILL", "BILL", "S&P 500", "E", "H"],
  ["nCino", "NCNO", "S&P 500", "F", "H"],
  ["Workiva", "WK", "S&P 500", "G", "H"],
];
// Student t helpers used only for displayed p-values / confidence intervals.
// Core beta, alpha, R2, standard error and t-stat remain live spreadsheet formulas.
const logGamma = (z) => {
  const p = [0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.5073432786869, -0.13857109526572, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};
const betaCf = (a, b, x) => {
  const maxIt = 200, eps = 3e-14, fpMin = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < fpMin) d = fpMin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIt; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpMin) d = fpMin;
    c = 1 + aa / c; if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpMin) d = fpMin;
    c = 1 + aa / c; if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
};
const regularizedBeta = (x, a, b) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betaCf(a, b, x) / a : 1 - bt * betaCf(b, a, 1 - x) / b;
};
const twoSidedTP = (t, df) => regularizedBeta(df / (df + t * t), df / 2, 0.5);
const tCritical95 = (df) => {
  const z = 1.959963984540054;
  return z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df ** 2) + (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * df ** 3);
};
const writeRegBlock = (startRow, specs, stats) => {
  specs.forEach((spec, idx) => {
    const r = startRow + idx;
    const [company, asset, benchmark, yCol, xCol] = spec;
    regressions.getRange(`A${r}:C${r}`).values = [[company, asset, benchmark]];
    const y = `'Rendements'!$${yCol}$6:$${yCol}$109`;
    const x = `'Rendements'!$${xCol}$6:$${xCol}$109`;
    regressions.getRange(`D${r}:J${r}`).formulas = [[
      `=COUNT(${y})`, `=SLOPE(${y},${x})`, `=INTERCEPT(${y},${x})`, `=EXP(F${r}*52)-1`,
      `=RSQ(${y},${x})`, `=STEYX(${y},${x})/SQRT(DEVSQ(${x}))`, `=E${r}/I${r}`,
    ]];
    const s = stats[idx], df = s.observations - 2, crit = tCritical95(df);
    const pValue = twoSidedTP(Math.abs(s.t_stat_beta), df);
    regressions.getRange(`K${r}:N${r}`).values = [[
      pValue, s.beta - crit * s.standard_error_beta, s.beta + crit * s.standard_error_beta,
      pValue < 0.05 ? "Significatif" : "Non significatif",
    ]];
  });
};
writeRegBlock(6, mainSpecs, analysis.main);
section(regressions, regressions.getRange("A13:N13"), "SENSIBILITÉ — indice technologique / européen");
regressions.getRange("A14:N14").values = [regHeaders];
header(regressions.getRange("A14:N14"));
const altSpecs = [
  ["Sidetrade", "ALBFR.PA", "STOXX Europe 600", "B", "J"],
  ["BlackLine", "BL", "Nasdaq Composite", "D", "I"],
  ["BILL", "BILL", "Nasdaq Composite", "E", "I"],
  ["nCino", "NCNO", "Nasdaq Composite", "F", "I"],
  ["Workiva", "WK", "Nasdaq Composite", "G", "I"],
];
writeRegBlock(15, altSpecs, analysis.sensitivity);
regressions.getRange("D6:D19").format.numberFormat = fmt.integer;
for (const range of ["E6:E19", "I6:I19", "L6:M19"]) regressions.getRange(range).format.numberFormat = fmt.beta;
regressions.getRange("J6:J19").format.numberFormat = fmt.decimal;
for (const range of ["F6:G19", "H6:H19", "K6:K19"]) regressions.getRange(range).format.numberFormat = range.startsWith("K") ? "0.000" : fmt.pct2;
regressions.getRange("A22:N22").merge();
regressions.getRange("A22").values = [["Lecture Sidetrade : le bêta propre est très faible et non significatif ; son intervalle de confiance est large. Il n’est donc pas utilisé comme bêta WACC central."]];
regressions.getRange("A22:N22").format = { fill: C.paleYellow, wrapText: true, borders: { preset: "outside", style: "thin", color: C.border } };
regressions.getRange("A22:N22").format.rowHeight = 40;
regressions.getRange("A1:A22").format.columnWidth = 18;
regressions.getRange("B1:C22").format.columnWidth = 17;
regressions.getRange("D1:M22").format.columnWidth = 13;
regressions.getRange("N1:N22").format.columnWidth = 18;
regressions.freezePanes.freezeRows(5);

// Capital structure and relevering
title(capital, capital.getRange("A1:M1"), "BÊTAS DÉSENDETTÉS / RÉENDETTÉS — STRUCTURE CIBLE SIDETRADE");
capital.getRange("A2:M2").merge();
capital.getRange("A2").values = [["Cellules bleues = hypothèses sourcées / modifiables. Cellules vertes = liens vers les régressions. Calculs en noir."]];
capital.getRange("A2:M2").format = { fill: C.lightGray, wrapText: true };
section(capital, capital.getRange("A4:M4"), "COMPARABLES COTÉS");
capital.getRange("A5:M5").values = [["Société", "Ticker", "Cours 15/07/26", "Actions", "Capitalisation", "Dette brute", "D/E", "IS norm.", "Bêta L principal", "Bêta U principal", "Bêta L sensi.", "Bêta U sensi.", "Source / note"]];
header(capital.getRange("A5:M5"));
analysis.capital_structure.forEach((x, i) => {
  const r = 6 + i;
  capital.getRange(`A${r}:D${r}`).values = [[x.company, x.ticker, x.price_2026_07_15, x.shares]];
  capital.getRange(`F${r}`).values = [[x.gross_debt]];
  capital.getRange(`H${r}`).values = [[x.tax_rate]];
  capital.getRange(`M${r}`).values = [[`${x.debt_note} | SEC ${x.sec_accession}`]];
  capital.getRange(`E${r}`).formulas = [[`=C${r}*D${r}`]];
  capital.getRange(`G${r}`).formulas = [[`=F${r}/E${r}`]];
  capital.getRange(`I${r}`).formulas = [[`='Regressions'!E${7 + i}`]];
  capital.getRange(`J${r}`).formulas = [[`=I${r}/(1+(1-H${r})*G${r})`]];
  capital.getRange(`K${r}`).formulas = [[`='Regressions'!E${16 + i}`]];
  capital.getRange(`L${r}`).formulas = [[`=K${r}/(1+(1-H${r})*G${r})`]];
  inputStyle(capital.getRange(`C${r}:D${r}`));
  inputStyle(capital.getRange(`F${r}`));
  inputStyle(capital.getRange(`H${r}`));
  crossSheet(capital.getRange(`I${r}`));
  crossSheet(capital.getRange(`K${r}`));
  workbook.comments.addThread({ cell: capital.getRange(`C${r}`) }, `Source: Yahoo Finance chart API | As-of: 2026-07-15 | Closing price used for market capitalization.`);
  workbook.comments.addThread({ cell: capital.getRange(`D${r}`) }, `Source: SEC company facts / latest 10-Q | As-of: ${x.shares_as_of} | Accession: ${x.sec_accession}.`);
  workbook.comments.addThread({ cell: capital.getRange(`F${r}`) }, `Source: SEC company facts / latest 10-Q | As-of: ${x.debt_as_of} | ${x.debt_note}.`);
  workbook.comments.addThread({ cell: capital.getRange(`H${r}`) }, "Assumption: normalized 25% tax rate used consistently for US peers in the Hamada unlevering formula.");
});
capital.getRange("C6:C9").format.numberFormat = fmt.priceUsd;
capital.getRange("D6:D9").format.numberFormat = fmt.int;
capital.getRange("E6:F9").format.numberFormat = fmt.usd;
capital.getRange("G6:H9").format.numberFormat = fmt.pct;
capital.getRange("I6:L9").format.numberFormat = fmt.beta;
capital.getRange("M6:M9").format.wrapText = true;
section(capital, capital.getRange("A12:M12"), "MÉDIANE DES PEERS ET RÉENDETTEMENT SIDETRADE");
const bridgeLabels = [
  "Médiane bêta U — indice principal", "Médiane bêta U — sensibilité Nasdaq", "Poids cible dette D/(D+E)", "D/E cible", "IS cible France", "Bêta relevered cible — principal", "Bêta relevered cible — sensibilité", "Bêta actuellement retenu au modèle", "Prudence du modèle vs statistique", "ERP zone euro", "Impact CoE de la prudence bêta",
];
capital.getRange("A13:A23").values = bridgeLabels.map((x) => [x]);
capital.getRange("B13").formulas = [["=MEDIAN(J6:J9)"]];
capital.getRange("B14").formulas = [["=MEDIAN(L6:L9)"]];
capital.getRange("B15").values = [[0.20]];
capital.getRange("B16").formulas = [["=B15/(1-B15)"]];
capital.getRange("B17").values = [[0.2583]];
capital.getRange("B18").formulas = [["=B13*(1+(1-B17)*B16)"]];
capital.getRange("B19").formulas = [["=B14*(1+(1-B17)*B16)"]];
capital.getRange("B20").values = [[1.15]];
capital.getRange("B21").formulas = [["=B20-B18"]];
capital.getRange("B22").values = [[0.055]];
capital.getRange("B23").formulas = [["=B21*B22"]];
capital.getRange("C13:C23").values = [
  ["S&P 500"], ["Nasdaq Composite"], ["Modèle WACC existant"], ["Formule"], ["France"], ["Résultat central"], ["Sensibilité"], ["Inputs!C48 du modèle existant"], ["Écart positif = conservateur"], ["Hypothèse existante"], ["Points de coût des fonds propres"],
];
inputStyle(capital.getRange("B15")); inputStyle(capital.getRange("B17")); inputStyle(capital.getRange("B20")); inputStyle(capital.getRange("B22"));
capital.getRange("B13:B21").format.numberFormat = fmt.beta;
capital.getRange("B15:B17").format.numberFormat = fmt.pct;
capital.getRange("B22:B23").format.numberFormat = fmt.pct2;
capital.getRange("A25:M25").merge();
capital.getRange("A25").formulas = [["=\"Conclusion : bêta statistique central = \"&TEXT(B18,\"0.00x\")&\" ; le bêta 1,15x du modèle est supérieur de \"&TEXT(B21,\"0.00x\")&\" et ajoute environ \"&TEXT(B23,\"0.00%\")&\" au coût des fonds propres.\""]];
capital.getRange("A25:M25").format = { fill: C.paleGreen, font: { bold: true, color: C.dark }, wrapText: true, borders: { preset: "outside", style: "thin", color: C.border } };
capital.getRange("A25:M25").format.rowHeight = 42;
capital.getRange("A1:A25").format.columnWidth = 34;
capital.getRange("B1:B25").format.columnWidth = 13;
capital.getRange("C1:L25").format.columnWidth = 15;
capital.getRange("M1:M25").format.columnWidth = 46;
capital.freezePanes.freezeRows(5);

// Controls
title(controls, controls.getRange("A1:J1"), "CONTRÔLES DE FIABILITÉ ET DE COMPLÉTUDE");
section(controls, controls.getRange("A3:J3"), "SYNTHÈSE DES CONTRÔLES");
controls.getRange("A4:D8").values = [
  ["Contrôle", "Réalisé", "Attendu", "Statut"],
  ["Prix hebdomadaires", quality.weekly_price_observations, quality.expected_weekly_prices, null],
  ["Rendements hebdomadaires", quality.weekly_return_observations, quality.expected_weekly_returns, null],
  ["Prix hebdomadaires manquants", quality.missing_weekly_prices, 0, null],
  ["Comparaisons officielles", quality.official_spotchecks_passed, quality.official_spotchecks, null],
];
header(controls.getRange("A4:D4"));
for (let r = 5; r <= 8; r++) controls.getRange(`D${r}`).formulas = [[r === 7 ? `=IF(B${r}=C${r},"PASS","FAIL")` : `=IF(B${r}=C${r},"PASS","FAIL")`]];
controls.getRange("A10:J10").values = [["Source officielle", "Ticker", "Date", "Clôture officielle", "Clôture Yahoo", "Écart clôture", "Volume officiel", "Volume Yahoo", "Écart volume", "Statut"]];
header(controls.getRange("A10:J10"));
reliability.forEach((x, i) => {
  const r = 11 + i;
  controls.getRange(`A${r}:E${r}`).values = [[x.provider, x.ticker, new Date(`${x.date}T00:00:00Z`), Number(x.official_close), Number(x.yahoo_close)]];
  controls.getRange(`G${r}:H${r}`).values = [[Number(x.official_volume), Number(x.yahoo_volume)]];
  controls.getRange(`F${r}`).formulas = [[`=E${r}-D${r}`]];
  controls.getRange(`I${r}`).formulas = [[`=H${r}-G${r}`]];
  controls.getRange(`J${r}`).formulas = [[`=IF(AND(ABS(F${r})<0.011,ABS(I${r})<=MAX(100,G${r}*0.001)),"PASS","FAIL")`]];
});
const controlEnd = 10 + reliability.length;
controls.getRange(`C11:C${controlEnd}`).format.numberFormat = fmt.date;
controls.getRange(`D11:F${controlEnd}`).format.numberFormat = "0.0000";
controls.getRange(`G11:I${controlEnd}`).format.numberFormat = fmt.integer;
controls.getRange(`D5:D8`).conditionalFormats.add("containsText", { text: "PASS", format: { fill: C.paleGreen, font: { color: "#006100", bold: true } } });
controls.getRange(`D5:D8`).conditionalFormats.add("containsText", { text: "FAIL", format: { fill: C.paleRed, font: { color: "#9C0006", bold: true } } });
controls.getRange(`J11:J${controlEnd}`).conditionalFormats.add("containsText", { text: "PASS", format: { fill: C.paleGreen, font: { color: "#006100", bold: true } } });
controls.getRange(`J11:J${controlEnd}`).conditionalFormats.add("containsText", { text: "FAIL", format: { fill: C.paleRed, font: { color: "#9C0006", bold: true } } });
controls.getRange("A1:A56").format.columnWidth = 18;
controls.getRange("B1:B56").format.columnWidth = 14;
controls.getRange("C1:C56").format.columnWidth = 14;
controls.getRange("D1:F56").format.columnWidth = 17;
controls.getRange("G1:I56").format.columnWidth = 16;
controls.getRange("J1:J56").format.columnWidth = 12;
controls.freezePanes.freezeRows(10);

// Sources and audit trail
title(sources, sources.getRange("A1:F1"), "SOURCES ET PISTE D’AUDIT");
sources.getRange("A3:F3").values = [["ID", "Élément", "Source", "URL / référence", "Date / période", "Notes"]];
header(sources.getRange("A3:F3"));
const sourceRows = [
  ["S01", "Documentation extraction", "yfinance", "https://ranaroussi.github.io/yfinance/reference/api/yfinance.download.html", "Consulté 2026-07-15", "Adjusted prices; daily interval; start inclusive and end exclusive"],
  ["S02", "Limites d'utilisation", "yfinance", "https://ranaroussi.github.io/yfinance/", "Consulté 2026-07-15", "Outil open source non affilié à Yahoo; usage recherche/personnel"],
  ["S03", "Sidetrade — prix officiel", "Euronext", "https://live.euronext.com/en/product/equities/FR0010202606-XPAR", "Spot-check 2026-07-02 à 2026-07-15", "10/10 clôtures et volumes concordent"],
  ["S04", "Marché historique Euronext", "Euronext Data", "https://www.euronext.com/en/data", "Consulté 2026-07-15", "Source primaire de la cotation Sidetrade"],
  ["S05", "BlackLine — contrôle officiel", "Nasdaq", "https://www.nasdaq.com/market-activity/stocks/bl/historical", "Spot-check juillet 2026", "Clôtures concordantes; volumes Yahoo arrondis"],
  ["S06", "BILL — contrôle officiel", "Nasdaq", "https://www.nasdaq.com/market-activity/stocks/bill/historical", "Spot-check juillet 2026", "Clôtures concordantes; volumes Yahoo arrondis"],
  ["S07", "nCino — contrôle officiel", "Nasdaq", "https://www.nasdaq.com/market-activity/stocks/ncno/historical", "Spot-check juillet 2026", "Clôtures concordantes; volumes Yahoo arrondis"],
  ["S08", "Workiva — contrôle officiel", "Nasdaq", "https://www.nasdaq.com/market-activity/stocks/wk/historical", "Spot-check juillet 2026", "Clôtures concordantes; volumes Yahoo arrondis"],
  ["S09", "BlackLine — structure de capital", "SEC company facts", "https://data.sec.gov/api/xbrl/companyfacts/CIK0001666134.json", "Q1 2026", "Accession 0001628280-26-032255"],
  ["S10", "BILL — structure de capital", "SEC company facts", "https://data.sec.gov/api/xbrl/companyfacts/CIK0001786352.json", "Q3 FY2026", "Accession 0001628280-26-032387"],
  ["S11", "nCino — structure de capital", "SEC company facts", "https://data.sec.gov/api/xbrl/companyfacts/CIK0001902733.json", "Q1 FY2027", "Accession 0001902733-26-000066"],
  ["S12", "Workiva — structure de capital", "SEC company facts", "https://data.sec.gov/api/xbrl/companyfacts/CIK0001445305.json", "Q1 2026", "Accession 0001445305-26-000045"],
  ["S13", "Modèle de référence", "Sidetrade valuation v2", "Sidetrade/Sidetrade_Valuation_2026_v2.xlsx", "Version au 15/07/2026", "Bêta existant 1,15; dette cible 20%; IS 25,83%"],
];
sources.getRange(`A4:F${3 + sourceRows.length}`).values = sourceRows;
sources.getRange(`D4:F${3 + sourceRows.length}`).format.wrapText = true;
sources.getRange("A18:F18").merge();
sources.getRange("A18").values = [["Fichiers bruts conservés dans Analyse_Beta_2026/raw_data : JSON Yahoo, CSV quotidiens, exports de contrôle Euronext/Nasdaq, données SEC et manifestes horodatés."]];
sources.getRange("A18:F18").format = { fill: C.paleGreen, wrapText: true, borders: { preset: "outside", style: "thin", color: C.border } };
sources.getRange("A18:F18").format.rowHeight = 38;
sources.getRange("A1:A18").format.columnWidth = 9;
sources.getRange("B1:B18").format.columnWidth = 32;
sources.getRange("C1:C18").format.columnWidth = 24;
sources.getRange("D1:D18").format.columnWidth = 62;
sources.getRange("E1:E18").format.columnWidth = 22;
sources.getRange("F1:F18").format.columnWidth = 44;
sources.freezePanes.freezeRows(3);

// Executive summary (formula-backed)
title(summary, summary.getRange("A1:L1"), "SIDETRADE — JUSTIFICATION STATISTIQUE DU BÊTA WACC");
summary.getRange("A2:L2").merge();
summary.getRange("A2").values = [["Deux ans de rendements hebdomadaires | 104 observations | Données arrêtées à la semaine complète du 10 juillet 2026"]];
summary.getRange("A2:L2").format = { fill: C.lightGray, wrapText: true };
summary.getRange("A4:B4").merge(); summary.getRange("A4").values = [["Bêta statistique central"]];
summary.getRange("A5:B6").merge(); summary.getRange("A5").formulas = [["='Structure Capital'!B18"]];
summary.getRange("D4:E4").merge(); summary.getRange("D4").values = [["Bêta du modèle"]];
summary.getRange("D5:E6").merge(); summary.getRange("D5").formulas = [["='Structure Capital'!B20"]];
summary.getRange("G4:H4").merge(); summary.getRange("G4").values = [["Sensibilité Nasdaq"]];
summary.getRange("G5:H6").merge(); summary.getRange("G5").formulas = [["='Structure Capital'!B19"]];
summary.getRange("J4:K4").merge(); summary.getRange("J4").values = [["Contrôles officiels"]];
summary.getRange("J5:K6").merge(); summary.getRange("J5").formulas = [[`=COUNTIF('Controles'!J11:J${controlEnd},"PASS")`]];
for (const r of ["A4:B6", "D4:E6", "G4:H6", "J4:K6"]) summary.getRange(r).format = { fill: C.blue, borders: { preset: "outside", style: "thin", color: C.border }, font: { bold: true, color: C.dark }, verticalAlignment: "center", horizontalAlignment: "center" };
summary.getRange("A5:B6").format.numberFormat = fmt.beta;
summary.getRange("D5:E6").format.numberFormat = fmt.beta;
summary.getRange("G5:H6").format.numberFormat = fmt.beta;
summary.getRange("J5:K6").format.numberFormat = '0"/46"';
crossSheet(summary.getRange("A5:B6")); crossSheet(summary.getRange("D5:E6")); crossSheet(summary.getRange("G5:H6")); crossSheet(summary.getRange("J5:K6"));
section(summary, summary.getRange("A9:L9"), "COMPARABLES — BÊTAS PRINCIPAUX");
summary.getRange("A10:D10").values = [["Société", "Bêta levered", "Bêta unlevered", "D/E"]];
header(summary.getRange("A10:D10"));
for (let i = 0; i < 4; i++) {
  const r = 11 + i, sr = 6 + i;
  summary.getRange(`A${r}`).formulas = [[`='Structure Capital'!A${sr}`]];
  summary.getRange(`B${r}`).formulas = [[`='Structure Capital'!I${sr}`]];
  summary.getRange(`C${r}`).formulas = [[`='Structure Capital'!J${sr}`]];
  summary.getRange(`D${r}`).formulas = [[`='Structure Capital'!G${sr}`]];
}
crossSheet(summary.getRange("A11:D14"));
summary.getRange("B11:C14").format.numberFormat = fmt.beta;
summary.getRange("D11:D14").format.numberFormat = fmt.pct;
summary.getRange("A16:D16").values = [["Contrôle Sidetrade", "Bêta propre", "R²", "p-value"]];
header(summary.getRange("A16:D16"));
summary.getRange("A17").values = [["Sidetrade vs CAC 40"]];
summary.getRange("B17").formulas = [["='Regressions'!E6"]];
summary.getRange("C17").formulas = [["='Regressions'!H6"]];
summary.getRange("D17").formulas = [["='Regressions'!K6"]];
crossSheet(summary.getRange("B17:D17"));
summary.getRange("B17").format.numberFormat = fmt.beta;
summary.getRange("C17").format.numberFormat = fmt.pct2;
summary.getRange("D17").format.numberFormat = "0.000";
summary.getRange("A19:D21").merge();
summary.getRange("A19").values = [["Le bêta propre de Sidetrade n’est pas statistiquement significatif et explique moins de 1% de la variance hebdomadaire. Il est écarté du calcul central au profit de la médiane des quatre comparables désendettés, puis réendettée à la structure cible de Sidetrade."]];
summary.getRange("A19:D21").format = { fill: C.paleYellow, wrapText: true, borders: { preset: "outside", style: "thin", color: C.border }, verticalAlignment: "center" };

const chart = summary.charts.add("bar", summary.getRange("A10:C14"));
chart.title = "Bêtas des comparables — levered vs unlevered";
chart.hasLegend = true;
chart.yAxis = { numberFormatCode: "0.00x", min: 0 };
chart.setPosition("F10", "L23");

section(summary, summary.getRange("A25:L25"), "CONCLUSION POUR LE WACC");
summary.getRange("A27:L29").merge();
summary.getRange("A27").formulas = [["=\"La régression conduit à un bêta relevered central de \"&TEXT('Structure Capital'!B18,\"0.00x\")&\". Le bêta 1,15x déjà retenu dans le modèle est supérieur de \"&TEXT('Structure Capital'!B21,\"0.00x\")&\" et augmente le coût des fonds propres d’environ \"&TEXT('Structure Capital'!B23,\"0.00%\")&\" : son maintien est donc défendable comme choix prudent.\""]];
summary.getRange("A27:L29").format = { fill: C.paleGreen, font: { bold: true, color: C.dark }, wrapText: true, borders: { preset: "outside", style: "medium", color: "#70AD47" }, verticalAlignment: "center" };
summary.getRange("A31:L34").merge();
summary.getRange("A31").values = [["Méthode : clôtures quotidiennes ajustées Yahoo → dernière séance de chaque semaine → rendements logarithmiques → OLS → désendettement Hamada sur dette brute / capitalisation → médiane des peers → réendettement avec D/(D+E)=20% et IS 25,83%. Contrôles croisés Euronext et Nasdaq : 46/46 réussis."]];
summary.getRange("A31:L34").format = { fill: C.lightGray, wrapText: true, verticalAlignment: "center" };
summary.getRange("A1:A34").format.columnWidth = 22;
summary.getRange("B1:D34").format.columnWidth = 16;
summary.getRange("E1:L34").format.columnWidth = 14;
summary.freezePanes.freezeRows(2);

// Reapply dark title/section fonts.
for (const [sheet, ranges] of [
  [summary, ["A1:L1", "A9:L9", "A25:L25"]], [assumptions, ["A1:F1"]], [prices, ["A1:J1"]], [returns, ["A1:J1"]],
  [regressions, ["A1:N1", "A4:N4", "A13:N13"]], [capital, ["A1:M1", "A4:M4", "A12:M12"]],
  [controls, ["A1:J1", "A3:J3"]], [sources, ["A1:F1"]],
]) for (const r of ranges) sheet.getRange(r).format.font = { bold: true, color: C.white, name: "Arial" };

// Save interim, inspect, render every sheet, then export final.
const keyChecks = [
  await workbook.inspect({ kind: "table", range: "Synthese!A1:L34", include: "values,formulas", tableMaxRows: 34, tableMaxCols: 12, maxChars: 12000 }),
  await workbook.inspect({ kind: "table", range: "'Structure Capital'!A5:M25", include: "values,formulas", tableMaxRows: 25, tableMaxCols: 13, maxChars: 12000 }),
  await workbook.inspect({ kind: "table", range: "Regressions!A5:N19", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 14, maxChars: 12000 }),
  await workbook.inspect({ kind: "table", range: "Controles!A3:J18", include: "values,formulas", tableMaxRows: 18, tableMaxCols: 10, maxChars: 8000 }),
];
await fs.writeFile("../audit/workbook_key_inspection.ndjson", keyChecks.map((x) => x.ndjson).join("\n"), "utf8");
const errorScan = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|is not a function", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
await fs.writeFile("../audit/workbook_error_scan.ndjson", errorScan.ndjson, "utf8");

const renderRanges = {
  "Synthese": "A1:L34", "Hypotheses": "A1:F18", "Cours Hebdo": "A1:J24", "Rendements": "A1:J24",
  "Regressions": "A1:N22", "Structure Capital": "A1:M25", "Controles": "A1:J24", "Sources": "A1:F18",
};
for (const [sheetName, range] of Object.entries(renderRanges)) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(`${previewDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = `${outputDir}/Sidetrade_Analyse_Beta_2Y_Weekly_2026-07-15.xlsx`;
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, errorScan: errorScan.ndjson, sheets: Object.keys(renderRanges), controlEnd, manifestRetrievedAt: manifest.retrieved_at_utc }, null, 2));
