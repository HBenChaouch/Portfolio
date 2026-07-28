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
    assert.doesNotMatch(buyerMarkup, /(?:€|\b\d+(?:[.,]\d+)?\s*(?:%|x|M€|€m))/);
    assert.doesNotMatch(rendered, /\b(?:MOIC|TRI|IRR)\b/i);
    assert.doesNotMatch(rendered, /(?:download=|Modele_Carveout_Opella\.xlsx)/i);
  }
  for (const [language, rendered] of [["fr", opellaFr], ["en", opellaEn]]) {
    for (const message of opellaBundleManifest.requiredPublicMessages[language]) {
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
