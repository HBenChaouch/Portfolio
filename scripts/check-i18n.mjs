import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { opellaCopyDictionaries } from "../src/data/opellaCase.js";
import { dictionaries, languages, translateText } from "../src/data/translations.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const attributeValues = (markup, attribute) => (
  [...markup.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1])
);

assert.deepEqual(languages, ["fr", "en"]);
assert.ok(Object.keys(dictionaries.fr).length > 150, "French dictionary must cover the full public case");
assert.deepEqual(Object.keys(dictionaries.fr), Object.keys(dictionaries.en));
assert.equal(translateText("Investment case", "fr"), "Cas d’investissement");
assert.equal(translateText("Investment case", "en"), "Investment case");
assert.equal(translateText("Quality of Earnings", "fr"), "Quality of Earnings");
assert.equal(translateText("DCF", "fr"), "DCF");
assert.equal(translateText("Choose a project", "fr"), "Choisir un projet");
assert.equal(translateText("Choose a project", "en"), "Choose a project");
const forbiddenFinancialLiteral = /[€$%]|\b\d+(?:[.,]\d+)?x\b/i;
const forbiddenOpellaFinancialLiteral = /(?:\b\d+(?:[.,]\d+)?\s*(?:M|Md|bn|m)?\s*[€$]|[€$]\s*\d+(?:[.,]\d+)?|%|\b\d+(?:[.,]\d+)?x\b)/i;
for (const [language, dictionary] of Object.entries(dictionaries)) {
  for (const [key, value] of Object.entries(dictionary)) {
    assert.doesNotMatch(key, forbiddenFinancialLiteral, `${language} dictionary key duplicates a financial literal: ${key}`);
    assert.doesNotMatch(value, forbiddenFinancialLiteral, `${language} dictionary value duplicates a financial literal: ${key}`);
    const keyDigits = key.replace(/\{\{\d+\}\}/g, "").replace(/\D/g, "");
    const valueNumbers = value.replace(/\{\{\d+\}\}/g, "").match(/\d+/g) || [];
    for (const number of valueNumbers) {
      assert.ok(keyDigits.includes(number), `${language} dictionary introduces a numeric literal absent from its key: ${key} -> ${value}`);
    }
  }
}
assert.deepEqual(
  Object.keys(opellaCopyDictionaries.fr),
  Object.keys(opellaCopyDictionaries.en),
  "Opella FR/EN content IDs must stay aligned",
);
assert.deepEqual(
  [
    opellaCopyDictionaries.fr["funding.periodChange"],
    opellaCopyDictionaries.fr["funding.periodRecurringGap"],
    opellaCopyDictionaries.fr["funding.periodOneOffGap"],
  ],
  ["Variation", "Écart récurrent", "Composante ponctuelle"],
  "French period-series headers must describe each row rather than the horizon",
);
assert.deepEqual(
  [
    opellaCopyDictionaries.en["funding.periodChange"],
    opellaCopyDictionaries.en["funding.periodRecurringGap"],
    opellaCopyDictionaries.en["funding.periodOneOffGap"],
  ],
  ["Change", "Recurring gap", "One-off component"],
  "English period-series headers must describe each row rather than the horizon",
);
assert.doesNotMatch(
  [
    opellaCopyDictionaries.fr["funding.periodChange"],
    opellaCopyDictionaries.fr["funding.periodRecurringGap"],
    opellaCopyDictionaries.fr["funding.periodOneOffGap"],
  ].join(" "),
  /(?:à la borne|à l’horizon)/i,
);
assert.doesNotMatch(
  [
    opellaCopyDictionaries.en["funding.periodChange"],
    opellaCopyDictionaries.en["funding.periodRecurringGap"],
    opellaCopyDictionaries.en["funding.periodOneOffGap"],
  ].join(" "),
  /at the horizon/i,
);
for (const [language, dictionary] of Object.entries(opellaCopyDictionaries)) {
  for (const [key, value] of Object.entries(dictionary)) {
    assert.doesNotMatch(
      value,
      forbiddenOpellaFinancialLiteral,
      `${language} Opella dictionary carries a financial literal: ${key}`,
    );
    const peer = opellaCopyDictionaries[language === "fr" ? "en" : "fr"][key];
    const slots = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    const peerSlots = [...peer.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(slots, peerSlots, `${key} must expose the same FR/EN message slots`);
  }
}

const frenchDomProbes = [
  "O2C/P2P · French SaaS · pre-buyout reference",
  "French listed O2C/P2P SaaS, exact same sector and geography. Pre-Bridgepoint take-private trading multiple. Best read-through to Sidetrade's standalone listed multiple.",
  "AP/AR automation + payments",
  "Vertical banking SaaS — profitable, sticky, multi-year contracts. Adds vertical-SaaS premium reference.",
  "Vertical SaaS banking",
  "Digital banking SaaS — comparable subscription mix and growth band.",
  "B2B network · profitable SaaS",
  "Reporting / compliance SaaS — Office-of-CFO adjacency, not direct O2C.",
  "~€179m (after ~€28m founder rollover)",
  "25% to 18%",
];
const forbiddenFrenchResidue = /\b(?:after|automation|banking|comparable subscription|exact same|founder rollover|geography|pre-buyout|profitable SaaS|reporting \/ compliance|to)\b/i;
for (const probe of frenchDomProbes) {
  const rendered = translateText(probe, "fr");
  assert.notEqual(rendered, probe, `French rendered-text probe was not localized: ${probe}`);
  assert.doesNotMatch(rendered, forbiddenFrenchResidue, `French rendered-text probe remains hybrid: ${rendered}`);
}
for (const accessibleName of [
  "Sidetrade project navigation",
  "Sidetrade sections",
  "Sidetrade analysis chapters",
  "Scenario",
  "DCF scenario",
  "Revenue and EBITDA chart",
  "DCF sensitivity table",
  "FCF view toggle",
  "EBITDA quality of earnings bridge",
  "FY25 statutory to normalised free cash flow bridge",
]) {
  const translatedName = translateText(accessibleName, "fr");
  assert.notEqual(translatedName, accessibleName, `Accessible name was not localized: ${accessibleName}`);
  assert.doesNotMatch(translatedName, /àggle|\b(?:chart|scenario)\b/i, `Accessible name remains hybrid: ${translatedName}`);
}
assert.equal(
  translateText("Enterprise value €301m, less net debt €14.7m, equals equity value €286m and an implied share price of €186.", "fr"),
  "Valeur d’entreprise €301m, diminuée de la dette nette €14.7m, donne une valeur des capitaux propres de €286m et un cours implicite de €186.",
);
assert.doesNotMatch(Object.values(dictionaries.fr).join("\n"), /\b(?:timing|prices|an implied share price of)\b/i);

const [
  languageContext,
  navigation,
  main,
  app,
  home,
  shell,
  portfolioShell,
  analysis,
  opellaAnalysis,
  translations,
] = await Promise.all([
  read("src/context/LanguageContext.jsx"),
  read("src/utils/navigation.js"),
  read("src/main.jsx"),
  read("src/App.jsx"),
  read("src/routes/PortfolioHome.jsx"),
  read("src/components/CaseShell.jsx"),
  read("src/components/PortfolioCaseShell.jsx"),
  read("src/routes/AnalysisView.jsx"),
  read("src/routes/OpellaAnalysisView.jsx"),
  read("src/data/translations.js"),
]);

assert.match(languageContext, /get\("lang"\) === "en" \? "en" : "fr"/);
assert.match(languageContext, /buildLocalizedLocation\(location, nextLanguage\)/);
assert.match(navigation, /params\.delete\("lang"\)/);
assert.match(navigation, /hash:\s*normaliseHash\(location\.hash\)/);
assert.match(main, /<LanguageProvider>/);
assert.match(app, /language === "en" \? "\?lang=en" : ""/);
assert.match(home, /<LanguageToggle/);
assert.match(portfolioShell, /<LanguageToggle compact/);
assert.match(portfolioShell, /analysisHref/);
assert.match(analysis, /<Localized><article/);
assert.match(opellaAnalysis, /createOpellaCopy\(language\)/);
assert.doesNotMatch(translations, /sidetradeFinancials|dcfEngine|lbo_engine/);
assert.doesNotMatch(`${home}\n${shell}\n${analysis}`, /toggle[^\n]*(?:USD|dollar)|(?:USD|dollar)[^\n]*toggle/i);

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const [{ default: App }, { LanguageProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/App.jsx"),
    vite.ssrLoadModule("/src/context/LanguageContext.jsx"),
  ]);
  const renderRoute = (entry) => renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [entry] },
      createElement(LanguageProvider, null, createElement(App))),
  );
  const frenchDom = renderRoute("/cases/sidetrade-valuation/analysis");
  const englishDom = renderRoute("/cases/sidetrade-valuation/analysis?lang=en");
  const frenchHome = renderRoute("/");
  const englishHome = renderRoute("/?lang=en");
  const opellaFrenchDom = renderRoute("/cases/opella-carve-out/analysis/");
  const opellaEnglishDom = renderRoute("/cases/opella-carve-out/analysis/?lang=en");
  const opellaEnglishHighCost = renderRoute(
    "/cases/opella-carve-out/analysis/?lang=en&op_cost=high#funding-need",
  );
  const forbiddenRenderedFrench = /exact same|pre-buyout reference|automation \+ payments|digital banking SaaS|profitable SaaS|reporting \/ compliance SaaS|after ~|founder rollover|subscription mix and growth band|sector et geography|Office-of-Adjacence|Vertical banking SaaS|Adds vertical-SaaS|stet-alone|àggle|25%\s+to\s+18%|174\s*€174/i;
  assert.doesNotMatch(frenchDom, forbiddenRenderedFrench, "Rendered French DOM contains English or hybrid residue");
  for (const expectedFrench of [
    "O2C/P2P · SaaS français · référence avant retrait de cote",
    "Automatisation AP/AR + paiements",
    "SaaS bancaire vertical",
    "SaaS de banque digitale",
    "Réseau B2B · SaaS rentable",
    "SaaS de reporting et de conformité",
    "Navigation du projet Sidetrade",
  ]) assert.match(frenchDom, new RegExp(expectedFrench.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const sentinel of ["€158m", "€301m", "€497m", "€411m"]) {
    assert.ok(frenchDom.includes(sentinel), `French DOM missing ${sentinel}`);
    assert.ok(englishDom.includes(sentinel), `English DOM missing ${sentinel}`);
  }
  assert.ok(frenchDom.includes("entre €13.7m et €14.7m"), "French DOM must preserve the exact QoE range");
  assert.ok(englishDom.includes("between €13.7m and €14.7m"), "English DOM must preserve the exact QoE range");
  assert.ok(frenchDom.includes("25% à 18%"), "French DOM must localize the segmented LBO range");
  assert.ok(englishDom.includes("25% down to 18%"), "English DOM must preserve the LBO range meaning");
  assert.ok(frenchDom.includes("€222,5m · TRI cible 25 %"), "French football field must localize LBO money and percentage typography");
  assert.ok(frenchDom.includes("€241,9m · TRI cible 22,5 %"), "French football field must localize the Base LBO reading");
  assert.ok(englishDom.includes("€222.5m · IRR target 25%"), "English football field must preserve LBO money and percentage typography");
  assert.ok(englishDom.includes("€241.9m · IRR target 22.5%"), "English football field must preserve the Base LBO reading");
  assert.equal(translateText("Revenue at €174/share", "fr"), "Chiffre d’affaires à €174 par action");
  for (const label of ["Cas principal", "En développement", "Cockpit opérationnel"]) {
    assert.ok(frenchHome.includes(label), `French home missing honest status: ${label}`);
  }
  for (const label of ["Flagship case", "In development", "Operational cockpit"]) {
    assert.ok(englishHome.includes(label), `English home missing honest status: ${label}`);
  }
  assert.doesNotMatch(frenchHome, /Modele_Carveout_Opella\.xlsx|Télécharger le workbook/);
  assert.doesNotMatch(englishHome, /Modele_Carveout_Opella\.xlsx|Download the workbook/);

  const visibleText = (markup) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const outputValue = (markup, outputId) => {
    const start = markup.indexOf(`data-output-id="${outputId}"`);
    const outputMarkup = markup.slice(start, markup.indexOf("</div>", start));
    return outputMarkup.match(/<strong>([^<]+)<\/strong>/)?.[1];
  };
  const opellaFrenchText = visibleText(opellaFrenchDom);
  const opellaEnglishText = visibleText(opellaEnglishDom);
  for (const expected of [
    "Opella — modèle de carve-out",
    "Que faut-il pour rendre Opella autonome — à quel coût, avec quel besoin de cash, dans quel délai et avec quels risques de dérive ?",
    "Montants arrondis à l’affichage",
  ]) assert.ok(opellaFrenchText.includes(expected), `French Opella hero missing: ${expected}`);
  for (const expected of [
    "Opella carve-out model",
    "What does it take for Opella to stand on its own — at what cost, with how much cash, on what timeline, and with which execution risks?",
    "Amounts are rounded for display",
  ]) assert.ok(opellaEnglishText.includes(expected), `English Opella hero missing: ${expected}`);
  for (const expected of [
    "Des faits publics aux quatre résultats",
    "Chaîne de preuve",
    "Hypothèses structurantes",
    "Mécanique de calcul",
  ]) assert.ok(opellaFrenchText.includes(expected), `French Opella method missing: ${expected}`);
  for (const expected of [
    "From public facts to four results",
    "Evidence chain",
    "Structural assumptions",
    "Calculation mechanics",
  ]) assert.ok(opellaEnglishText.includes(expected), `English Opella method missing: ${expected}`);
  assert.ok(opellaFrenchText.includes("Ouvrir la source originale"));
  assert.ok(opellaEnglishText.includes("Open original source"));
  for (const phrase of [
    "Télécharger le modèle",
    "Modèle Excel complet",
    "Télécharger le modèle Excel",
  ]) assert.ok(opellaFrenchText.includes(phrase), `French Opella download copy missing: ${phrase}`);
  for (const phrase of [
    "Download the model",
    "Complete Excel model",
    "Download the Excel model",
  ]) assert.ok(opellaEnglishText.includes(phrase), `English Opella download copy missing: ${phrase}`);
  assert.ok(
    opellaEnglishText.includes("including 1 month of double run"),
    "English Opella TSA copy must use the singular double-run form",
  );
  assert.deepEqual(
    attributeValues(opellaFrenchDom, "download"),
    ["Opella-Carveout-Model.xlsx", "Opella-Carveout-Model.xlsx"],
  );
  assert.deepEqual(
    attributeValues(opellaFrenchDom, "download"),
    attributeValues(opellaEnglishDom, "download"),
    "Opella FR/EN downloads must expose the same filename",
  );
  assert.deepEqual(
    attributeValues(opellaFrenchDom, "data-source-url"),
    attributeValues(opellaEnglishDom, "data-source-url"),
    "Opella FR/EN source URLs must remain identical",
  );
  assert.deepEqual(
    attributeValues(opellaFrenchDom, "data-source-location"),
    attributeValues(opellaEnglishDom, "data-source-location"),
    "Opella FR/EN source locations must remain identical",
  );
  for (const [outputId, frenchValue, englishValue] of [
    ["O-RUNRATE", "120 M€", "€120m"],
    ["O-SEPCOST", "296 M€", "€296m"],
    ["O-PEAK", "321 M€", "€321m"],
    ["O-STEADY", "FY2028", "FY2028"],
  ]) {
    assert.ok(opellaFrenchDom.includes(`data-output-id="${outputId}"`));
    assert.ok(opellaEnglishDom.includes(`data-output-id="${outputId}"`));
    assert.equal(outputValue(opellaFrenchDom, outputId), frenchValue, `French Opella DOM missing ${outputId}`);
    assert.equal(outputValue(opellaEnglishDom, outputId), englishValue, `English Opella DOM missing ${outputId}`);
  }
  for (const label of [
    "Coûts stand-alone récurrents",
    "Décalage de sortie des TSA",
    "Coûts ponctuels",
    "Croissance et marge",
  ]) assert.ok(opellaFrenchText.includes(label), `French Opella lever missing: ${label}`);
  for (const label of [
    "Recurring stand-alone costs",
    "TSA exit shift",
    "One-offs",
    "Growth and margin",
  ]) assert.ok(opellaEnglishText.includes(label), `English Opella lever missing: ${label}`);
  assert.doesNotMatch(
    opellaEnglishText,
    /\b(?:Calculé|Croissant|Hypothèses|Coûts|Périmètre|Régime|Résorbé)\b/i,
    "English Opella DOM contains French residue",
  );
  for (const rendered of [opellaFrenchDom, opellaEnglishDom]) {
    const scenarioMarkup = rendered.slice(
      rendered.indexOf('id="scenarios"'),
      rendered.indexOf('id="buyer-implications"'),
    );
    assert.doesNotMatch(
      scenarioMarkup,
      />\s*(?:Bear|Base|Bull)\s*</i,
      "Opella scenario controls must not reuse Sidetrade labels",
    );
  }
  assert.ok(
    visibleText(opellaEnglishHighCost).includes("€156m"),
    "English URL-serialized high-cost state must recompute the run-rate",
  );
} finally {
  await vite.close();
}

console.log(
  `i18n architecture: PASS (${Object.keys(dictionaries.fr).length} shared entries + ${Object.keys(opellaCopyDictionaries.fr).length} Opella entries)`,
);
