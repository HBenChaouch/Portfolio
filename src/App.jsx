import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import CaseShell from "./components/CaseShell.jsx";
import OpellaCaseShell from "./components/OpellaCaseShell.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import { OpellaScenarioProvider } from "./context/OpellaScenarioContext.jsx";
import { SidetradeScenarioProvider } from "./context/SidetradeScenarioContext.jsx";
import PortfolioHome from "./routes/PortfolioHome.jsx";
import AnalysisView from "./routes/AnalysisView.jsx";
import OpellaAnalysisView from "./routes/OpellaAnalysisView.jsx";
import { OPELLA_ANALYSIS_ROUTE } from "./utils/navigation.js";

const siteOrigin = "https://hbenchaouch.github.io";
const siteBase = "/Portfolio";

function RouteMetadata() {
  const location = useLocation();
  const { language, t } = useLanguage();
  const isSidetrade = location.pathname.startsWith("/cases/sidetrade-valuation");
  const isOpella = location.pathname.startsWith("/cases/opella-carve-out");
  const titleKey = isSidetrade
    ? "Sidetrade Valuation | Hamza Ben Chaouch"
    : isOpella
      ? "Opella Carve-out Analysis | Hamza Ben Chaouch"
      : "Hamza Ben Chaouch | Finance Portfolio";
  const descriptionKey = isSidetrade
    ? "Sidetrade valuation case: QoE, cash conversion, DCF scenarios, comparables, LBO affordability and equity bridge."
    : isOpella
      ? "Illustrative Opella carve-out analysis: stand-alone build, TSA exit, separation costs and funding need."
      : "Finance portfolio by Hamza Ben Chaouch: Sidetrade valuation, Opella carve-out and a Real Estate downside cockpit.";

  useEffect(() => {
    const title = t(titleKey);
    const description = t(descriptionKey);
    const canonicalPath = isSidetrade
      ? "/cases/sidetrade-valuation/analysis"
      : isOpella
        ? "/cases/opella-carve-out/analysis"
        : "/";
    const languageQuery = language === "en" ? "?lang=en" : "";

    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", description);
    document.querySelector('link[rel="canonical"]')?.setAttribute(
      "href",
      `${siteOrigin}${siteBase}${canonicalPath}${languageQuery}`,
    );
  }, [descriptionKey, isSidetrade, language, t, titleKey]);

  return null;
}

function OpellaAliasRedirect() {
  const location = useLocation();
  return (
    <Navigate
      replace
      to={{
        pathname: OPELLA_ANALYSIS_ROUTE,
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}

export default function App() {
  const { language } = useLanguage();
  return (
    <>
      <RouteMetadata />
      <Routes>
        <Route path="/" element={<PortfolioHome />} />
        <Route
          path="/cases/sidetrade-valuation"
          element={
            <SidetradeScenarioProvider>
              <CaseShell />
            </SidetradeScenarioProvider>
          }
        >
          <Route index element={<AnalysisView />} />
          <Route path="analysis" element={<AnalysisView />} />
        </Route>
        <Route path="/cases/opella-carve-out" element={<OpellaAliasRedirect />} />
        <Route
          path="/cases/opella-carve-out/analysis"
          element={
            <OpellaScenarioProvider>
              <OpellaCaseShell />
            </OpellaScenarioProvider>
          }
        >
          <Route index element={<OpellaAnalysisView />} />
        </Route>
        <Route path="*" element={<Navigate to={language === "en" ? "/?lang=en" : "/"} replace />} />
      </Routes>
    </>
  );
}
