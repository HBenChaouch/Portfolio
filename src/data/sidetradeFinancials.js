export const SOURCE_STATUS = Object.freeze({
  PUBLISHED: "Published",
  CALCULATED: "Calculated",
  ILLUSTRATIVE_ASSUMPTION: "Illustrative assumption",
  ESTIMATED: "Estimated",
  TO_BE_CONFIRMED: "To be confirmed",
  MARKET_AS_OF: "Market data as of 15 July 2026",
});

const publicAsset = (file) => `${import.meta.env?.BASE_URL ?? "/"}${file}`;

export const VALUATION_DATES = Object.freeze({
  fy25Cutoff: "31 Dec 2025",
  marketIso: "2026-07-15",
  marketLong: "15 July 2026",
  marketMedium: "15 Jul 2026",
  marketShort: "15 Jul 26",
});

export const SOURCES = Object.freeze({
  workbook: {
    label: "Sidetrade Valuation 2026 v2",
    file: "Sidetrade_Valuation_2026_v2.xlsx",
    href: publicAsset("Sidetrade_Valuation_2026_v2.xlsx"),
    status: SOURCE_STATUS.CALCULATED,
  },
  annualResults: {
    label: "Sidetrade FY25 Annual Results",
    date: "30 March 2026",
    shortDate: "Mar 30, 2026",
    href: publicAsset("PR_2025_Results_EN.pdf"),
    status: SOURCE_STATUS.PUBLISHED,
  },
  statutoryReport: {
    label: "Statutory Report FY25",
    date: "21 April 2026",
    shortDate: "Apr 21, 2026",
    href: publicAsset("Sidetrade-Group_FY25_Statutory-report-on-the-consolidated-financial-statements_ENG.pdf"),
    status: SOURCE_STATUS.PUBLISHED,
  },
  strategicPlan: {
    label: "O2C Intelligence 2030",
    date: "7 April 2026",
    shortDate: "Apr 7, 2026",
    href: publicAsset("260407_O2C_Intelligence_2030_PR_EN.pdf"),
    status: SOURCE_STATUS.PUBLISHED,
  },
  market: {
    label: "ALBFR market reference",
    date: VALUATION_DATES.marketLong,
    status: SOURCE_STATUS.MARKET_AS_OF,
  },
  qoe: {
    label: "Public-data QoE bridge",
    status: SOURCE_STATUS.ESTIMATED,
  },
  engine: {
    label: "DCF and LBO outputs",
    status: SOURCE_STATUS.CALCULATED,
  },
});

// DCF anchors retain calculation precision. Reported values
// are stored separately below where the statutory precision differs.
export const FY25 = Object.freeze({
  revenue: 61.4,
  reportedRevenue: 61.416,
  subscriptionRevenue: 53.594,
  ebitda: 13.4,
  reportedEbitda: 13.384,
  ebitdaMargin: 0.218,
  netDebt: 14.654,
  dilutedShares: 1536790,
  cir: 3.5,
  ebit: 10.267,
  netIncome: 9.024,
  fcfNormalized: 7.163,
  totalDebt: 30.981,
  cash: 16.327,
  cashAndMarketableSecurities: 16.327,
  yoy: Object.freeze({ revenue: 0.14, ebitda: 0.22, ebit: 0.23, netIncome: 0.14, fcf: 0.70 }),
});

// Published page conventions are stored separately from exact workbook values.
export const DISPLAY_VALUES = Object.freeze({
  subscriptionRevenue: 53.5,
  grossFinancialDebt: 30.8,
  cashAndMarketableSecurities: 16.3,
});

export const CASH_CONVERSION = Object.freeze({
  statutoryOcf: 5.240,
  capex: 1.024,
  statutoryFcf: 4.216,
  cirTimingNormalisation: 2.947,
  normalisedFcf: 7.163,
  managementOcfExCirTiming: 8.7,
  statutoryMargin: 0.069,
  normalisedMargin: 0.117,
  source: SOURCES.statutoryReport,
});

export const QOE = Object.freeze({
  publishedEbitdaInclCir: FY25.reportedEbitda,
  cirReported: 3.482,
  publishedEbitdaExCir: 9.902,
  adjustmentsEstimate: 0.8,
  adjustedEbitdaExCir: 10.702,
  adjustedEbitdaInclCir: 14.184,
  proFormaRange: Object.freeze({ low: 13.7, high: 14.7 }),
  source: SOURCES.qoe,
});

