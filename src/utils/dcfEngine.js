export const FY25 = {
  revenue: 61.4,
  ebitda: 13.4,
  ebitdaMargin: 0.218,
  netDebt: 14.654,
  dilutedShares: 1536790,
  cir: 3.5,
  ebit: 10.267,
  netIncome: 9.024,
  fcfNormalized: 7.163,
  totalDebt: 30.981,
  cash: 16.327,
  yoy: {
    revenue: 0.14,
    ebitda: 0.22,
    ebit: 0.23,
    netIncome: 0.14,
    fcf: 0.70,
  },
};

export const SCENARIOS = {
  bear: {
    growth: [0.12, 0.10, 0.08, 0.07, 0.06],
    ebitdaMargin2030: 0.26,
    taxRate: 0.25,
    daPct: 0.020,
    capexPct: 0.030,
    wcPct: 0.10,
    wacc: 0.105,
    g: 0.020,
  },
  base: {
    growth: [0.17, 0.15, 0.13, 0.11, 0.09],
    ebitdaMargin2030: 0.32,
    taxRate: 0.22,
    daPct: 0.020,
    capexPct: 0.027,
    wcPct: 0.07,
    wacc: 0.095,
    g: 0.025,
  },
  bull: {
    growth: [0.21, 0.18, 0.16, 0.14, 0.12],
    ebitdaMargin2030: 0.35,
    taxRate: 0.20,
    daPct: 0.020,
    capexPct: 0.025,
    wcPct: 0.05,
    wacc: 0.085,
    g: 0.030,
  },
};

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
const EXIT_MULTIPLE = 15;

export const VALUATION_CONTEXT = {
  subscriptionRevenue: 53.594,
  controlEv: 410,
  sharePriceRef: 166,
  controlPremium: 0.20,
  liquidityDiscount: -0.05,
  interestCoverage: 7.1,
  tradingRange: { low: 185, base: 295, high: 425 },
  transactionRange: { low: 290, base: 410, high: 545 },
  lboRange: { low: 135, base: 283, high: 455 },
  lboIrr: { low: 0.25, base: 0.225, high: 0.18 },
};

function getScenario(scenarioId) {
  const scenario = SCENARIOS[scenarioId];

  if (!scenario) {
    throw new Error(`Unknown DCF scenario: ${scenarioId}`);
  }

  return scenario;
}

function buildProjectionYear({ previousRevenue, yearIndex, scenario, marginPath }) {
  const revenue = previousRevenue * (1 + scenario.growth[yearIndex - 1]);
  const margin = marginPath[yearIndex];
  const ebitda = revenue * margin;
  const da = revenue * scenario.daPct;
  const ebit = ebitda - da;
  const taxes = Math.max(0, ebit * scenario.taxRate);
  const capex = revenue * scenario.capexPct;
  const deltaWc = (revenue - previousRevenue) * scenario.wcPct;
  const fcfFromEbit = ebit * (1 - scenario.taxRate) + da - capex - deltaWc;

  return {
    year: YEARS[yearIndex],
    revenue,
    ebitda,
    ebit,
    taxes,
    da,
    capex,
    deltaWc,
    fcf: fcfFromEbit,
    ebitdaMargin: margin,
  };
}

function linearMarginPath(scenario) {
  return YEARS.map((_, index) => {
    return FY25.ebitdaMargin + (scenario.ebitdaMargin2030 - FY25.ebitdaMargin) * (index / 5);
  });
}

function frontLoadedMarginPath(scenario) {
  return YEARS.map((_, index) => {
    const progress = Math.sqrt(index / 5);
    return FY25.ebitdaMargin + (scenario.ebitdaMargin2030 - FY25.ebitdaMargin) * progress;
  });
}

function backLoadedMarginPath(scenario) {
  return YEARS.map((_, index) => {
    const progress = Math.pow(index / 5, 2);
    return FY25.ebitdaMargin + (scenario.ebitdaMargin2030 - FY25.ebitdaMargin) * progress;
  });
}

function buildTrajectoryWithMarginPath(scenarioId, marginPathBuilder = linearMarginPath) {
  const scenario = getScenario(scenarioId);
  const marginPath = marginPathBuilder(scenario);
  const trajectory = [
    {
      year: 2025,
      revenue: FY25.revenue,
      ebitda: FY25.ebitda,
      ebit: FY25.ebitda - FY25.revenue * scenario.daPct,
      taxes: Math.max(0, (FY25.ebitda - FY25.revenue * scenario.daPct) * scenario.taxRate),
      da: FY25.revenue * scenario.daPct,
      capex: FY25.revenue * scenario.capexPct,
      deltaWc: 0,
      fcf:
        (FY25.ebitda - FY25.revenue * scenario.daPct) * (1 - scenario.taxRate) +
        FY25.revenue * scenario.daPct -
        FY25.revenue * scenario.capexPct,
      ebitdaMargin: FY25.ebitdaMargin,
    },
  ];

  for (let yearIndex = 1; yearIndex < YEARS.length; yearIndex += 1) {
    trajectory.push(
      buildProjectionYear({
        previousRevenue: trajectory[yearIndex - 1].revenue,
        yearIndex,
        scenario,
        marginPath,
      })
    );
  }

  return trajectory;
}

function pvOfTerminalValue(value, wacc) {
  return value / Math.pow(1 + wacc, 5);
}

