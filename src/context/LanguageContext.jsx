import { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { translateText } from "../data/translations.js";
import { buildLocalizedLocation } from "../utils/navigation.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const language = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "fr";

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    t: (text) => translateText(text, language),
    setLanguage(nextLanguage) {
      navigate(buildLocalizedLocation(location, nextLanguage), {
        preventScrollReset: true,
        replace: true,
      });
    },
  }), [language, location, navigate]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
