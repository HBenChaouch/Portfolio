import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const canonicalPath = path.resolve(
  "Analyse_Beta_2026/outputs/beta_sidetrade_20260715/Sidetrade_Analyse_Beta_2Y_Weekly_2026-07-15.xlsx",
);
const pinnedSha256 = "C61AFD0AA743E322609958C14C1083FA6DFAE4F2642A3719360406D8B533503D";

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex").toUpperCase();

const canonical = await readFile(canonicalPath);
assert.equal(sha256(canonical), pinnedSha256, "Canonical beta-study workbook hash must match the pin");

const assetDir = path.resolve("dist/assets");
const emitted = (await readdir(assetDir)).filter((name) => name.endsWith(".xlsx"));
assert.equal(emitted.length, 1, `Exactly one emitted XLSX asset is expected, found: ${emitted.join(", ") || "none"}`);

const emittedBuffer = await readFile(path.join(assetDir, emitted[0]));
assert.equal(
  sha256(emittedBuffer),
  pinnedSha256,
  "The published beta-study asset must be byte-identical to the canonical tracked workbook",
);

console.log("Beta study asset: canonical pin OK, emitted copy byte-identical");
