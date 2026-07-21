import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { translateText } from "../data/translations.js";
import { buildLocalizedLocation } from "../utils/navigation.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const transitionIdRef = useRef(0);
  const [languageTransition, setLanguageTransition] = useState(null);
  const language = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "fr";

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const completeLanguageTransition = useCallback((transitionId) => {
    setLanguageTransition((current) => current?.id === transitionId ? null : current);
  }, []);

  const value = useMemo(() => ({
    completeLanguageTransition,
    language,
    languageTransition,
    t: (text) => translateText(text, language),
    setLanguage(nextLanguage) {
      setLanguageTransition(location.hash ? {
        hash: location.hash,
        id: ++transitionIdRef.current,
      } : null);
      navigate(buildLocalizedLocation(location, nextLanguage), {
        preventScrollReset: true,
        replace: true,
      });
    },
  }), [completeLanguageTransition, language, languageTransition, location, navigate]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
