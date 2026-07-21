export const SIDETRADE_ANALYSIS_ROUTE = "/cases/sidetrade-valuation/analysis/";

function normaliseHash(hash = "") {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

export function buildSidetradeAnalysisLocation(language, hash = "") {
  return {
    pathname: SIDETRADE_ANALYSIS_ROUTE,
    search: language === "en" ? "?lang=en" : "",
    hash: normaliseHash(hash),
  };
}

export function buildLocalizedLocation(location, nextLanguage) {
  const params = new URLSearchParams(location.search);
  if (nextLanguage === "en") params.set("lang", "en");
  else params.delete("lang");
  const search = params.toString();

  return {
    pathname: location.pathname,
    search: search ? `?${search}` : "",
    hash: normaliseHash(location.hash),
  };
}

export function activeAnchorFromPositions(positions, activationLine, previous = "") {
  const ordered = positions
    .filter(({ id, top }) => id && Number.isFinite(top))
    .sort((a, b) => a.top - b.top);
  const passed = ordered.filter(({ top }) => top <= activationLine);
  const currentTop = passed.at(-1)?.top;
  const currentRow = passed.filter(({ top }) => Math.abs(top - currentTop) < 2);

  return currentRow.find(({ id }) => id === previous)?.id
    || currentRow[0]?.id
    || ordered[0]?.id
    || "";
}
