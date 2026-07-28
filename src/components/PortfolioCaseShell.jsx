import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { activeAnchorFromPositions } from "../utils/navigation.js";
import LanguageToggle from "./LanguageToggle.jsx";
import Localized from "./Localized.jsx";

const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");

function normalisePath(pathname) {
  return pathname.replace(/\/+$/, "");
}

function scrollToSection(hash, behavior = "smooth") {
  const element = document.getElementById(hash);
  if (element) element.scrollIntoView({ behavior, block: "start" });
}

export default function PortfolioCaseShell({
  analysisRoute,
  buildAnalysisLocation,
  brand,
  brandDetail,
  controls,
  footerItems = [],
  getPageTitle,
  mobileTitle,
  navigationLabel,
  roundingNote,
  sectionNavigationId = "case-section-navigation",
  sectionNavigationLabel,
  sidebarGroups,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [activeAnchor, setActiveAnchor] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeAnchorRef = useRef("");
  const keptAnchorRef = useRef("");
  const mobileToggleRef = useRef(null);
  const scrollSpyHashRef = useRef("");
  const userScrollIntentRef = useRef(false);
  const isAnalysis = normalisePath(location.pathname) === normalisePath(analysisRoute);
  const title = t(getPageTitle(location.pathname));
  const analysisHref = `${appBase}${analysisRoute}${location.search}`;

  const anchorIds = useMemo(
    () => sidebarGroups.flatMap((group) => group.items.map((item) => item.hash).filter(Boolean)),
    [sidebarGroups],
  );

  useLayoutEffect(() => {
    if (!isAnalysis || !location.hash) {
      keptAnchorRef.current = "";
      return undefined;
    }

    if (scrollSpyHashRef.current === location.hash) {
      scrollSpyHashRef.current = "";
      return undefined;
    }

    const anchor = location.hash.slice(1);
    keptAnchorRef.current = anchor;
    userScrollIntentRef.current = false;
    activeAnchorRef.current = anchor;
    setActiveAnchor(anchor);

    let anchorFrame;
    let lastDocumentHeight = -1;
    let lastTargetTop = Number.NaN;
    let stableFrames = 0;

    function convergeOnAnchor() {
      if (keptAnchorRef.current !== anchor) return;
      const target = document.getElementById(anchor);
      if (!target) {
        anchorFrame = window.requestAnimationFrame(convergeOnAnchor);
        return;
      }

      target.scrollIntoView({ behavior: "instant", block: "start" });
      const targetTop = target.getBoundingClientRect().top;
      const documentHeight = document.documentElement.scrollHeight;
      const geometryIsStable = Math.abs(targetTop - lastTargetTop) < 0.5
        && documentHeight === lastDocumentHeight;

      stableFrames = geometryIsStable ? stableFrames + 1 : 0;
      lastTargetTop = targetTop;
      lastDocumentHeight = documentHeight;
      if (stableFrames < 2) anchorFrame = window.requestAnimationFrame(convergeOnAnchor);
    }

    function geometryChanged() {
      if (keptAnchorRef.current !== anchor) return;
      stableFrames = 0;
      window.cancelAnimationFrame(anchorFrame);
      anchorFrame = window.requestAnimationFrame(convergeOnAnchor);
    }

    convergeOnAnchor();

    const observedLayout = document.getElementById("main-content");
    const layoutObserver = observedLayout && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(geometryChanged)
      : null;
    if (layoutObserver) layoutObserver.observe(observedLayout);

    return () => {
      window.cancelAnimationFrame(anchorFrame);
      layoutObserver?.disconnect();
    };
  }, [isAnalysis, location.hash, location.search]);

  useEffect(() => {
    if (!isAnalysis) return undefined;

    function beginUserScrollIntent() {
      keptAnchorRef.current = "";
      userScrollIntentRef.current = true;
    }

    function handleScrollKey(event) {
      if (![
        "ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " ",
      ].includes(event.key)) return;
      if (event.target instanceof Element
        && event.target.closest("button, input, select, textarea, [contenteditable='true']")) return;
      beginUserScrollIntent();
    }

    function handleScrollbarPointer(event) {
      if (event.button === 0 && event.clientX >= document.documentElement.clientWidth) {
        beginUserScrollIntent();
      }
    }

    function endUserScrollIntent() {
      userScrollIntentRef.current = false;
    }

    window.addEventListener("wheel", beginUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", beginUserScrollIntent, { passive: true });
    window.addEventListener("keydown", handleScrollKey);
    window.addEventListener("pointerdown", handleScrollbarPointer);
    window.addEventListener("scrollend", endUserScrollIntent, { capture: true });

    return () => {
      window.removeEventListener("wheel", beginUserScrollIntent);
      window.removeEventListener("touchmove", beginUserScrollIntent);
      window.removeEventListener("keydown", handleScrollKey);
      window.removeEventListener("pointerdown", handleScrollbarPointer);
      window.removeEventListener("scrollend", endUserScrollIntent, { capture: true });
    };
  }, [isAnalysis]);

  useEffect(() => {
    if (!isAnalysis) {
      activeAnchorRef.current = "";
      setActiveAnchor("");
      return undefined;
    }

    let scrollFrame;

    function updateActiveAnchor() {
      if (!userScrollIntentRef.current) return;
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
          scrollSpyHashRef.current = nextHash;
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

    window.addEventListener("scroll", updateActiveAnchor, { passive: true });

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", updateActiveAnchor);
    };
  }, [anchorIds, isAnalysis, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setMobileNavOpen(false);
      window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  function handleAnchorClick(event, hash) {
    if (!isAnalysis) return;
    event.preventDefault();
    scrollToSection(hash, "instant");
    keptAnchorRef.current = hash;
    scrollSpyHashRef.current = "";
    userScrollIntentRef.current = false;
    activeAnchorRef.current = hash;
    setActiveAnchor(hash);
    navigate(buildAnalysisLocation(language, hash, location.search), {
      preventScrollReset: true,
      replace: true,
    });
    setMobileNavOpen(false);
  }

  return (
    <Localized><div className="case-shell">
      <a className="skip-link" href="#main-content">Skip to analysis</a>
      <aside className="case-sidebar" aria-label={navigationLabel}>
        <Link className="workspace" to={language === "en" ? "/?lang=en" : "/"}>← Portfolio</Link>
        <span className="project-switcher-label">Choose a project</span>
        <span className="mobile-project-title">{mobileTitle}</span>
        <button
          aria-controls={sectionNavigationId}
          aria-expanded={mobileNavOpen}
          className="mobile-nav-toggle"
          onClick={() => setMobileNavOpen((open) => !open)}
          ref={mobileToggleRef}
          type="button"
        >
          <span>Contents</span>
          <span aria-hidden="true">{mobileNavOpen ? "×" : "+"}</span>
        </button>
        <div className="sidebar-brand">
          <span>{brand}</span>
          {brandDetail ? <small>{brandDetail}</small> : null}
        </div>
        <nav
          className={`sidebar-nav ${mobileNavOpen ? "mobile-open" : ""}`}
          id={sectionNavigationId}
          aria-label={sectionNavigationLabel}
        >
          {sidebarGroups.map((group, index) => (
            <div className="sidebar-group" key={group.label}>
              <div className="sidebar-group-title">{group.label}</div>
              {group.items.map((item) => (
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
              ))}
              {index < sidebarGroups.length - 1 ? <div className="sidebar-rule" /> : null}
            </div>
          ))}
        </nav>
        {footerItems.length ? (
          <div className="sidebar-foot">
            {footerItems.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : null}
      </aside>
      <main className="case-main" id="main-content" tabIndex="-1">
        <header className="case-control-bar">
          <div className="control-title">
            <span>{brand}</span>
            <i />
            <span>{title}</span>
          </div>
          <div className="control-actions">
            <LanguageToggle compact />
            {controls}
          </div>
        </header>
        <Outlet />
        {roundingNote ? <p className="view-rounding-note">{roundingNote}</p> : null}
      </main>
    </div></Localized>
  );
}
