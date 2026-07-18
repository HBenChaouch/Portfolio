import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dictionaries, languages, translateText } from "../src/data/translations.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

assert.deepEqual(languages, ["fr", "en"]);
assert.ok(Object.keys(dictionaries.fr).length > 150, "French dictionary must cover the full public case");
assert.deepEqual(Object.keys(dictionaries.fr), Object.keys(dictionaries.en));
assert.equal(translateText("Investment case", "fr"), "Cas d’investissement");
assert.equal(translateText("Investment case", "en"), "Investment case");
assert.equal(translateText("Quality of Earnings", "fr"), "Quality of Earnings");
assert.equal(translateText("DCF", "fr"), "DCF");
assert.equal(translateText("Choose a project", "fr"), "Choisir un projet");
assert.equal(translateText("Choose a project", "en"), "Choose a project");
assert.equal(
  translateText("Enterprise value €301m, less net debt €14.7m, equals equity value €286m and an implied share price of €186.", "fr"),
  "Valeur d’entreprise €301m, diminuée de la dette nette €14.7m, donne une valeur des capitaux propres de €286m et un cours implicite de €186.",
);
assert.doesNotMatch(Object.values(dictionaries.fr).join("\n"), /\b(?:timing|prices|an implied share price of)\b/i);

const [languageContext, main, app, home, shell, analysis, translations] = await Promise.all([
  read("src/context/LanguageContext.jsx"),
  read("src/main.jsx"),
  read("src/App.jsx"),
  read("src/routes/PortfolioHome.jsx"),
  read("src/components/CaseShell.jsx"),
  read("src/routes/AnalysisView.jsx"),
  read("src/data/translations.js"),
]);

assert.match(languageContext, /get\("lang"\) === "en" \? "en" : "fr"/);
assert.match(languageContext, /params\.delete\("lang"\)/);
assert.match(main, /<LanguageProvider>/);
assert.match(app, /language === "en" \? "\?lang=en" : ""/);
assert.match(home, /<LanguageToggle/);
assert.match(shell, /<LanguageToggle compact/);
assert.match(shell, /analysisHref/);
assert.match(analysis, /<Localized><article/);
assert.doesNotMatch(translations, /sidetradeFinancials|dcfEngine|lbo_engine/);
assert.doesNotMatch(`${home}\n${shell}\n${analysis}`, /toggle[^\n]*(?:USD|dollar)|(?:USD|dollar)[^\n]*toggle/i);

console.log(`i18n architecture: PASS (${Object.keys(dictionaries.fr).length} aligned FR/EN entries)`);
