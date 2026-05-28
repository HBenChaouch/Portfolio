import { createContext, useContext, useMemo, useState } from "react";
import { scenarioMeta } from "../data/sidetradeCase.js";
import { scenarioSummary } from "../utils/dcfEngine.js";

const SidetradeScenarioContext = createContext(null);

export function SidetradeScenarioProvider({ children }) {
  const [activeScenario, setActiveScenario] = useState("base");
  const scenario = { ...scenarioSummary(activeScenario), ...scenarioMeta[activeScenario] };

  const value = useMemo(
    () => ({ activeScenario, scenario, setActiveScenario }),
    [activeScenario, scenario]
  );

  return (
    <SidetradeScenarioContext.Provider value={value}>
      {children}
    </SidetradeScenarioContext.Provider>
  );
}

export function useSidetradeScenario() {
  const context = useContext(SidetradeScenarioContext);

  if (!context) {
    throw new Error("useSidetradeScenario must be used inside SidetradeScenarioProvider");
  }

  return context;
}
