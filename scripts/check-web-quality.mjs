import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { opellaPrimaryAnchors } from "../src/data/opellaCase.js";
import { portfolioCases } from "../src/data/portfolioCases.js";
import { listRelativeFiles, readJson } from "./integration-manifest.mjs";

const rootUrl = new URL("../", import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const read = (path) => readFile(new URL(path, rootUrl));
const text = async (path) => (await read(path)).toString("utf8");
const sha256 = async (path) => createHash("sha256").update(await read(path)).digest("hex").toUpperCase();
const markupText = (markup) => markup
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, "\"")
  .replace(/\s+/g, " ")
  .trim();
const attributeValues = (markup, attribute) => (
  [...markup.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1])
);

function tableFromCaption(markup, caption) {
  const marker = `<caption class="sr-only">${caption}</caption>`;
  const markerIndex = markup.indexOf(marker);
  assert.ok(markerIndex >= 0, `Missing table caption: ${caption}`);
  const tableStart = markup.lastIndexOf("<table", markerIndex);
  const tableEnd = markup.indexOf("</table>", markerIndex);
  assert.ok(tableStart >= 0 && tableEnd > markerIndex, `Incomplete table markup: ${caption}`);
  return markup.slice(tableStart, tableEnd + "</table>".length);
}

function firstTableWithin(markup, startMarker, endMarker) {
  const sectionStart = markup.indexOf(startMarker);
  const sectionEnd = markup.indexOf(endMarker, sectionStart);
  assert.ok(sectionStart >= 0 && sectionEnd > sectionStart, `Missing table section: ${startMarker}`);
  const tableStart = markup.indexOf("<table", sectionStart);
  const tableEnd = markup.indexOf("</table>", tableStart);
  assert.ok(tableStart >= 0 && tableStart < sectionEnd && tableEnd > tableStart, `Missing table in ${startMarker}`);
  return markup.slice(tableStart, tableEnd + "</table>".length);
}

function scopedHeaders(tableMarkup, scope) {
  return [...tableMarkup.matchAll(new RegExp(`<th[^>]*scope="${scope}"[^>]*>([\\s\\S]*?)</th>`, "g"))]
    .map((match) => markupText(match[1]));
}

function assertSimpleTableSemantics(tableMarkup, expectedColumns, label) {
  assert.deepEqual(scopedHeaders(tableMarkup, "col"), expectedColumns, `${label} column contract`);
  const tbody = tableMarkup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  const bodyRows = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  assert.ok(bodyRows.length > 0, `${label} must expose body rows`);
  for (const row of bodyRows) {
    assert.match(row, /^<th[^>]*scope="row"/, `${label} rows must begin with th scope="row"`);
    assert.equal(
      (row.match(/<(?:th|td)\b/g) ?? []).length,
      expectedColumns.length,
      `${label} row width must match its headers`,
    );
  }
}

assert.deepEqual(portfolioCases.map(({ slug }) => slug), [
  "sidetrade-valuation",
  "opella-carve-out",
  "real-estate-downside",
]);
assert.equal(portfolioCases[0].priority, "flagship");
assert.equal(portfolioCases[0].status, "Flagship case");
assert.equal(portfolioCases[1].status, "In development");
assert.equal(portfolioCases[1].available, false);
assert.equal(portfolioCases[1].href, undefined);
assert.equal(portfolioCases[1].download, undefined);
assert.equal(portfolioCases[2].status, "Operational cockpit");
assert.equal(portfolioCases[2].href, "/cases/real-estate-downside/");
assert.equal(portfolioCases[2].static, true);
assert.equal(portfolioCases[2].external, undefined);

assert.equal(
  await sha256("public/Sidetrade_Valuation_2026_v2.xlsx"),
  "B0D93B0A7BF346C2D02D90DC6F83D23C80D9422D902AF1E95E7CA40D385F8ECD",
);
await assert.rejects(() => read("public/Modele_Carveout_Opella.xlsx"), { code: "ENOENT" });
assert.match(await text("src/routes/OpellaAnalysisView.jsx"), /export default function OpellaAnalysisView/);

