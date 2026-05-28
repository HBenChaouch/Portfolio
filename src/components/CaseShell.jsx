import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";

const sidebarGroups = [
  {
    label: null,
    items: [{ title: "Valuation Summary", to: "/cases/sidetrade-valuation/summary", strong: true }],
  },
  {
    label: "Overview",
    items: [
      { title: "Company snapshot", to: "/cases/sidetrade-valuation/snapshot" },
      { title: "Market reference", to: "/cases/sidetrade-valuation/market" },
    ],
  },
  {
    label: "Valuation",
    items: [
      { title: "DCF", to: "/cases/sidetrade-valuation/dcf" },
      { title: "Trading comps", to: "/cases/sidetrade-valuation/trading-comps" },
      { title: "Transaction comps", to: "/cases/sidetrade-valuation/transaction-comps" },
      { title: "LBO", to: "/cases/sidetrade-valuation/lbo" },
    ],
  },
  {
    label: "Synthesis",
    items: [
      { title: "Football field", to: "/cases/sidetrade-valuation/football-field" },
      { title: "Equity bridge", to: "/cases/sidetrade-valuation/equity-bridge" },
      { title: "Caveats", to: "/cases/sidetrade-valuation/caveats" },
    ],
  },
  {
    label: "Model",
    items: [
      { title: "Methodology", to: "/cases/sidetrade-valuation/methodology" },
      { title: "Sources", to: "/cases/sidetrade-valuation/sources" },
    ],
  },
  {
    label: "Documents",
    items: [{ title: "Source files", to: "/cases/sidetrade-valuation/documents" }],
  },
];

const pageTitles = {
  summary: "Valuation Summary",
  snapshot: "Company Snapshot",
  market: "Market Reference",
  dcf: "DCF",
  "trading-comps": "Trading Comps",
  "transaction-comps": "Transaction Comps",
  lbo: "LBO",
  "football-field": "Football Field",
  "equity-bridge": "Equity Bridge",
  caveats: "Caveats",
  methodology: "Methodology",
  sources: "Sources",
  documents: "Source Files",
};

const scenarioControls = [
  { id: "bear", label: "Bear" },
  { id: "base", label: "Base" },
  { id: "bull", label: "Bull" },
];

function getCurrentTitle(pathname) {
  const leaf = pathname.split("/").filter(Boolean).at(-1);
  return pageTitles[leaf] || "Valuation Summary";
}

function getLastSaved() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function CaseShell() {
  const location = useLocation();
  const { activeScenario, setActiveScenario } = useSidetradeScenario();
  const title = getCurrentTitle(location.pathname);
  const lastSaved = getLastSaved();

  return (
    <div className="case-shell">
      <aside className="case-sidebar">
        <Link className="workspace" to="/">Workspace</Link>
        <div className="sidebar-brand">
          <span>Project Alpha</span>
          <small>Valuation Summary</small>
        </div>
        <nav className="sidebar-nav" aria-label="Case navigation">
          {sidebarGroups.map((group, index) => (
            <div className="sidebar-group" key={group.label || "summary"}>
              {group.label ? <div className="sidebar-group-title">{group.label}</div> : null}
              {group.items.map((item) => (
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
              ))}
              {index < sidebarGroups.length - 1 ? <div className="sidebar-rule" /> : null}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>Version 1.0</span>
          <span>Last saved {lastSaved}</span>
        </div>
      </aside>
      <main className="case-main">
        <header className="case-control-bar">
          <div className="control-title">
            <span>Project Alpha</span>
            <i />
            <span>{title}</span>
          </div>
          <div className="control-actions">
            <div className="scenario-segment" role="group" aria-label="Scenario">
              {scenarioControls.map((scenario) => (
                <button
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
            <button className="control-button" type="button">EUR ▾</button>
            <span className="control-date">09 May 2025</span>
            <button className="control-menu" type="button" aria-label="More options">...</button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
