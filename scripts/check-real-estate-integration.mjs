import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function extractPdfText(file) {
  const data = new Uint8Array(await readFile(file));
  const doc = await getDocument({ data, useSystemFonts: false, isEvalSupported: false }).promise;
  let text = "";
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  const pages = doc.numPages;
  await doc.cleanup();
  return { text: text.replace(/\s+/g, " ").trim(), pages };
}
const phrase = (words) => new RegExp(words.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"), "i");

const expectedCommit = "744a9cefa96bfe453581ad313e4b96896fa3004e";
const sourceCandidates = [process.env.REAL_ESTATE_SOURCE, ".cockpit-source", "../Real Estate/cockpit"]
  .filter(Boolean)
  .map((candidate) => path.resolve(candidate));
const destination = path.resolve("dist/cases/real-estate-downside");

async function sha256(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex").toUpperCase();
}

let source;
for (const candidate of sourceCandidates) {
  try {
    await readFile(path.join(candidate, "index.html"));
    source = candidate;
    break;
  } catch {
    // Continue through the explicit integration sources.
  }
}
assert.ok(source, `Cockpit source unavailable: ${sourceCandidates.join(", ")}`);
execFileSync(process.execPath, [path.join(source, "check-i18n.mjs")], { stdio: "inherit" });

for (const filename of [
  "index.html",
  "translations.js",
  "app.js",
  "data.js",
  "styles.css",
  "Note_synthese_cockpit.pdf",
  "pack/pack_comite_core_plus_france.xlsx",
]) {
  assert.equal(
    await sha256(path.join(destination, filename)),
    await sha256(path.join(source, filename)),
    `${filename} must be copied byte-for-byte from the pinned cockpit source`,
  );
}

const index = await readFile(path.join(destination, "index.html"), "utf8");
assert.match(index, /class="portfolio-back" href="\.\.\/\.\.\/"/);
assert.match(index, /← Portfolio/);
assert.match(index, /id="cockpit-section-navigation"/);
const nav = index.match(/<nav id="cockpit-section-navigation"[\s\S]*?<\/nav>/)?.[0] ?? "";
const shell = index.match(/<header class="cockpit-shell-header"[\s\S]*?<\/header>[\s\S]*?<aside id="cockpit-sidebar"[\s\S]*?<\/aside>/)?.[0] ?? "";
const shellHashes = [...shell.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(shellHashes, ["consolidation", "covenants", "stress", "portefeuille", "tresorerie", "commentaire", "ressources", "methodo"]);
assert.equal(new Set(shellHashes).size, 8);
assert.doesNotMatch(nav, /href="#analyse"/);
assert.doesNotMatch(index, /class="cockpit-nav-brand"[^>]*href=/);
assert.equal((index.match(/class="scenario-buttons"/g) ?? []).length, 1);
assert.equal((index.match(/id="scenario-base"/g) ?? []).length, 1);
assert.equal((index.match(/id="scenario-bear"/g) ?? []).length, 1);
assert.doesNotMatch(index, /target="_blank"/);
assert.doesNotMatch(index, /cockpit-fund-controlling\//);
assert.match(index, /Portfolio\/cases\/real-estate-downside\//);

// S21 — public editorial hygiene on the produced bundle (interface + text registry).
const translationsBuilt = await readFile(path.join(destination, "translations.js"), "utf8");
const publicSurface = `${index}\n${translationsBuilt}`;
for (const forbidden of [
  /claude/i,
  /anthropic/i,
  /sunburst/i,
  /intégration API/i,
  /API integration/i,
  /relu avant diffusion/i,
  /before distribution/i,
  /en production/i,
  /in production/i,
  /livrable de production/i,
  /production deliverable/i,
  /auto-recette/i,
  /13\/13/,
  /détail en console/i,
  /details in console/i,
  /voir console/i,
  /see console/i,
]) {
  assert.doesNotMatch(publicSurface, forbidden, `Public cockpit surface must not expose ${forbidden}`);
}
assert.match(translationsBuilt, /Générateur de commentaire de gestion/, "Neutral commentary title (FR) must be present");
assert.match(translationsBuilt, /Management-commentary generator/, "Neutral commentary title (EN) must be present");
for (const caveat of [
  /fictif/i,
  /fictional/i,
  /reporting réglementaire/i,
  /regulatory reporting/i,
  /valorisation indépendante/i,
  /independent valuation/i,
  /audit externe/i,
  /external audit/i,
]) {
  assert.match(translationsBuilt, caveat, `Substantive caveat must remain: ${caveat}`);
}

const deployment = JSON.parse(await readFile(path.join(destination, "deployment.json"), "utf8"));
assert.deepEqual(deployment, {
  source: "HBenChaouch/cockpit-fund-controlling",
  commit: expectedCommit,
});

// S21/remédiation — inspection réelle du texte du PDF public effectivement intégré.
const pdf = await extractPdfText(path.join(destination, "Note_synthese_cockpit.pdf"));
assert.equal(pdf.pages, 1, `Executive note must remain a single page (got ${pdf.pages})`);
for (const forbidden of [
  "recette automatique",
  "auto-recette",
  "IA générative",
  "assisté par IA",
  "IA accélère",
  "ne se diffuse",
  "12 contrôles",
  "détail en console",
  "hbenchaouch.github.io/cockpit-fund-controlling",
  // Framing de candidature/poste — le document doit rester transversal.
  "candidature",
  "missions du poste",
  "à l'appui d'une candidature",
  "recruteur",
]) {
  assert.doesNotMatch(pdf.text, phrase(forbidden), `Executive note must not contain "${forbidden}"`);
}
// "offre" borné au mot (évite coffre/souffre) ; "fund controller/controlling" restent autorisés (domaine du cas).
assert.doesNotMatch(pdf.text, /\boffres?\b/i, "Executive note must not reference a job offer");
assert.match(pdf.text, phrase("hbenchaouch.github.io/Portfolio/cases/real-estate-downside"), "Executive note must carry the Portfolio-integrated URL");
for (const required of ["fictif", "reporting réglementaire", "valorisation indépendante", "audit externe", "réconcili", "PASS / FAIL"]) {
  assert.match(pdf.text, phrase(required), `Executive note must retain "${required}"`);
}
for (const sentinel of ["317,4", "170,5", "46,9 %", "2,59x", "221,3", "100,00", "1,20x", "60 %"]) {
  assert.match(pdf.text, phrase(sentinel), `Executive note must keep the sentinel value "${sentinel}"`);
}

console.log(`Real Estate integration: pinned ${expectedCommit}; source-identical static build, downloads and executive-note text verified`);
