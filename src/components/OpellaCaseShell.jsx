import { useMemo } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  OPELLA_SCENARIO_PRESETS,
  opellaActivePresetId,
  useOpellaScenario,
} from "../context/OpellaScenarioContext.jsx";
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
  const { isCentral, reset, selections, setScenario } = useOpellaScenario();
  const copy = useMemo(() => createOpellaCopy(language), [language]);
  const activePreset = opellaActivePresetId(selections);
  const sidebarGroups = useMemo(() => opellaNavigation.map((group) => ({
    label: copy(group.label),
    items: group.items.map(([title, hash]) => ({ title: copy(title), hash })),
  })), [copy]);

  const controls = (
    <>
      <div
        aria-label={copy("shell.presetsLabel")}
        className="scenario-segment opella-control-presets"
        role="group"
      >
        {OPELLA_SCENARIO_PRESETS.map((preset) => (
          <button
            aria-pressed={activePreset === preset.id}
            className={activePreset === preset.id ? "active" : ""}
            key={preset.id}
            onClick={() => setScenario(preset.selections)}
            type="button"
          >
            {copy(`shell.preset.${preset.id}`)}
          </button>
        ))}
      </div>
      {activePreset === "custom" ? (
        <span className="opella-control-custom">{copy("shell.preset.custom")}</span>
      ) : null}
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
