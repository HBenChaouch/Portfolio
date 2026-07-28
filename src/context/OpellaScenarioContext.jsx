import { createContext, useContext, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { opellaFinancials } from "../data/opellaFinancials.js";
import { OPELLA_SCENARIO_PARAMS } from "../utils/navigation.js";
import { calculateOpella } from "../utils/opellaEngine.js";

const OpellaScenarioContext = createContext(null);

const URL_TO_ENGINE_STATE = Object.freeze({
  low: "basse",
  high: "haute",
});

const ENGINE_TO_URL_STATE = Object.freeze({
  basse: "low",
  haute: "high",
});

const CENTRAL_STATE = "centrale";

function selectionsFromSearch(search) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(Object.entries(OPELLA_SCENARIO_PARAMS).map(([id, parameter]) => [
    id,
    URL_TO_ENGINE_STATE[params.get(parameter)] ?? CENTRAL_STATE,
  ]));
}

export function OpellaScenarioProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const selections = useMemo(
    () => selectionsFromSearch(location.search),
    [location.search],
  );
  const result = useMemo(
    () => calculateOpella(opellaFinancials, selections),
    [selections],
  );

  const value = useMemo(() => ({
    isCentral: Object.values(selections).every((state) => state === CENTRAL_STATE),
    reset() {
      const params = new URLSearchParams(location.search);
      Object.values(OPELLA_SCENARIO_PARAMS).forEach((parameter) => params.delete(parameter));
      const search = params.toString();
      navigate({
        pathname: location.pathname,
        search: search ? `?${search}` : "",
        hash: location.hash,
      }, {
        preventScrollReset: true,
        replace: true,
      });
    },
    result,
    selections,
    setLever(id, state) {
      const parameter = OPELLA_SCENARIO_PARAMS[id];
      if (!parameter) return;
      const params = new URLSearchParams(location.search);
      const encoded = ENGINE_TO_URL_STATE[state];
      if (encoded) params.set(parameter, encoded);
      else params.delete(parameter);
      const search = params.toString();
      navigate({
        pathname: location.pathname,
        search: search ? `?${search}` : "",
        hash: location.hash,
      }, {
        preventScrollReset: true,
        replace: true,
      });
    },
  }), [location.hash, location.pathname, location.search, navigate, result, selections]);

  return (
    <OpellaScenarioContext.Provider value={value}>
      {children}
    </OpellaScenarioContext.Provider>
  );
}

export function useOpellaScenario() {
  const context = useContext(OpellaScenarioContext);
  if (!context) {
    throw new Error("useOpellaScenario must be used inside OpellaScenarioProvider");
  }
  return context;
}
