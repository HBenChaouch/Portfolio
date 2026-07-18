import { useLanguage } from "../context/LanguageContext.jsx";

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div aria-label="Language / Langue" className={`language-toggle ${compact ? "compact" : ""}`} role="group">
      <button aria-pressed={language === "fr"} onClick={() => setLanguage("fr")} type="button">FR</button>
      <span aria-hidden="true">|</span>
      <button aria-pressed={language === "en"} onClick={() => setLanguage("en")} type="button">EN</button>
    </div>
  );
}
