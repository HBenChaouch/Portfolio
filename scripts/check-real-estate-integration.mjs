import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const expectedCommit = "d97558d44fb038b0567ac62629650db3b8116aa4";
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

for (const filename of [
  "index.html",
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
assert.equal((index.match(/<nav id="cockpit-section-navigation"[\s\S]*?<\/nav>/)?.[0].match(/href="#/g) ?? []).length, 8);
assert.doesNotMatch(index.match(/<nav id="cockpit-section-navigation"[\s\S]*?<\/nav>/)?.[0] ?? "", /href="#analyse"/);
assert.doesNotMatch(index, /target="_blank"/);
assert.doesNotMatch(index, /cockpit-fund-controlling\//);
assert.match(index, /Portfolio\/cases\/real-estate-downside\//);

const deployment = JSON.parse(await readFile(path.join(destination, "deployment.json"), "utf8"));
assert.deepEqual(deployment, {
  source: "HBenChaouch/cockpit-fund-controlling",
  commit: expectedCommit,
});

console.log(`Real Estate integration: pinned ${expectedCommit}; source-identical static build and downloads`);
