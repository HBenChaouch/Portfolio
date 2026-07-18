import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import CaseShell from "./components/CaseShell.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import { SidetradeScenarioProvider } from "./context/SidetradeScenarioContext.jsx";
import PortfolioHome from "./routes/PortfolioHome.jsx";
import AnalysisView from "./routes/AnalysisView.jsx";

const siteOrigin = "https://hbenchaouch.github.io";
const siteBase = "/Portfolio";

function RouteMetadata() {
  const location = useLocation();
  const { language, t } = useLanguage();
  const isSidetrade = location.pathname.startsWith("/cases/sidetrade-valuation");

  useEffect(() => {
    const title = t(isSidetrade
      ? "Sidetrade Valuation | Hamza Ben Chaouch"
      : "Hamza Ben Chaouch | Finance Portfolio");
    const description = t(isSidetrade
      ? "Sidetrade valuation case: QoE, cash conversion, DCF scenarios, comparables, LBO affordability and equity bridge."
      : "Finance portfolio by Hamza Ben Chaouch: Sidetrade valuation, Opella carve-out and a Real Estate downside cockpit.");
    const canonicalPath = isSidetrade ? "/cases/sidetrade-valuation/analysis" : "/";
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
  }, [isSidetrade, language, t]);

  return null;
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
        <Route path="*" element={<Navigate to={language === "en" ? "/?lang=en" : "/"} replace />} />
      </Routes>
    </>
  );
}