export const NET_DEBT = Object.freeze({
  grossFinancialDebt: 30.981,
  cash: 5.402,
  marketableSecurities: 10.925,
  strict: 14.654,
  earnOuts: 0.455,
  ezyCollectBalance: 1.459,
  deferredRevenueApprox: 14,
  source: SOURCES.statutoryReport,
});

export const SCENARIOS = Object.freeze({
  bear: Object.freeze({ growth: [0.12, 0.10, 0.08, 0.07, 0.06], ebitdaMargin2030: 0.26, taxRate: 0.25, daPct: 0.020, capexPct: 0.030, wcPct: 0.10, wacc: 0.105, g: 0.020 }),
  base: Object.freeze({ growth: [0.17, 0.15, 0.13, 0.11, 0.09], ebitdaMargin2030: 0.32, taxRate: 0.22, daPct: 0.020, capexPct: 0.027, wcPct: 0.07, wacc: 0.095, g: 0.025 }),
  bull: Object.freeze({ growth: [0.21, 0.18, 0.16, 0.14, 0.12], ebitdaMargin2030: 0.35, taxRate: 0.20, daPct: 0.020, capexPct: 0.025, wcPct: 0.05, wacc: 0.085, g: 0.030 }),
});

const sharePriceRef = 174;
const marketCap = (sharePriceRef * FY25.dilutedShares) / 1_000_000;
const marketEv = marketCap + NET_DEBT.strict;
const fairValueEv = 301;
const transactionRange = Object.freeze({ low: 289, base: 411, high: 547 });
const controlEv = transactionRange.base;
const fairValueEquityUpside = (fairValueEv - NET_DEBT.strict) / marketCap - 1;
const controlEquityUpside = (controlEv - NET_DEBT.strict) / marketCap - 1;

export const VALUATION_CONTEXT = Object.freeze({
  subscriptionRevenue: FY25.subscriptionRevenue,
  fairValueEv,
  controlEv,
  fairValueEquityUpside,
  controlEquityUpside,
  sharePriceRef,
  marketCap,
  marketEv,
  controlPremium: 0.20,
  liquidityDiscount: -0.05,
  interestCoverage: 7.1,
  tradingRange: Object.freeze({ low: 171, base: 202, high: 264 }),
  transactionRange,
  lboRange: Object.freeze({ low: 222.5, base: 241.9, high: 283.5 }),
  lboIrr: Object.freeze({ low: 0.25, base: 0.225, high: 0.18 }),
  source: SOURCES.workbook,
  marketSource: SOURCES.market,
});

export const TRANSACTION_COMPS = Object.freeze({
  basis: "LTM financials",
  selectedBasis: "FY25 revenue",
  selectedMultiples: Object.freeze({ low: 4.7, base: 6.7, high: 8.9 }),
  rows: Object.freeze([
    Object.freeze({ target: "Esker", buyer: "Bridgepoint / General Atlantic", year: 2024, evSales: 7.7, evEbitda: null }),
    Object.freeze({ target: "Coupa", buyer: "Thoma Bravo", year: 2023, evSales: 10.0, evEbitda: 161.6 }),
    Object.freeze({ target: "Billtrust", buyer: "EQT Private Equity", year: 2022, evSales: 8.2, evEbitda: 79.6 }),
    Object.freeze({ target: "Pagero", buyer: "Thomson Reuters", year: 2024, evSales: 6.7, evEbitda: 33.3 }),
    Object.freeze({ target: "Bottomline Technologies", buyer: "Thoma Bravo", year: 2022, evSales: 4.9, evEbitda: 23.6 }),
  ]),
  source: SOURCES.workbook,
});

export const LBO_REFERENCE = Object.freeze({
  entryEv: 241.93,
  acquisitionDebt: 53.536,
  sponsorEquity: 179,
  founderRollover: 28,
  holdingPeriodYears: 5,
  interestRate: 0.071630,
  cashSweep: 0.75,
  exitEbitda2030: 36.153,
  exitMultiple: 15,
  baseIrr: 0.225,
  dcfEntryIrr: 0.1636,
  source: SOURCES.workbook,
});