const publicFiles = await listRelativeFiles(path.join(rootPath, "public"));
assert.deepEqual(
  publicFiles.filter((filename) => /opella|carveout/i.test(filename)),
  [],
  "No Opella artifact may enter public/",
);

const opellaBundleManifest = await readJson(path.join(rootPath, "integrations", "opella", "manifest.json"));
const opellaSnapshot = await readJson(path.join(rootPath, "integrations", "opella", "snapshot.json"));
assert.equal(opellaBundleManifest.status, "inactive");
assert.deepEqual(opellaBundleManifest.downloads, []);
assert.ok(opellaBundleManifest.presentationFiles.includes("src/routes/OpellaAnalysisView.jsx"));
assert.deepEqual(opellaBundleManifest.publicExposure, {
  cardAvailable: false,
  route: true,
  href: false,
  cta: false,
  canonical: false,
  sitemap: false,
  fallback: false,
  download: false,
  publicWorkbook: false,
  publicBuildPage: true,
});

for (const file of [
  "public/PR_2025_Results_EN.pdf",
  "public/Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf",
  "public/260407_O2C_Intelligence_2030_PR_EN.pdf",
]) {
  assert.equal((await read(file)).subarray(0, 4).toString("ascii"), "%PDF", `${file} is not a PDF`);
}

const index = await text("index.html");
assert.match(index, /Hamza Ben Chaouch \| Finance Portfolio/);
assert.match(index, /rel="canonical" href="https:\/\/hbenchaouch\.github\.io\/Portfolio\/"/);
assert.match(index, /property="og:title"/);
assert.match(index, /name="twitter:card"/);
assert.match(index, /%BASE_URL%favicon\.svg/);

