import { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { translateText } from "../data/translations.js";

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
      const params = new URLSearchParams(location.search);
      if (nextLanguage === "en") params.set("lang", "en");
      else params.delete("lang");
      const search = params.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, { replace: true });
    },
  }), [language, location.hash, location.pathname, location.search, navigate]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
