import assert from "node:assert/strict";
import {
  activeAnchorFromPositions,
  buildLocalizedLocation,
  buildSidetradeAnalysisLocation,
} from "../src/utils/navigation.js";

const dcfGeometry = [
  { id: "market", top: -510 },
  { id: "dcf", top: 104 },
  { id: "trading", top: 2210 },
];
assert.equal(activeAnchorFromPositions(dcfGeometry, 120, "market"), "dcf");

const tradingGeometry = [
  { id: "dcf", top: -2100 },
  { id: "trading", top: 102 },
  { id: "transaction", top: 1130 },
];
const visibleAfterManualScroll = activeAnchorFromPositions(tradingGeometry, 120, "dcf");
assert.equal(visibleAfterManualScroll, "trading");
assert.deepEqual(buildSidetradeAnalysisLocation("fr", visibleAfterManualScroll), {
  pathname: "/cases/sidetrade-valuation/analysis/",
  search: "",
  hash: "#trading",
});

const englishFootball = buildLocalizedLocation({
  pathname: "/cases/sidetrade-valuation/analysis/",
  search: "",
  hash: "#football",
}, "en");
assert.deepEqual(englishFootball, {
  pathname: "/cases/sidetrade-valuation/analysis/",
  search: "?lang=en",
  hash: "#football",
});

assert.deepEqual(buildLocalizedLocation(englishFootball, "fr"), {
  pathname: "/cases/sidetrade-valuation/analysis/",
  search: "",
  hash: "#football",
});

const sharedRow = [
  { id: "diligence", top: 104 },
  { id: "conventions", top: 104 },
];
assert.equal(activeAnchorFromPositions(sharedRow, 120, "diligence"), "diligence");
assert.equal(activeAnchorFromPositions(sharedRow, 120, "conventions"), "conventions");

console.log("Navigation behavior: PASS (scroll hash + bilingual anchor preservation)");
