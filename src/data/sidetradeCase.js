export const scenarioMeta = {
  bear: {
    id: "bear",
    label: "Bear",
    short: "Cautious case",
    title: "A profile that decelerates",
    narrative:
      "Organic growth slows despite acquisitions. Integration remains dilutive for longer, AI monetisation stays early, and EBITDA margin caps below the bottom of the 2030 guidance band.",
  },
  base: {
    id: "base",
    label: "Base",
    short: "2025 trajectory holds",
    title: "The 2025 trajectory holds",
    narrative:
      "Growth remains supported by subscriptions, North America, acquisitions and the O2C Intelligence 2030 plan. EBITDA margin reaches 32%, in the middle of management's long-term target range.",
  },
  bull: {
    id: "bull",
    label: "Bull",
    short: "AI-native scales",
    title: "AI-native changes the equation",
    narrative:
      "Aimie adoption scales beyond initial enterprise signings, North America becomes a larger share of the mix, and the market starts underwriting Sidetrade as a scarce AI-native vertical SaaS asset.",
  },
};

export const navItems = [
  { href: "#overview", label: "Overview" },
  { href: "#snapshot", label: "Snapshot" },
  { href: "#valuation", label: "Valuation" },
  { href: "#dcf", label: "DCF" },
  { href: "#comps", label: "Comps" },
  { href: "#lbo", label: "LBO" },
  { href: "#takeaways", label: "Takeaways" },
  { href: "#sources", label: "Sources" },
];

export const snapshotRows = [
  ["Revenue", "61.4", "100%", "+14% cc"],
  ["Subscriptions", "53.5", "87%", "+20% cc"],
  ["Gross margin", "47.4", "77%", "+10%"],
  ["EBITDA", "13.4", "22%", "+22%"],
  ["EBIT", "10.3", "17%", "+23%"],
  ["Net profit", "9.0", "15%", "+14%"],
];

export const tradingComps = [
  ["Esker", "O2C / P2P SaaS", "~5.5-6.0x"],
  ["BlackLine", "Office-of-CFO workflow", "~2.5-3.0x"],
  ["BILL", "AP / AR + payments", "~2.0x"],
  ["nCino", "Vertical SaaS", "~3.0x"],
  ["Workiva", "CFO adjacency", "~3.0x"],
];

export const transactionComps = [
  ["Esker", "Bridgepoint / General Atlantic", "7.8x", "40.6x"],
  ["Coupa", "Thoma Bravo", "9.5x", "38.8x"],
  ["Billtrust", "EQT", "9.2x", "n/m"],
  ["Pagero", "Thomson Reuters", "7.9x", "n/m"],
  ["Bottomline", "Thoma Bravo", "5.0x", "24.7x"],
];
