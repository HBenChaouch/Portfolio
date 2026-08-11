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
const READING_POSITION_STABILIZATION_FRAMES = Object.keys(OPELLA_SCENARIO_PARAMS).length;
const READING_POSITION_TOLERANCE_PX = 1 / 2;

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
  const scenarioUniverse = useMemo(() => {
    const leverEntries = Object.entries(opellaFinancials.contracts.engine.levers);
    const combinations = leverEntries.reduce((items, [id, contract]) => (
      items.flatMap((item) => Object.keys(contract.states).map((state) => ({
        ...item,
        [id]: state,
      })))
    ), [{}]);
    return combinations.map((combination) => ({
      output: calculateOpella(opellaFinancials, combination),
      selections: combination,
    }));
  }, []);

  const captureReadingPosition = () => {
    const activeControl = document.activeElement?.closest?.("button, input, select, textarea");
    const activeAnchor = document.activeElement?.closest?.("section[id]");
    const hashAnchor = location.hash ? document.querySelector(location.hash) : null;
    const target = activeControl ?? activeAnchor ?? hashAnchor;
    if (!target) return;
    readingPositionRef.current = {
      element: target,
      id: target.id,
      top: target.getBoundingClientRect().top,
    };
  };

  useLayoutEffect(() => {
    const readingPosition = readingPositionRef.current;
    if (!readingPosition) return;
    readingPositionRef.current = null;
    let frame;
    let framesRemaining = READING_POSITION_STABILIZATION_FRAMES;

    function preserveReadingPosition() {
      const target = readingPosition.element?.isConnected
        ? readingPosition.element
        : readingPosition.id
          ? document.getElementById(readingPosition.id)
          : null;
      if (!target) return;
      const delta = target.getBoundingClientRect().top - readingPosition.top;
      if (Math.abs(delta) > READING_POSITION_TOLERANCE_PX) {
        window.scrollBy({ behavior: "instant", left: 0, top: delta });
      }
      framesRemaining -= 1;
      if (framesRemaining > 0) frame = window.requestAnimationFrame(preserveReadingPosition);
    }

    frame = window.requestAnimationFrame(preserveReadingPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [location.search]);

  const value = useMemo(() => ({
    centralResult,
    isCentral: Object.values(selections).every((state) => state === CENTRAL_STATE),
    reset() {
      window.dispatchEvent(new Event("portfolio:content-interaction"));
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
    scenarioUniverse,
    selections,
    setScenario(nextSelections) {
      window.dispatchEvent(new Event("portfolio:content-interaction"));
      captureReadingPosition();
      const params = new URLSearchParams(location.search);
      Object.entries(OPELLA_SCENARIO_PARAMS).forEach(([id, parameter]) => {
        const encoded = ENGINE_TO_URL_STATE[nextSelections[id]];
        if (encoded) params.set(parameter, encoded);
        else params.delete(parameter);
      });
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
    setLever(id, state) {
      const parameter = OPELLA_SCENARIO_PARAMS[id];
      if (!parameter) return;
      window.dispatchEvent(new Event("portfolio:content-interaction"));
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
    centralResult,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    result,
    scenarioUniverse,
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