export function buildTrajectory(scenarioId) {
  return buildTrajectoryWithMarginPath(scenarioId, linearMarginPath);
}

export function discountedCashflows(scenarioId) {
  const scenario = getScenario(scenarioId);
  return buildTrajectory(scenarioId).slice(1).map((year, index) => ({
    year: year.year,
    fcf: year.fcf,
    pv: year.fcf / Math.pow(1 + scenario.wacc, index + 0.5),
  }));
}

export function terminalValue(scenarioId) {
  const scenario = getScenario(scenarioId);
  const trajectory = buildTrajectory(scenarioId);
  const terminalYear = trajectory[trajectory.length - 1];
  const gordon = (terminalYear.fcf * (1 + scenario.g)) / (scenario.wacc - scenario.g);
  const exitMultiple = terminalYear.ebitda * EXIT_MULTIPLE;
  const impliedExitMultiple = gordon / terminalYear.ebitda;

  return { gordon, exitMultiple, impliedExitMultiple };
}

export function enterpriseValue(scenarioId) {
  const scenario = getScenario(scenarioId);
  const pvFcfs = discountedCashflows(scenarioId).reduce((sum, year) => sum + year.pv, 0);
  const pvTerminal = pvOfTerminalValue(terminalValue(scenarioId).gordon, scenario.wacc);

  return pvFcfs + pvTerminal;
}

export function equityBridge(scenarioId) {
  const ev = enterpriseValue(scenarioId);
  const equity = ev - FY25.netDebt;
  const sharePrice = (equity * 1000000) / FY25.dilutedShares;

  return {
    ev,
    netDebt: FY25.netDebt,
    equity,
    sharePrice,
  };
}

export function sensitivityWaccG(scenarioId, waccs, gs) {
  const scenario = getScenario(scenarioId);
  const trajectory = buildTrajectory(scenarioId);
  const fcfs = trajectory.slice(1).map((year) => year.fcf);
  const terminalFcf = fcfs[fcfs.length - 1];

  return gs.map((g) =>
    waccs.map((wacc) => {
      const pvFcfs = fcfs.reduce((sum, fcf, index) => {
        return sum + fcf / Math.pow(1 + wacc, index + 0.5);
      }, 0);
      const tv = (terminalFcf * (1 + g)) / (wacc - g);
      return pvFcfs + pvOfTerminalValue(tv, wacc);
    })
  );
}

export function sensitivityWaccExit(scenarioId, waccs, multiples) {
  const trajectory = buildTrajectory(scenarioId);
  const fcfs = trajectory.slice(1).map((year) => year.fcf);
  const terminalEbitda = trajectory[trajectory.length - 1].ebitda;

  return multiples.map((multiple) =>
    waccs.map((wacc) => {
      const pvFcfs = fcfs.reduce((sum, fcf, index) => {
        return sum + fcf / Math.pow(1 + wacc, index + 0.5);
      }, 0);
      return pvFcfs + pvOfTerminalValue(terminalEbitda * multiple, wacc);
    })
  );
}

export function marginPathSensitivity(scenarioId) {
  const scenario = getScenario(scenarioId);

  function evFromPath(pathBuilder) {
    const trajectory = buildTrajectoryWithMarginPath(scenarioId, pathBuilder);
    const fcfs = trajectory.slice(1).map((year) => year.fcf);
    const terminalFcf = fcfs[fcfs.length - 1];
    const pvFcfs = fcfs.reduce((sum, fcf, index) => {
      return sum + fcf / Math.pow(1 + scenario.wacc, index + 0.5);
    }, 0);
    const tv = (terminalFcf * (1 + scenario.g)) / (scenario.wacc - scenario.g);
    return pvFcfs + pvOfTerminalValue(tv, scenario.wacc);
  }

  return {
    linear: evFromPath(linearMarginPath),
    frontLoaded: evFromPath(frontLoadedMarginPath),
    backLoaded: evFromPath(backLoadedMarginPath),
  };
}

export function crossCheckFcf(scenarioId) {
  const scenario = getScenario(scenarioId);

  return buildTrajectory(scenarioId).map((year) => {
    const cashTaxes = Math.max(0, year.ebit * scenario.taxRate);
    const fcfFromEbitda = year.ebitda - cashTaxes - year.capex - year.deltaWc;
    const fcfFromEbit = year.ebit * (1 - scenario.taxRate) + year.da - year.capex - year.deltaWc;
    const delta = Math.abs(fcfFromEbitda - fcfFromEbit);

    if (delta > 0.01) {
      console.warn(
        `FCF cross-check divergence in ${scenarioId} ${year.year}: ${delta.toFixed(3)} €m`
      );
    }

    return {
      year: year.year,
      fcfFromEbitda,
      fcfFromEbit,
      delta,
      ok: delta <= 0.01,
    };
  });
}

export function scenarioSummary(scenarioId) {
  const scenario = getScenario(scenarioId);
  const trajectory = buildTrajectory(scenarioId);
  const terminalYear = trajectory[trajectory.length - 1];
  const ev = enterpriseValue(scenarioId);

  return {
    ...scenario,
    id: scenarioId,
    ev,
    result: {
      revenue2030: terminalYear.revenue,
      ebitda2030: terminalYear.ebitda,
      fcf2030: terminalYear.fcf,
      evSales: ev / FY25.revenue,
    },
  };
}
