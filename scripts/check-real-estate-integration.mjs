import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const expectedCommit = "f5b03b96abc5768d2e3d9be695c420a8999e0f9a";
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

console.log(`Real Estate integration: pinned ${expectedCommit}; source-identical static build and downloads`);