const viteConfig = await text("vite.config.js");
assert.match(viteConfig, /process\.env\.GITHUB_ACTIONS \? "\/Portfolio\/" : "\/"/);
const workflow = await text(".github/workflows/deploy-pages.yml");
for (const qualityGate of [
  "npm run test:audit",
  "npm run test:web",
  "npm run test:navigation",
  "npm run test:i18n",
  "npm run build",
  "npm run test:real-estate",
  "npm run test:navigation:browser",
]) {
  assert.match(workflow, new RegExp(qualityGate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(workflow, /public\/deployment\.json/);
assert.match(workflow, /github\.sha/);
assert.match(workflow, /enablement: true/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /repository: HBenChaouch\/cockpit-fund-controlling/);
assert.match(workflow, /ref: 6b8ddfe3dc48d581a4f1282ea2272c06a8d32337/);
const styles = await text("src/styles/global.css");
assert.match(styles, /\.analysis-view \.result-strip \.cell[\s\S]*?min-width: 0/);
assert.match(styles, /\.case-grid-item:first-child[\s\S]*?grid-row: span 2/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.case-grid-item:first-child[\s\S]*?grid-column: 1 \/ -1/);
const fallbackScript = await text("scripts/create-spa-fallback.mjs");
assert.match(fallbackScript, /cases\/sidetrade-valuation/);
assert.match(fallbackScript, /cases\/sidetrade-valuation\/analysis/);
assert.doesNotMatch(fallbackScript, /opella-carve-out/);
const sitemap = await text("public/sitemap.xml");
assert.match(sitemap, /Portfolio\/cases\/real-estate-downside\//);
assert.doesNotMatch(sitemap, /opella-carve-out/);

const caseShell = await text("src/components/CaseShell.jsx");
const portfolioCaseShell = await text("src/components/PortfolioCaseShell.jsx");
const navigation = await text("src/utils/navigation.js");
assert.match(navigation, /sidetrade-valuation\/analysis\//, "GitHub Pages anchor base must use the canonical trailing slash");
assert.match(caseShell, /mobileTitle="Sidetrade"/, "Mobile header must identify the active case");
assert.match(portfolioCaseShell, /setMobileNavOpen\(false\)/, "Mobile contents must close after an anchor selection");
assert.match(portfolioCaseShell, /aria-current=.*activeAnchor/, "The current section must be exposed to assistive technology");
assert.doesNotMatch(portfolioCaseShell, /history\.replaceState/, "Anchor changes must flow through React Router");
assert.match(portfolioCaseShell, /hash:\s*nextHash/, "Manual scrolling must update the router hash");

const languageContext = await text("src/context/LanguageContext.jsx");
assert.match(languageContext, /buildLocalizedLocation\(location, nextLanguage\)/, "Language changes must preserve the router hash");
assert.match(portfolioCaseShell, /userScrollIntentRef/, "The scroll spy must require explicit user scroll intent");
assert.match(portfolioCaseShell, /addEventListener\("wheel"/, "Wheel input must enable the scroll spy");
assert.match(portfolioCaseShell, /addEventListener\("scrollend"/, "Scroll intent must end on the browser scrollend event");
assert.match(portfolioCaseShell, /ResizeObserver\(geometryChanged\)/, "Anchors must reconverge after translated layout changes");
assert.match(portfolioCaseShell, /stableFrames < 2/, "Anchor restoration must use geometric stability instead of a timeout");
assert.doesNotMatch(portfolioCaseShell, /setTimeout/, "Anchor preservation must not depend on an arbitrary timeout");

const analysisView = await text("src/routes/AnalysisView.jsx");
const portfolioHome = await text("src/routes/PortfolioHome.jsx");
const app = await text("src/App.jsx");
const integrationScript = await text("scripts/integrate-real-estate-case.mjs");
assert.match(portfolioHome, /item\.static/);
assert.doesNotMatch(portfolioHome, /target="_blank"/);
assert.match(integrationScript, /dist\/cases\/real-estate-downside/);
assert.match(integrationScript, /6b8ddfe3dc48d581a4f1282ea2272c06a8d32337/);
assert.match(app, /path="\/cases\/opella-carve-out"/);
assert.match(app, /path="\/cases\/opella-carve-out\/analysis"/);
assert.doesNotMatch(integrationScript, /opella-carve-out/);
const chapterIndexPosition = analysisView.indexOf('className="desktop-chapter-index"');
const keyStatsPosition = analysisView.indexOf('className="keystats"');
assert.ok(
  chapterIndexPosition > -1 && chapterIndexPosition < keyStatsPosition,
  "Structural shortcuts must follow the introduction and precede key statistics",
);
assert.doesNotMatch(
  styles,
  /\.analysis-view \.hero\s*\{[^}]*min-height:\s*calc\(100vh - 76px\)/,
  "The analysis hero must not be forced to viewport height",
);
assert.doesNotMatch(analysisView, /calc\([^)]*%\s*\*/, "Football references must not use invalid calc multiplication");
assert.doesNotMatch(analysisView, /Hover any|Hover a|Survoler/, "Touch-accessible disclosures must replace hover-only instructions");
assert.match(analysisView, /className="chart-disclosures"/, "Trajectory values need touch and keyboard disclosures");
assert.match(analysisView, /className="transaction-cards"/, "Transaction comps need mobile disclosures");
assert.match(analysisView, /className="waterfall-mobile"/, "The EV-to-equity bridge needs a vertical mobile representation");
assert.match(styles, /\.analysis-view \.ff-reference-scale/, "Football references must share the range scale");
assert.match(styles, /\.analysis-view \.ff-guide-grid/, "Football reference guides must span the valuation rows");
assert.match(analysisView, /Only the DCF scenario marker responds to Bear \/ Base \/ Bull/, "Football field must explain scenario scope");
assert.match(analysisView, /The market reference sits near the least demanding IRR hurdle/, "Football field must explain the LBO high endpoint");
assert.match(styles, /\.analysis-view \.transaction-table\s*\{\s*display: none !important;/, "The wide transaction table must yield to mobile disclosures");

const removedSidebarAnchors = ["cash-conversion", "debt-like", "equity-bridge", "conclusions", "diligence", "conventions", "methodology"];
for (const hash of removedSidebarAnchors) {
  assert.doesNotMatch(caseShell, new RegExp(`title: [^\\n]+hash: "${hash}"`), `${hash} must not remain in the primary sidebar`);
  assert.match(analysisView, new RegExp(`id="${hash}"`), `${hash} content anchor must remain available`);
}
assert.equal((caseShell.match(/title: [^\n]+hash:/g) ?? []).length, 11, "Primary sidebar must expose exactly 11 destinations");
assert.match(styles, /@media \(min-width: 901px\) and \(max-height: 800px\)/, "Short desktop viewports need compact sidebar spacing");

const publicCopy = [
  await text("src/components/CaseShell.jsx"),
  await text("src/components/PortfolioCaseShell.jsx"),
  await text("src/data/portfolioCases.js"),
  await text("src/data/sidetradeFinancials.js"),
  await text("src/routes/AnalysisView.jsx"),
].join("\n");
assert.doesNotMatch(styles, /\bS\d+\b/, "Styles must not contain internal pass references");
for (const forbidden of [
  /refresh before distribution/i,
  /pedagogical/i,
  /independent model/i,
  /independent valuation/i,
  /audited engine/i,
  /canonical workbook/i,
  /Version 1\.0/i,
  /Last saved/i,
  /research recommendation/i,
  /investment advice/i,
  /\bwe\b/i,
  /\bour\b/i,
  /\*\*/,
  /â‚¬1\.5B/i,
  /modelled net debt in S\d+/i,
]) {
  assert.doesNotMatch(publicCopy, forbidden);
}
assert.match(publicCopy, /These items are excluded from modelled net debt unless confirmed through diligence\./);
assert.match(publicCopy, /Market data as of 15 July 2026/);

const packageJson = JSON.parse(await text("package.json"));
assert.equal(packageJson.dependencies["framer-motion"], undefined);
assert.equal(packageJson.scripts["test:workbook"], "node scripts/run-workbook-check.mjs");

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const [{ default: App }, { LanguageProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/App.jsx"),
    vite.ssrLoadModule("/src/context/LanguageContext.jsx"),
  ]);
  const renderRoute = (entry) => renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [entry] },
      createElement(LanguageProvider, null, createElement(App))),
  );
  const opellaFr = renderRoute("/cases/opella-carve-out/analysis/");
  const opellaEn = renderRoute("/cases/opella-carve-out/analysis/?lang=en");
  const heroContracts = [
    {
      forbidden: /(?:\bP\d+\b|Sortie du scénario sélectionné|Estimation illustrative|Calculé|Headline outputs)/i,
      markup: opellaFr,
      required: [
        "Opella — modèle de carve-out",
        "Que faut-il pour rendre Opella autonome — à quel coût, avec quel besoin de cash, dans quel délai et avec quels risques de dérive ?",
        "Le modèle mesure les coûts récurrents et ponctuels de la séparation, puis suit le besoin de financement jusqu’au régime établi.",
        "Montants arrondis à l’affichage",
        "IT 40 M€ · Support 30 M€ · Distribution 25 M€ · Qualité et réglementaire 25 M€",
        "TSA 99 M€ · Coûts ponctuels 152 M€ · Capex de séparation 45 M€",
        "Besoin cumulé maximal en FY2027",
        "Première année sans TSA ni coûts ponctuels",
        "FY2028",
      ],
    },
    {
      forbidden: /(?:\bP\d+\b|Selected-scenario output|Illustrative estimate|Calculated|Headline outputs)/i,
      markup: opellaEn,
      required: [
        "Opella carve-out model",
        "What does it take for Opella to stand on its own — at what cost, with how much cash, on what timeline, and with which execution risks?",
        "The model measures the recurring and one-off costs of separation, then tracks the funding need through to steady state.",
        "Amounts are rounded for display",
        "IT €40m · Support €30m · Distribution €25m · Quality &amp; regulatory €25m",
        "TSA €99m · One-offs €152m · Separation capex €45m",
        "Maximum cumulative need in FY2027",
        "First year with no TSA or one-offs",
        "FY2028",
      ],
    },
  ];
  for (const contract of heroContracts) {
    const heroStart = contract.markup.indexOf('class="opella-hero" id="executive"');
    const heroEnd = contract.markup.indexOf("opella-method", heroStart);
    const heroMarkup = contract.markup.slice(heroStart, heroEnd);
    const heroText = markupText(heroMarkup);
    for (const required of contract.required) {
      assert.ok(
        heroMarkup.includes(required) || heroText.includes(required),
        `Opella hero missing: ${required}`,
      );
    }
    assert.doesNotMatch(heroText, contract.forbidden, "Opella hero contains a forbidden label or period code");
  }
  const fundingSeriesContracts = [
    {
      caption: "Profil du besoin de financement par période",
      columns: ["Période", "Besoin cumulé", "Variation", "Écart récurrent", "Composante ponctuelle"],
      forbiddenBoundary: /(?:à la borne|à l’horizon)/i,
      markup: opellaFr,
    },
    {
      caption: "Funding-need profile by period",
      columns: ["Period", "Cumulative need", "Change", "Recurring gap", "One-off component"],
      forbiddenBoundary: /at the horizon/i,
      markup: opellaEn,
    },
  ];
  for (const contract of fundingSeriesContracts) {
    const fundingSeries = tableFromCaption(contract.markup, contract.caption);
    assertSimpleTableSemantics(fundingSeries, contract.columns, contract.caption);
    assert.doesNotMatch(
      markupText(fundingSeries),
      contract.forbiddenBoundary,
      `${contract.caption} must not apply a horizon label to P1-P4`,
    );
    const periodRowHeaders = scopedHeaders(fundingSeries, "row");
    assert.deepEqual(
      periodRowHeaders.map((header) => header.match(/^P[1-5]\b/)?.[0]),
      ["P1", "P2", "P3", "P4", "P5"],
      `${contract.caption} must preserve every snapshot period identifier`,
    );
  }

  const fundingStateContracts = [
    {
      columns: ["Indicateur", "Valeur", "Référence"],
      end: 'class="funding-counterfactual"',
      horizonReference: /H = P5\b/,
      markup: opellaFr,
      start: 'data-content-id="opella.funding.state"',
    },
    {
      columns: ["Indicator", "Value", "Reference"],
      end: 'class="funding-counterfactual"',
      horizonReference: /H = P5\b/,
      markup: opellaEn,
      start: 'data-content-id="opella.funding.state"',
    },
  ];
  for (const contract of fundingStateContracts) {
    const fundingState = firstTableWithin(contract.markup, contract.start, contract.end);
    assertSimpleTableSemantics(fundingState, contract.columns, contract.columns.join(" | "));
    assert.match(
      markupText(fundingState),
      contract.horizonReference,
      "The state summary must reserve its horizon reference for H=P5",
    );
  }

  const standaloneBridgeContracts = [
    {
      markup: opellaFr,
      title: "De l’EBITDA transactionnel au run-rate stand-alone — FY2024 à FY2029 (M€)",
    },
    {
      markup: opellaEn,
      title: "From transaction EBITDA to the stand-alone run-rate — FY2024 to FY2029 (€m)",
    },
  ];
  for (const contract of standaloneBridgeContracts) {
    const sectionStart = contract.markup.indexOf('id="standalone-build"');
    const sectionEnd = contract.markup.indexOf('id="tsa"', sectionStart);
    const bridgeMarkup = contract.markup.slice(sectionStart, sectionEnd);
    const ids = attributeValues(bridgeMarkup, "data-waterfall-id");
    const values = attributeValues(bridgeMarkup, "data-waterfall-value").map(Number);
    assert.match(markupText(bridgeMarkup), new RegExp(contract.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(ids, [
      "transaction-ebitda",
      "revenue-growth",
      "margin-expansion",
      "perimeter-subtotal",
      "allocations",
      "standalone-F-IT",
      "standalone-F-SUP",
      "standalone-F-DIS",
      "standalone-F-QUA",
      "output",
    ]);
    const bridgeValues = Object.fromEntries(ids.map((id, index) => [id, values[index]]));
    const perimeterReconciliation = bridgeValues["transaction-ebitda"]
      + bridgeValues["revenue-growth"]
      + bridgeValues["margin-expansion"];
    const outputReconciliation = perimeterReconciliation
      + bridgeValues.allocations
      + bridgeValues["standalone-F-IT"]
      + bridgeValues["standalone-F-SUP"]
      + bridgeValues["standalone-F-DIS"]
      + bridgeValues["standalone-F-QUA"];
    assert.ok(Math.abs(bridgeValues["revenue-growth"] - 182.0502669249) < 1e-9);
    assert.ok(Math.abs(bridgeValues["margin-expansion"] - 86.9455555725) < 1e-9);
    assert.ok(Math.abs(perimeterReconciliation - bridgeValues["perimeter-subtotal"]) < 1e-9);
    assert.ok(Math.abs(outputReconciliation - bridgeValues.output) < 1e-9);
    assert.ok(Math.abs(bridgeValues.output - 1384.7377484414) < 1e-9);
  }

  for (const rendered of [opellaFr, opellaEn]) {
    let previous = -1;
    for (const anchor of opellaPrimaryAnchors) {
      const position = rendered.indexOf(`id="${anchor}"`);
      assert.ok(position > previous, `Opella primary anchor order mismatch at ${anchor}`);
      previous = position;
    }
    assert.ok(rendered.indexOf('id="methodology"') > previous, "Opella methodology must remain a direct secondary anchor");
    assert.deepEqual(
      [...rendered.matchAll(/data-output-id="([^"]+)"/g)].map((match) => match[1]),
      ["O-RUNRATE", "O-SEPCOST", "O-PEAK", "O-STEADY"],
      "Executive view must contain only the four frozen Opella KPIs",
    );
    assert.equal(
      (rendered.match(/data-content-id="opella\.funding\.state"/g) ?? []).length,
      1,
      "O-RESORB must have one authoritative rendering under funding-need",
    );
    const buyerStart = rendered.indexOf('id="buyer-implications"');
    const diligenceStart = rendered.indexOf('id="diligence"');
    const buyerMarkup = rendered.slice(buyerStart, diligenceStart);
    assert.match(rendered, /class="opella-section opella-diligence-buyer" id="buyer-implications"/);
    assert.match(rendered, /class="opella-section opella-diligence-main" id="diligence"/);
    assert.doesNotMatch(buyerMarkup, /(?:€|\b\d+(?:[.,]\d+)?\s*(?:%|x|M€|€m))/);
    assert.doesNotMatch(rendered, /\b(?:MOIC|TRI|IRR)\b/i);
    assert.doesNotMatch(rendered, /(?:download=|Modele_Carveout_Opella\.xlsx)/i);

    const methodStart = rendered.indexOf('class="opella-method"');
    const transactionStart = rendered.indexOf('id="transaction"');
    const transactionEnd = rendered.indexOf('id="standalone-build"', transactionStart);
    const transactionScopeMarkup = rendered.slice(transactionStart, transactionEnd);
    assert.equal(rendered.indexOf('id="perimeter"'), -1, "The former perimeter section must be removed");
    assert.equal(
      (transactionScopeMarkup.match(/class="opella-transaction-scope-column"/g) ?? []).length,
      4,
      "Transaction & scope must expose exactly four Atlas-style columns",
    );
    assert.equal(
      (transactionScopeMarkup.match(/href="#sources"/g) ?? []).length,
      1,
      "Transaction & scope must keep one compact full-sources reference",
    );
    assert.doesNotMatch(
      transactionScopeMarkup,
      /source-reference-list|source-reference-block/,
      "Transaction & scope must not repeat source cards under individual values",
    );
    const outputPositions = ["O-RUNRATE", "O-SEPCOST", "O-PEAK", "O-STEADY"]
      .map((id) => rendered.indexOf(`data-output-id="${id}"`));
    assert.ok(
      outputPositions.every((position) => position > -1 && position < methodStart)
        && methodStart < transactionStart,
      "The four headline outputs must precede the compact method section and all disclosures",
    );
    assert.deepEqual(
      [...rendered.matchAll(/data-method-tab="([^"]+)"/g)].map((match) => match[1]),
      ["proof", "assumptions", "mechanics"],
      "The compact method section must expose exactly three tabs",
    );
    assert.deepEqual(
      [...rendered.matchAll(/data-proof-step="([^"]+)"/g)].map((match) => match[1]),
      ["1", "2", "3", "4"],
      "The default evidence chain must contain four compact steps",
    );
    assert.equal(
      (rendered.match(/data-assumption-key="/g) ?? []).length,
      6,
      "The structural-assumptions panel must contain exactly six rows",
    );
    assert.deepEqual(
      [...rendered.matchAll(/data-mechanic-key="([^"]+)"/g)].map((match) => match[1]),
      ["run-rate", "separation-cost", "funding-peak", "steady-state"],
      "Calculation mechanics must expose exactly four readable disclosures",
    );
    const assumptionsMarkup = rendered.slice(
      rendered.indexOf('id="opella-method-panel-assumptions"'),
      rendered.indexOf('id="opella-method-panel-mechanics"'),
    );
    assert.doesNotMatch(
      assumptionsMarkup,
      /(?:reference-revenue|implied-margin|Ancrage public|Valeur dérivée|Hypothèse modélisée|Public anchor|Derived value|Modelled assumption)/,
      "Structural assumptions must not repeat public anchors, derived values or nature labels",
    );
    const mechanicsMarkup = rendered.slice(
      rendered.indexOf('id="opella-method-panel-mechanics"'),
      rendered.indexOf('class="opella-method-links"'),
    );
    assert.doesNotMatch(
      markupText(mechanicsMarkup),
      /\b(?:O-RUNRATE|O-SEPCOST|O-PEAK|O-STEADY|M3|M4|M5|M6|M7|S4)\b/,
      "Calculation mechanics must not expose internal output, module or source identifiers",
    );
    assert.match(rendered, /aria-selected="true"[^>]*data-method-tab="proof"/);
    assert.match(rendered, /hidden="" id="opella-method-panel-assumptions"/);
    assert.match(rendered, /hidden="" id="opella-method-panel-mechanics"/);
    assert.match(rendered, /href="#methodology"/);
    assert.match(rendered, /href="#sources"/);
    assert.doesNotMatch(rendered, /opella-evidence-panel|opella-model-matrix|data-scenario-output-id/);
    const sourcesStart = rendered.indexOf('id="sources"');
    const sourcesMarkup = rendered.slice(sourcesStart);
    assert.equal(
      (sourcesMarkup.match(/data-source-registry-id="S[1-6]"/g) ?? []).length,
      6,
      "The compact register must preserve S1-S6",
    );
    assert.equal(
      (sourcesMarkup.match(/<summary>/g) ?? []).length,
      6,
      "Every source must expose an accessible disclosure",
    );

    const declaredSourceIds = new Set(opellaSnapshot.sources.map(({ id }) => id));
    const publicFacts = [...rendered.matchAll(/<(?:article|div|li|p|span)[^>]*data-public-fact-id="[^"]+"[^>]*>/g)]
      .map(([tag]) => [
        tag.match(/data-public-fact-id="([^"]+)"/)?.[1],
        tag.match(/data-source-ids="([^"]+)"/)?.[1],
      ]);
    assert.equal(publicFacts.length, 21, "Every remaining public fact rendering must declare its registry sources");
    for (const [factId, sourceIds] of publicFacts) {
      assert.ok(sourceIds, `${factId} must declare at least one source`);
      const ids = sourceIds.split("+");
      assert.ok(ids.length > 0, `${factId} must declare at least one source`);
      assert.ok(ids.every((id) => declaredSourceIds.has(id) && id !== "S4"), `${factId} has an invalid public source`);
    }

    const externalLinks = [...rendered.matchAll(/<a [^>]*target="_blank"[^>]*>/g)]
      .map((match) => match[0]);
    assert.ok(externalLinks.length > 0, "Opella must render direct official source links");
    for (const link of externalLinks) {
      assert.match(link, /aria-label="[^"]*(?:nouvel onglet|new tab)[^"]*"/i);
      assert.match(link, /rel="noopener noreferrer"/);
      assert.match(link, /data-source-id="S[12356]"/);
      assert.doesNotMatch(link, /data-source-id="S4"/);
      assert.doesNotMatch(link, /(?:google|bing|yahoo|duckduckgo|reuters|bloomberg)/i);
    }

    const renderedSourceUrls = new Set(attributeValues(rendered, "data-source-url"));
    for (const source of opellaSnapshot.sources) {
      for (const reference of source.references.filter(({ url }) => Boolean(url))) {
        assert.ok(
          renderedSourceUrls.has(reference.url),
          `${source.id} rendered link must match its registry entry`,
        );
      }
    }
    assert.doesNotMatch(rendered, /<a [^>]*data-source-id="S4"/);
    const s4Registry = rendered.slice(
      rendered.indexOf('data-source-registry-id="S4"'),
      rendered.indexOf('data-source-registry-id="S5"'),
    );
    assert.doesNotMatch(s4Registry, /<a\b/);
    assert.match(
      markupText(s4Registry),
      /(?:Hypothèse interne|Internal assumption).*(?:Non applicable|Not applicable)/i,
      "S4 must not look like a published public source",
    );
  }
  assert.deepEqual(
    attributeValues(opellaFr, "data-source-url"),
    attributeValues(opellaEn, "data-source-url"),
    "FR and EN must use the same source URLs in the same evidence positions",
  );
  assert.deepEqual(
    attributeValues(opellaFr, "data-source-location"),
    attributeValues(opellaEn, "data-source-location"),
    "FR and EN must use the same precise source locations",
  );
  for (const [language, rendered] of [["fr", opellaFr], ["en", opellaEn]]) {
    const supersededAuditMessages = new Set([
      "opella.source.evidenceToggle",
      "opella.source.forecastCaveat",
    ]);
    for (const message of opellaBundleManifest.requiredPublicMessages[language]) {
      if (supersededAuditMessages.has(message.id)) {
        assert.ok(!rendered.includes(message.value), `${language} Opella DOM retains superseded audit message ${message.id}`);
        continue;
      }
      assert.ok(rendered.includes(message.value), `${language} Opella DOM missing ${message.id}`);
    }
    for (const term of opellaBundleManifest.forbiddenPublicTerms[language]) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = /^[A-Z]{2,}$/.test(term) || term.toLowerCase() === "gate"
        ? `\\b${escaped}\\b`
        : escaped;
      assert.doesNotMatch(
        rendered,
        new RegExp(pattern, "i"),
        `${language} Opella DOM contains forbidden public term ${term}`,
      );
    }
  }
} finally {
  await vite.close();
}

console.log("Web quality registry: OK");
console.log("Portfolio projects: Sidetrade / Opella / Real Estate");
console.log("Downloads: 1 workbook + 3 PDFs verified; Opella downloads remain disabled");
console.log("GitHub Pages metadata and SPA fallback: configured");
