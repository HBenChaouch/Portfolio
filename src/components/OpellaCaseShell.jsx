import { useMemo } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useOpellaScenario } from "../context/OpellaScenarioContext.jsx";
import {
  createOpellaCopy,
  opellaNavigation,
  opellaPublicWorkbook,
} from "../data/opellaCase.js";
import {
  buildOpellaAnalysisLocation,
  OPELLA_ANALYSIS_ROUTE,
} from "../utils/navigation.js";
import PortfolioCaseShell from "./PortfolioCaseShell.jsx";

export default function OpellaCaseShell() {
  const { language } = useLanguage();
  const { isCentral, reset } = useOpellaScenario();
  const copy = useMemo(() => createOpellaCopy(language), [language]);
  const sidebarGroups = useMemo(() => opellaNavigation.map((group) => ({
    label: copy(group.label),
    items: group.items.map(([title, hash]) => ({ title: copy(title), hash })),
  })), [copy]);

  const controls = (
    <>
      <span className="opella-model-status">{copy("shell.status")}</span>
      <a
        className="opella-shell-download"
        download={opellaPublicWorkbook.file}
        href={opellaPublicWorkbook.href}
      >
        {copy("shell.download")}
      </a>
      <button
        className="opella-shell-reset"
        disabled={isCentral}
        onClick={reset}
        type="button"
      >
        {isCentral ? copy("shell.central") : copy("shell.reset")}
      </button>
    </>
  );

  return (
    <PortfolioCaseShell
      analysisRoute={OPELLA_ANALYSIS_ROUTE}
      brand={copy("shell.brand")}
      buildAnalysisLocation={buildOpellaAnalysisLocation}
      controls={controls}
      footerItems={[copy("shell.status")]}
      getPageTitle={() => copy("shell.title")}
      mobileTitle="Opella"
      navigationLabel={copy("shell.navigation")}
      roundingNote={copy("shell.rounding")}
      sectionNavigationId="opella-section-navigation"
      sectionNavigationLabel={copy("shell.sections")}
      sidebarGroups={sidebarGroups}
    />
  );
}
