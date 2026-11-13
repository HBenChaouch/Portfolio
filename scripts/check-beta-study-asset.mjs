import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";

const canonicalPath = path.resolve(
  "Analyse_Beta_2026/outputs/beta_sidetrade_20260715/Sidetrade_Analyse_Beta_2Y_Weekly_2026-07-15.xlsx",
);
const pinnedSha256 = "AC87815E9F4B6AC5D616C843147676B0C95ECFD02072F54FBB07D21ABAAE2573";

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex").toUpperCase();

const canonical = await readFile(canonicalPath);
assert.equal(sha256(canonical), pinnedSha256, "Canonical beta-study workbook hash must match the pin");

// Read the two narrative formula caches without depending on an Office runtime in CI.
function zipEntry(buffer, name) {
  for (let offset = 0; offset < buffer.length - 46; offset++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const length = buffer.readUInt16LE(offset + 28);
    if (buffer.toString("utf8", offset + 46, offset + 46 + length) !== name) continue;
    const local = buffer.readUInt32LE(offset + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const payload = buffer.subarray(start, start + buffer.readUInt32LE(offset + 20));
    const method = buffer.readUInt16LE(offset + 10);
    assert.ok(method === 0 || method === 8, "Supported ZIP compression");
    return (method === 8 ? inflateRawSync(payload) : payload).toString("utf8");
  }
  assert.fail(`Missing workbook part: ${name}`);
}
for (const [part, cell] of [["sheet1", "A27"], ["sheet6", "A25"]]) {
  const xml = zipEntry(canonical, `xl/worksheets/${part}.xml`);
  const content = xml.match(new RegExp(`<c\\b[^>]* r="${cell}"[^>]*>([\\s\\S]*?)</c>`))?.[1];
  assert.ok(content, `Narrative ${part}!${cell} exists`);
  assert.match(content, /ROUND\(/, "Narrative uses rounded numeric values rather than locale-sensitive TEXT formats");
  const cached = content.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  assert.match(cached, /1[.,]06x/);
  assert.match(cached, /0[.,]09x/);
  assert.match(cached, /0[.,]5%/);
}

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
