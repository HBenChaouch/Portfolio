import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { VALUATION_DATES } from "../data/sidetradeFinancials.js";
import {
  activeAnchorFromPositions,
  buildSidetradeAnalysisLocation,
  SIDETRADE_ANALYSIS_ROUTE,
} from "../utils/navigation.js";
import LanguageToggle from "./LanguageToggle.jsx";
import Localized from "./Localized.jsx";

const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const analysisBase = `${appBase}${SIDETRADE_ANALYSIS_ROUTE}`;

const sidebarGroups = [
  {
    label: "Investment case",
    items: [
      { title: "Executive view", hash: "executive" },
      { title: "Company & revenue", hash: "snapshot" },
      { title: "Quality of Earnings", hash: "qoe" },
      { title: "Cash conversion & CIR", hash: "cash-conversion" },
      { title: "Net debt & debt-like", hash: "debt-like" },
      { title: "Market reference", hash: "market" },
    ],
  },
  {
    label: "Valuation",
    items: [
      { title: "DCF", hash: "dcf" },
      { title: "Trading comps", hash: "trading" },
      { title: "Transaction comps", hash: "transaction" },
      { title: "LBO", hash: "lbo" },
    ],
  },
  {
    label: "Synthesis",
    items: [
      { title: "Football field", hash: "football" },
      { title: "EV → Equity → Share", hash: "equity-bridge" },
      { title: "Conclusions", hash: "conclusions" },
    ],
  },
  {
    label: "Audit trail",
    items: [
      { title: "Red flags & limits", hash: "red-flags" },
      { title: "Diligence requests", hash: "diligence" },
      { title: "Conventions", hash: "conventions" },
      { title: "Methodology", hash: "methodology" },
      { title: "Sources", hash: "sources" },
    ],
  },
];

const pageTitles = {
  summary: "Valuation Summary",
  analysis: "Long-form Analysis",
  methodology: "Methodology",
  documents: "Sources",
};

const scenarioControls = [
  { id: "bear", label: "Bear" },
  { id: "base", label: "Base" },
  { id: "bull", label: "Bull" },
];

function getCurrentTitle(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const leaf = segments[segments.length - 1];
  return pageTitles[leaf] || "Long-form Analysis";
}

function scrollToSection(hash, behavior = "smooth") {
  const el = document.getElementById(hash);
  if (el) el.scrollIntoView({ behavior, block: "start" });
}

