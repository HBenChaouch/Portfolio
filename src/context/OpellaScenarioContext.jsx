import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
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
  const readingPositionRef = useRef(null);
  const selections = useMemo(
    () => selectionsFromSearch(location.search),
    [location.search],
  );
  const result = useMemo(
    () => calculateOpella(opellaFinancials, selections),
    [selections],
  );
  const centralResult = useMemo(() => calculateOpella(opellaFinancials), []);
  const comparisons = useMemo(() => [
    { id: "active", output: result },
    { id: "central", output: centralResult },
    ...Object.entries(opellaFinancials.contracts.engine.levers).flatMap(([id]) => (
      ["basse", "haute"].map((state) => ({
        id: `${id}-${state}`,
        leverId: id,
        output: calculateOpella(opellaFinancials, { [id]: state }),
        state,
      }))
    )),
  ], [centralResult, result]);

  const captureReadingPosition = () => {
    const activeAnchor = document.activeElement?.closest?.("section[id]");
    const hashAnchor = location.hash ? document.querySelector(location.hash) : null;
    const anchor = activeAnchor ?? hashAnchor;
    if (!anchor?.id) return;
    readingPositionRef.current = {
      id: anchor.id,
      top: anchor.getBoundingClientRect().top,
    };
  };

  useLayoutEffect(() => {
    const readingPosition = readingPositionRef.current;
    if (!readingPosition) return;
    readingPositionRef.current = null;
    const anchor = document.getElementById(readingPosition.id);
    if (!anchor) return;
    window.scrollBy(0, anchor.getBoundingClientRect().top - readingPosition.top);
  }, [location.search]);

  const value = useMemo(() => ({
    comparisons,
    isCentral: Object.values(selections).every((state) => state === CENTRAL_STATE),
    reset() {
      captureReadingPosition();
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
      captureReadingPosition();
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
  }), [
    comparisons,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    result,
    selections,
  ]);

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
