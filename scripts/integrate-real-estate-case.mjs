import { execFileSync } from "node:child_process";
import { access, copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED_COMMIT = "c687ae732eedf834fcc644b896b8609c3536a516";
const candidates = [
  process.env.REAL_ESTATE_SOURCE,
  ".cockpit-source",
  "../Real Estate/cockpit",
].filter(Boolean).map((candidate) => path.resolve(candidate));

async function findSource() {
  for (const candidate of candidates) {
    try {
      await access(path.join(candidate, "index.html"));
      return candidate;
    } catch {
      // Try the next explicit source location.
    }
  }
  throw new Error(`Real Estate cockpit source not found. Checked: ${candidates.join(", ")}`);
}

const source = await findSource();
const sourceCommit = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (sourceCommit !== EXPECTED_COMMIT) {
  throw new Error(`Real Estate cockpit commit mismatch: expected ${EXPECTED_COMMIT}, received ${sourceCommit}`);
}

const destination = path.resolve("dist/cases/real-estate-downside");
await mkdir(destination, { recursive: true });

for (const filename of ["index.html", "translations.js", "app.js", "data.js", "styles.css", "Note_synthese_cockpit.pdf"]) {
  await copyFile(path.join(source, filename), path.join(destination, filename));
}

for (const directory of ["fonts", "pack"]) {
  await cp(path.join(source, directory), path.join(destination, directory), { recursive: true });
}

await writeFile(
  path.join(destination, "deployment.json"),
  `${JSON.stringify({ source: "HBenChaouch/cockpit-fund-controlling", commit: sourceCommit }, null, 2)}\n`,
  "utf8",
);

console.log(`Real Estate cockpit ${sourceCommit} integrated at dist/cases/real-estate-downside/`);