export default function CaseShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { activeScenario, setActiveScenario } = useSidetradeScenario();
  const [activeAnchor, setActiveAnchor] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeAnchorRef = useRef("");
  const skipNextHashScrollRef = useRef(false);
  const isAnalysis = location.pathname.replace(/\/+$/, "").endsWith("/analysis");
  const title = t(getCurrentTitle(location.pathname));
  const analysisHref = `${analysisBase}${language === "en" ? "?lang=en" : ""}`;

  const anchorIds = useMemo(
    () => sidebarGroups.flatMap((group) => group.items.map((item) => item.hash).filter(Boolean)),
    []
  );

  useEffect(() => {
    if (!isAnalysis) {
      activeAnchorRef.current = "";
      setActiveAnchor("");
      return undefined;
    }

    if (location.hash) {
      const directAnchor = location.hash.slice(1);
      activeAnchorRef.current = directAnchor;
      setActiveAnchor(directAnchor);
      if (skipNextHashScrollRef.current) skipNextHashScrollRef.current = false;
      else window.requestAnimationFrame(() => scrollToSection(directAnchor, "instant"));
    }

    let scrollFrame;

    function updateActiveAnchor() {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        const activationLine = window.innerWidth <= 900 ? 140 : 120;
        const positions = anchorIds
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((section) => ({ id: section.id, top: section.getBoundingClientRect().top }));
        const nextAnchor = activeAnchorFromPositions(positions, activationLine, activeAnchorRef.current);
        if (!nextAnchor) return;

        activeAnchorRef.current = nextAnchor;
        setActiveAnchor(nextAnchor);

        const nextHash = `#${nextAnchor}`;
        if (window.location.hash !== nextHash) {
          skipNextHashScrollRef.current = true;
          navigate({
            pathname: location.pathname,
            search: location.search,
            hash: nextHash,
          }, {
            preventScrollReset: true,
            replace: true,
          });
        }
      });
    }

    updateActiveAnchor();
    window.addEventListener("scroll", updateActiveAnchor, { passive: true });
    window.addEventListener("resize", updateActiveAnchor);

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", updateActiveAnchor);
      window.removeEventListener("resize", updateActiveAnchor);
    };
  }, [anchorIds, isAnalysis, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setMobileNavOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  function handleAnchorClick(event, hash) {
    if (!isAnalysis) return;
    event.preventDefault();
    scrollToSection(hash, "instant");
    activeAnchorRef.current = hash;
    setActiveAnchor(hash);
    skipNextHashScrollRef.current = true;
    navigate(buildSidetradeAnalysisLocation(language, hash), {
      preventScrollReset: true,
      replace: true,
    });
    setMobileNavOpen(false);
  }

  return (
    <Localized><div className="case-shell">
      <a className="skip-link" href="#main-content">Skip to analysis</a>
      <aside className="case-sidebar" aria-label="Sidetrade project navigation">
        <Link className="workspace" to={language === "en" ? "/?lang=en" : "/"}>← Portfolio</Link>
        <span className="project-switcher-label">Choose a project</span>
        <span className="mobile-project-title">Sidetrade</span>
        <button
          aria-controls="sidetrade-section-navigation"
          aria-expanded={mobileNavOpen}
          className="mobile-nav-toggle"
          onClick={() => setMobileNavOpen((open) => !open)}
          type="button"
        >
          <span>Contents</span>
          <span aria-hidden="true">{mobileNavOpen ? "×" : "+"}</span>
        </button>
        <div className="sidebar-brand">
          <span>Sidetrade · Valuation</span>
          <small>ALBFR.PA</small>
        </div>
        <nav
          className={`sidebar-nav ${mobileNavOpen ? "mobile-open" : ""}`}
          id="sidetrade-section-navigation"
          aria-label="Sidetrade sections"
        >
          {sidebarGroups.map((group, index) => (
            <div className="sidebar-group" key={group.label}>
              <div className="sidebar-group-title">{group.label}</div>
              {group.items.map((item) => {
                if (item.route) {
                  return (
                    <NavLink
                      className={({ isActive }) => [
                        "sidebar-entry",
                        item.strong ? "sidebar-entry-strong" : "",
                        isActive ? "active" : "",
                      ].filter(Boolean).join(" ")}
                      end
                      key={item.to}
                      to={item.to}
                    >
                      {item.title}
                    </NavLink>
                  );
                }

                return (
                  <a
                    aria-current={isAnalysis && activeAnchor === item.hash ? "location" : undefined}
                    className={[
                      "sidebar-entry",
                      isAnalysis && activeAnchor === item.hash ? "active" : "",
                    ].filter(Boolean).join(" ")}
                    href={`${analysisHref}#${item.hash}`}
                    key={item.hash}
                    onClick={(event) => handleAnchorClick(event, item.hash)}
                  >
                    {item.title}
                  </a>
                );
              })}
              {index < sidebarGroups.length - 1 ? <div className="sidebar-rule" /> : null}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>FY25 financials</span>
          <span>{VALUATION_DATES.marketLong}</span>
        </div>
      </aside>
      <main className="case-main" id="main-content" tabIndex="-1">
        <header className="case-control-bar">
          <div className="control-title">
            <span>Sidetrade · Valuation</span>
            <i />
            <span>{title}</span>
          </div>
          <div className="control-actions">
            <LanguageToggle compact />
            <div className="scenario-segment" role="group" aria-label="Scenario">
              {scenarioControls.map((scenario) => (
                <button
                  aria-pressed={activeScenario === scenario.id}
                  className={activeScenario === scenario.id ? "active" : ""}
                  key={scenario.id}
                  onClick={() => setActiveScenario(scenario.id)}
                  type="button"
                >
                  <span className={`scenario-dot ${scenario.id}`} />
                  {scenario.label}
                </button>
              ))}
            </div>
            <span className="control-date">
              <span className="control-date-full">Market ref. {VALUATION_DATES.marketMedium}</span>
              <span className="control-date-short">Market · {VALUATION_DATES.marketShort}</span>
            </span>
          </div>
        </header>
        <Outlet />
        <p className="view-rounding-note">Figures may not sum due to rounding.</p>
      </main>
    </div></Localized>
  );
}
