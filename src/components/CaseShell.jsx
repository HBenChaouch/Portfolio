import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";

const analysisBase = "/cases/sidetrade-valuation/analysis";

const sidebarGroups = [
  {
    label: "Investment case",
    items: [
      { title: "Executive view", hash: "executive" },
      { title: "Company & revenue", hash: "snapshot" },
      { title: "Quality of Earnings", hash: "qoe" },
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

function getLastSaved() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function scrollToSection(hash) {
  const el = document.getElementById(hash);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CaseShell() {
  const location = useLocation();
  const { activeScenario, setActiveScenario } = useSidetradeScenario();
  const [activeAnchor, setActiveAnchor] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAnalysis = location.pathname.endsWith("/analysis");
  const title = getCurrentTitle(location.pathname);
  const lastSaved = getLastSaved();

  const anchorIds = useMemo(
    () => sidebarGroups.flatMap((group) => group.items.map((item) => item.hash).filter(Boolean)),
    []
  );

  useEffect(() => {
    if (!isAnalysis) {
      setActiveAnchor("");
      return undefined;
    }

    if (location.hash) {
      window.requestAnimationFrame(() => scrollToSection(location.hash.slice(1)));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveAnchor(visible.target.id);
      },
      { rootMargin: "-12% 0px -68% 0px", threshold: 0 }
    );

    anchorIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [anchorIds, isAnalysis, location.hash]);

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
    history.replaceState(null, "", `${analysisBase}#${hash}`);
    scrollToSection(hash);
    setActiveAnchor(hash);
    setMobileNavOpen(false);
  }

  return (
    <div className="case-shell">
      <a className="skip-link" href="#main-content">Skip to analysis</a>
      <aside className="case-sidebar" aria-label="Sidetrade project navigation">
        <Link className="workspace" to="/">← Portfolio</Link>
        <span className="project-switcher-label">Choisir un projet</span>
        <button
          aria-controls="sidetrade-section-navigation"
          aria-expanded={mobileNavOpen}
          className="mobile-nav-toggle"
          onClick={() => setMobileNavOpen((open) => !open)}
          type="button"
        >
          <span>Sommaire</span>
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
                    href={`${analysisBase}#${item.hash}`}
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
          <span>Version 1.0</span>
          <span>Last saved {lastSaved}</span>
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
              <span className="control-date-full">Market ref. 15 Jul 2026</span>
              <span className="control-date-short">Market · 15 Jul 26</span>
            </span>
          </div>
        </header>
        <Outlet />
        <p className="view-rounding-note">Figures may not sum due to rounding.</p>
      </main>
    </div>
  );
}
