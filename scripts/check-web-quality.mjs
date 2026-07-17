import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { portfolioCases } from "../src/data/portfolioCases.js";

const rootUrl = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, rootUrl));
const text = async (path) => (await read(path)).toString("utf8");
const sha256 = async (path) => createHash("sha256").update(await read(path)).digest("hex").toUpperCase();

assert.deepEqual(portfolioCases.map(({ slug }) => slug), [
  "sidetrade-valuation",
  "opella-carve-out",
  "real-estate-downside",
]);
assert.equal(portfolioCases[0].priority, "flagship");
assert.equal(portfolioCases[1].download, "Modele_Carveout_Opella.xlsx");
assert.equal(portfolioCases[2].href, "https://hbenchaouch.github.io/cockpit-fund-controlling/");

assert.equal(
  await sha256("public/Sidetrade_Valuation_2026_v2.xlsx"),
  "B0D93B0A7BF346C2D02D90DC6F83D23C80D9422D902AF1E95E7CA40D385F8ECD",
);
assert.equal(
  await sha256("public/Modele_Carveout_Opella.xlsx"),
  "17E7C7FB54E71E979A9324417A111A316934B62CE11C31AD7927779F505F6494",
);

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
assert.match(workflow, /npm run test:quality/);
assert.match(workflow, /public\/deployment\.json/);
assert.match(workflow, /github\.sha/);
assert.match(workflow, /actions\/deploy-pages@v4/);
const styles = await text("src/styles/global.css");
assert.match(styles, /\.analysis-view \.result-strip \.cell[\s\S]*?min-width: 0/);

const packageJson = JSON.parse(await text("package.json"));
assert.equal(packageJson.dependencies["framer-motion"], undefined);
assert.equal(packageJson.scripts["test:workbook"], "node scripts/run-workbook-check.mjs");

console.log("Web quality registry: OK");
console.log("Portfolio projects: Sidetrade / Opella / Real Estate");
console.log("Downloads: 2 workbooks + 3 PDFs verified");
console.log("GitHub Pages metadata and SPA fallback: configured");
