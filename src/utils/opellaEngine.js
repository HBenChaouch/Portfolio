export class OpellaEngineError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "OpellaEngineError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new OpellaEngineError(code, message);
};

const finite = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("OP-ENGINE-NUMBER", `${path} must be finite`);
  }
  return value;
};

const positive = (value, path) => {
  if (finite(value, path) <= 0) {
    fail("OP-ENGINE-SIGN", `${path} must be strictly positive`);
  }
  return value;
};

const nonPositive = (value, path) => {
  if (finite(value, path) > 0) {
    fail("OP-ENGINE-SIGN", `${path} must use the accounting charge convention`);
  }
  return value;
};

const rate = (value, path) => {
  if (finite(value, path) < 0 || value > 1) {
    fail("OP-ENGINE-SIGN", `${path} must stay in [0, 1]`);
  }
  return value;
};

const periodNumber = (period) => {
  const match = /^P(\d+)$/.exec(period);
  if (!match) {
    fail("OP-ENGINE-PERIOD", `invalid period ${period}`);
  }
  return Number(match[1]);
};

const sum = (values) => values.reduce((total, value) => total + value, 0);

function relationTolerance(financials, id) {
  const relation = financials.contracts.relations.find((candidate) => candidate.id === id);
  return typeof relation?.tolerance === "number" ? relation.tolerance : Number.EPSILON;
}

function validateInputs(financials) {
  if (!financials?.calculation || !financials?.contracts?.engine) {
    fail("OP-ENGINE-INPUT", "a validated Opella financial registry is required");
  }

  const { m1, m2, m3, m4, m5, m6, m7 } = financials.calculation;
  positive(m1.revenue.value, "m1.revenue.value");
  rate(m1.margin.value, "m1.margin.value");
  positive(m1.enterpriseValue.value, "m1.enterpriseValue.value");
  const ownership = Object.values(m1.ownership).map(({ value }, index) => (
    rate(value, `m1.ownership[${index}].value`)
  ));
  if (Math.abs(sum(ownership) - 1) > relationTolerance(financials, "R-OWN")) {
    fail("OP-ENGINE-STATE", "m1 ownership must reconcile to 100%");
  }
  rate(m2.rate.value, "m2.rate.value");
  rate(m6.taxRate.value, "m6.taxRate.value");
  rate(m6.capexRate.value, "m6.capexRate.value");
  rate(m6.wcIntensity.value, "m6.wcIntensity.value");

  const baseEbitda = m1.revenue.value * m1.margin.value;
  if (baseEbitda === 0) {
    fail("OP-ENGINE-DIVISION", "entry multiple denominator must not be zero");
  }

  for (const item of m3.functions) {
    nonPositive(item.runRate, `m3.functions[${item.id}].runRate`);
    for (const [period, ramp] of Object.entries(item.ramp)) {
      periodNumber(period);
      rate(ramp, `m3.functions[${item.id}].ramp.${period}`);
    }
  }
  for (const service of m4.services) {
    nonPositive(service.monthly, `m4.services[${service.id}].monthly`);
    positive(service.duration, `m4.services[${service.id}].duration`);
    if (service.doubleRunMonths < 0 || service.doubleRunMonths > service.duration) {
      fail("OP-ENGINE-STATE", `m4.services[${service.id}] has an invalid double-run window`);
    }
  }
  for (const item of m5.lines) {
    for (const [period, amount] of Object.entries(item.byPeriod)) {
      periodNumber(period);
      nonPositive(amount, `m5.lines[${item.id}].byPeriod.${period}`);
    }
  }
  if (!m7.counterfactual.definition) {
    fail("OP-ENGINE-INPUT", "the funding counterfactual definition is required");
  }
}

function normalizedSelections(financials, selections = {}) {
  const contract = financials.contracts.engine;
  const expected = Object.keys(contract.levers);
  for (const id of Object.keys(selections)) {
    if (!expected.includes(id)) {
      fail("OP-ENGINE-STATE", `unknown scenario lever ${id}`);
    }
  }
  const resolved = {};
  for (const id of expected) {
    const state = selections[id] ?? contract.central[id];
    if (!(state in contract.levers[id].states)) {
      fail("OP-ENGINE-STATE", `unknown state ${state} for ${id}`);
    }
    resolved[id] = state;
  }
  return resolved;
}

function resolvedLeverValues(financials, selections) {
  const levers = financials.contracts.engine.levers;
  const ops = levers["S-OPS"].states[selections["S-OPS"]];
  return {
    costMultiplier: finite(levers["S-COST"].states[selections["S-COST"]], "S-COST"),
    tsaDelta: finite(levers["S-TSA"].states[selections["S-TSA"]], "S-TSA"),
    oneOffMultiplier: finite(levers["S-ONEOFF"].states[selections["S-ONEOFF"]], "S-ONEOFF"),
    growth: finite(ops[0], "S-OPS.growth"),
    marginStep: finite(ops[1], "S-OPS.marginStep"),
  };
}

function calendarPeriod(index) {
  if (index === 0) {
    return {
      id: "P0",
      label: "FY2024",
      start: "2024-01-01",
      end: "2024-12-31",
      months: 12,
      inHorizon: false,
    };
  }
  if (index === 1) {
    return {
      id: "P1",
      label: "Mai–déc. 2025",
      start: "2025-05-01",
      end: "2025-12-31",
      months: 8,
      inHorizon: true,
    };
  }
  const year = 2024 + index;
  return {
    id: `P${index}`,
    label: `FY${year}`,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    months: 12,
    inHorizon: true,
  };
}

const buildCalendar = (horizonEnd) => Array.from(
  { length: horizonEnd + 1 },
  (_, index) => calendarPeriod(index),
);

function contractualMonthToPeriod(month, periods) {
  const total = 2025 * 12 + 5 - 1 + month - 1;
  const year = Math.floor(total / 12);
  const calendarMonth = total % 12 + 1;
  return periods.find((period) => {
    if (!period.inHorizon) {
      return false;
    }
    const start = period.start.split("-").map(Number);
    const end = period.end.split("-").map(Number);
    return (
      (year > start[0] || (year === start[0] && calendarMonth >= start[1]))
      && (year < end[0] || (year === end[0] && calendarMonth <= end[1]))
    );
  })?.id;
}

function tsaSchedule(financials, config, periods, requireComplete = false) {
  const uplift = finite(financials.contracts.engine.tsaExtensionUplift, "tsaExtensionUplift");
  const schedules = [];

  for (const service of financials.calculation.m4.services) {
    const duration = Math.max(1, service.duration + config.tsaDelta);
    const recoveryStart = service.duration - service.doubleRunMonths + 1;
    const monthsByPeriod = Object.fromEntries(periods.filter(({ inHorizon }) => inHorizon).map(({ id }) => [id, 0]));
    const costByPeriod = Object.fromEntries(periods.filter(({ inHorizon }) => inHorizon).map(({ id }) => [id, 0]));

    for (let month = service.startMonth; month < service.startMonth + duration; month += 1) {
      const period = contractualMonthToPeriod(month, periods);
      if (!period) {
        continue;
      }
      const monthly = month > service.duration ? service.monthly * (1 + uplift) : service.monthly;
      monthsByPeriod[period] += 1;
      costByPeriod[period] += monthly;
    }

    const allocatedMonths = sum(Object.values(monthsByPeriod));
    if (requireComplete && allocatedMonths !== duration) {
      fail("OP-ENGINE-PERIOD", `${service.id} loses contractual months at the modeled horizon`);
    }
    const doubleRunMonths = Math.max(0, duration - recoveryStart + 1);
    if (doubleRunMonths > duration) {
      fail("OP-ENGINE-STATE", `${service.id} double-run exceeds its duration`);
    }
    schedules.push({ ...service, duration, doubleRunMonths, monthsByPeriod, costByPeriod });
  }

  return schedules;
}

const rampFor = (item, period) => period === "P0" ? 0 : (item.ramp[period] ?? 1);

function findSteadyState(financials, config, periods, schedules) {
  const horizon = periods.filter(({ inHorizon }) => inHorizon).map(({ id }) => id);
  for (const period of horizon) {
    const tsa = sum(schedules.map(({ costByPeriod }) => costByPeriod[period] ?? 0));
    const oneOff = sum(financials.calculation.m5.lines.map(
      (item) => (item.byPeriod[period] ?? 0) * config.oneOffMultiplier,
    ));
    const fullRamp = financials.calculation.m3.functions.every(
      (item) => Math.abs(rampFor(item, period) - 1) <= Number.EPSILON,
    );
    if (Math.abs(tsa) <= Number.EPSILON && Math.abs(oneOff) <= Number.EPSILON && fullRamp) {
      return period;
    }
  }
  return null;
}

function openHorizon(financials, config) {
  let end = 3;
  const maximum = financials.contracts.engine.maxPeriods;
  while (end <= maximum) {
    const periods = buildCalendar(end);
    const schedules = tsaSchedule(financials, config, periods);
    const steady = findSteadyState(financials, config, periods, schedules);
    const needed = steady ? periodNumber(steady) + 1 : end + 1;
    if (steady && end >= needed) {
      return {
        periods,
        schedules: tsaSchedule(financials, config, periods, true),
        steady,
      };
    }
    end = Math.max(end + 1, needed);
  }
  fail("OP-ENGINE-PERIOD", "steady state is not reached under the canonical horizon guard");
}

function canonicalLine(financials, id) {
  const line = financials.calculation.m7.inventory.find((candidate) => candidate.id === id);
  if (!line) {
    fail("OP-ENGINE-INPUT", `missing canonical line ${id}`);
  }
  return line;
}

function amountsFromCanonicalLine(financials, id, periods, fallback = 0) {
  const line = canonicalLine(financials, id);
  return Object.fromEntries(periods.map(({ id: period }) => [period, line.amounts[period] ?? fallback]));
}

function addLine(lines, {
  id,
  module,
  group,
  side = "cas",
  qualification,
  amounts,
}) {
  if (lines.some((line) => line.id === id && line.side === side)) {
    fail("OP-ENGINE-INPUT", `duplicate inventory line ${id}|${side}`);
  }
  lines.push({ id, module, group, side, qualification, amounts });
}

export function classifyOpellaFunding(periods, tolerance = Number.EPSILON) {
  if (!Array.isArray(periods) || periods.length === 0) {
    fail("OP-ENGINE-INPUT", "funding periods must be non-empty");
  }
  const last = periods.at(-1);
  const needZero = Math.abs(last.need) <= tolerance;
  let state;
  let pk;

  if (last.eGap > tolerance) {
    state = "croissant à l'horizon";
  } else if (needZero) {
    state = "résorbé";
    pk = periods.find((candidate, index) => periods.slice(index).every(
      (period) => Math.abs(period.need) <= tolerance,
    ))?.period;
  } else if (Math.abs(last.eGap) <= tolerance) {
    state = "plateau";
    pk = periods.find((candidate, index) => periods.slice(index).every(
      (period) => Math.abs(period.eGap) <= tolerance && Math.abs(period.need - last.need) <= tolerance,
    ))?.period;
  } else {
    state = "non résorbé à l'horizon";
  }

  return pk ? { state, pk } : { state };
}

export function runOpellaFundingVector(E, N, tolerance = Number.EPSILON) {
  if (!Array.isArray(E) || !Array.isArray(N) || E.length === 0 || E.length !== N.length) {
    fail("OP-ENGINE-INPUT", "E and N vectors must be non-empty and have the same length");
  }
  E.forEach((value, index) => finite(value, `E[${index}]`));
  N.forEach((value, index) => finite(value, `N[${index}]`));

  let cumulative = 0;
  const periods = E.map((eGap, index) => {
    const nOneOff = N[index];
    const s = eGap + nOneOff;
    cumulative += s;
    return {
      period: `P${index + 1}`,
      c: -s,
      s,
      sCum: cumulative,
      need: Math.max(0, cumulative),
      eGap,
      nOneOff,
    };
  });
  const classification = classifyOpellaFunding(periods, tolerance);
  const peak = Math.max(...periods.map(({ need }) => need));
  const peakPeriod = periods.find(({ need }) => Math.abs(need - peak) <= tolerance).period;
  const last = periods.at(-1);
  const previous = periods.length === 1 ? 0 : periods.at(-2).sCum;

  return {
    periods,
    peak: { amount: peak, period: peakPeriod },
    horizon: {
      period: last.period,
      delta: last.sCum - previous,
      residualSurplus: last.sCum < 0 ? -last.sCum : 0,
    },
    resorb: classification,
  };
}

export function calculateOpella(financials, selections = {}) {
  validateInputs(financials);
  const selected = normalizedSelections(financials, selections);
  const config = resolvedLeverValues(financials, selected);
  const opened = openHorizon(financials, config);
  const horizonPeriods = opened.periods.filter(({ inHorizon }) => inHorizon);
  const horizon = horizonPeriods.map(({ id }) => id);
  const H = horizon.at(-1);
  const { m1, m2, m3, m4, m5, m6 } = financials.calculation;

  const revenue = {};
  const margin = {};
  const ebitda = {};
  const fullYearRevenue = {};
  for (const period of opened.periods) {
    const index = periodNumber(period.id);
    const exponent = index === 0 ? 0 : index;
    const annualRevenue = m1.revenue.value * (1 + config.growth) ** exponent;
    const periodMargin = m1.margin.value + config.marginStep * exponent;
    const share = period.months / 12;
    fullYearRevenue[period.id] = annualRevenue;
    revenue[period.id] = annualRevenue * share;
    margin[period.id] = periodMargin;
    ebitda[period.id] = revenue[period.id] * periodMargin;
  }

  const lines = [];
  addLine(lines, {
    id: "L-EBITDA",
    module: "M1",
    group: "L-M6OTH",
    qualification: "récurrent",
    amounts: Object.fromEntries(horizon.map((period) => [period, ebitda[period]])),
  });
  addLine(lines, {
    id: "L-ALLOC",
    module: "M2",
    group: "L-M6OTH",
    qualification: "récurrent",
    amounts: Object.fromEntries(horizon.map((period) => [period, revenue[period] * m2.rate.value])),
  });

  const m3ByPeriod = Object.fromEntries(horizon.map((period) => [period, 0]));
  for (const item of m3.functions) {
    const amounts = Object.fromEntries(horizon.map((period) => [
      period,
      item.runRate * config.costMultiplier * rampFor(item, period),
    ]));
    addLine(lines, {
      id: `L-M3-${item.id}`,
      module: "M3",
      group: "L-M3",
      qualification: "récurrent",
      amounts,
    });
    for (const period of horizon) {
      m3ByPeriod[period] += amounts[period];
    }
  }

  const tsaByPeriod = Object.fromEntries(horizon.map((period) => [period, 0]));
  for (const service of opened.schedules) {
    const amounts = Object.fromEntries(horizon.map((period) => [period, service.costByPeriod[period] ?? 0]));
    addLine(lines, {
      id: `L-M4-${service.id}`,
      module: "M4",
      group: "L-M4",
      qualification: "ponctuel",
      amounts,
    });
    for (const period of horizon) {
      tsaByPeriod[period] += amounts[period];
    }
  }

  const oneOffByPeriod = Object.fromEntries(horizon.map((period) => [period, 0]));
  for (const item of m5.lines) {
    const amounts = Object.fromEntries(horizon.map((period) => [
      period,
      (item.byPeriod[period] ?? 0) * config.oneOffMultiplier,
    ]));
    addLine(lines, {
      id: `L-M5-${item.id}`,
      module: "M5",
      group: "L-M5",
      qualification: "ponctuel",
      amounts,
    });
    for (const period of horizon) {
      oneOffByPeriod[period] += amounts[period];
    }
  }

  const separationLines = [
    ["L-SEPCAPEX", false],
    ["L-SEPWC", false],
    ["L-SEPWCREC", true],
  ];
  for (const [id] of separationLines) {
    addLine(lines, {
      id,
      module: "M6",
      group: "L-M6SEP",
      qualification: "ponctuel",
      amounts: amountsFromCanonicalLine(financials, id, horizonPeriods),
    });
  }

  const taxRecurring = Object.fromEntries(horizon.map((period) => [
    period,
    -m6.taxRate.value * (ebitda[period] + revenue[period] * m2.rate.value + m3ByPeriod[period]),
  ]));
  addLine(lines, {
    id: "L-TAXREC",
    module: "M6",
    group: "L-M6OTH",
    qualification: "récurrent",
    amounts: taxRecurring,
  });

  const taxOneOff = Object.fromEntries(horizon.map((period) => [
    period,
    -m6.taxRate.value * (tsaByPeriod[period] + oneOffByPeriod[period]),
  ]));
  addLine(lines, {
    id: "L-TAXPONC",
    module: "M6",
    group: "L-M6OTH",
    qualification: "ponctuel",
    amounts: taxOneOff,
  });

  const currentCapex = Object.fromEntries(horizon.map((period) => [
    period,
    -m6.capexRate.value * revenue[period],
  ]));
  addLine(lines, {
    id: "L-CAPEX",
    module: "M6",
    group: "L-M6OTH",
    qualification: "récurrent",
    amounts: currentCapex,
  });

  const currentWorkingCapital = {};
  for (const period of horizonPeriods) {
    const index = periodNumber(period.id);
    const previous = fullYearRevenue[`P${index - 1}`];
    const delta = (fullYearRevenue[period.id] - previous) * (period.months / 12);
    currentWorkingCapital[period.id] = -m6.wcIntensity.value * delta;
  }
  addLine(lines, {
    id: "L-WC",
    module: "M6",
    group: "L-M6OTH",
    qualification: "récurrent",
    amounts: currentWorkingCapital,
  });

  const otherCashSeed = canonicalLine(financials, "L-OTHER").amounts[horizon[0]];
  const otherCash = Object.fromEntries(horizon.map((period) => [period, otherCashSeed]));
  addLine(lines, {
    id: "L-OTHER",
    module: "M6",
    group: "L-M6OTH",
    qualification: "récurrent",
    amounts: otherCash,
  });

  const counterfactual = [];
  addLine(counterfactual, {
    id: "L-CF-EBITDA",
    module: "CF",
    group: "L-CF",
    side: "contrefactuel",
    qualification: "récurrent",
    amounts: Object.fromEntries(horizon.map((period) => [period, ebitda[period]])),
  });
  addLine(counterfactual, {
    id: "L-CF-TAX",
    module: "CF",
    group: "L-CF",
    side: "contrefactuel",
    qualification: "récurrent",
    amounts: Object.fromEntries(horizon.map((period) => [period, -m6.taxRate.value * ebitda[period]])),
  });
  addLine(counterfactual, {
    id: "L-CF-CAPEX",
    module: "CF",
    group: "L-CF",
    side: "contrefactuel",
    qualification: "récurrent",
    amounts: currentCapex,
  });
  addLine(counterfactual, {
    id: "L-CF-WC",
    module: "CF",
    group: "L-CF",
    side: "contrefactuel",
    qualification: "récurrent",
    amounts: currentWorkingCapital,
  });
  addLine(counterfactual, {
    id: "L-CF-OTHER",
    module: "CF",
    group: "L-CF",
    side: "contrefactuel",
    qualification: "récurrent",
    amounts: otherCash,
  });

  const inventory = [...lines, ...counterfactual];
  let cumulative = 0;
  const fundingPeriods = horizon.map((period) => {
    const caseCash = sum(lines.map((line) => line.amounts[period]));
    const counterfactualCash = sum(counterfactual.map((line) => line.amounts[period]));
    const c = caseCash - counterfactualCash;
    const s = -c;
    const contributions = inventory.map((line) => ({
      line,
      value: line.side === "cas" ? -line.amounts[period] : line.amounts[period],
    }));
    const eGap = sum(contributions.filter(({ line }) => line.qualification === "récurrent").map(({ value }) => value));
    const nOneOff = sum(contributions.filter(({ line }) => line.qualification === "ponctuel").map(({ value }) => value));
    cumulative += s;
    return {
      period,
      c,
      s,
      sCum: cumulative,
      need: Math.max(0, cumulative),
      eGap,
      nOneOff,
    };
  });

  const tolerance = relationTolerance(financials, "R-MULT");
  const resorb = classifyOpellaFunding(fundingPeriods, tolerance);
  const peakAmount = Math.max(...fundingPeriods.map(({ need }) => need));
  const peakPeriod = fundingPeriods.find(({ need }) => Math.abs(need - peakAmount) <= tolerance).period;
  const last = fundingPeriods.at(-1);
  const previousCum = fundingPeriods.length === 1 ? 0 : fundingPeriods.at(-2).sCum;
  const runRate = Math.abs(sum(m3.functions.map(({ runRate: value }) => value * config.costMultiplier)));
  const sepCapex = canonicalLine(financials, "L-SEPCAPEX");
  const separationCost = Math.abs(
    sum(Object.values(tsaByPeriod))
    + sum(Object.values(oneOffByPeriod))
    + sum(horizon.map((period) => sepCapex.amounts[period] ?? 0)),
  );
  const baseEbitda = m1.revenue.value * m1.margin.value;

  return {
    selections: selected,
    calendar: {
      periods: opened.periods,
      horizon,
      maxHorizon: H,
      steadyState: opened.steady ?? "non atteint à l'horizon",
    },
    modules: {
      m1: {
        revenue,
        margin,
        ebitda,
        entryMultiple: m1.enterpriseValue.value / baseEbitda,
      },
      m3: {
        functions: m3.functions.map((item) => ({
          id: item.id,
          runRate: item.runRate * config.costMultiplier,
          applied: Object.fromEntries(horizon.map((period) => [
            period,
            item.runRate * config.costMultiplier * rampFor(item, period),
          ])),
        })),
        runRateTotal: -runRate,
        byPeriod: m3ByPeriod,
      },
      m4: {
        services: opened.schedules,
        byPeriod: tsaByPeriod,
      },
      m5: {
        byPeriod: oneOffByPeriod,
      },
      m6: {
        cash: Object.fromEntries(horizon.map((period) => [
          period,
          sum(lines.map((line) => line.amounts[period])),
        ])),
        standaloneRunRate: ebitda[H] + revenue[H] * m2.rate.value - runRate,
      },
      m7: {
        inventory,
        periods: fundingPeriods,
        peak: { amount: peakAmount, period: peakPeriod },
        horizon: {
          period: H,
          delta: last.sCum - previousCum,
          residualSurplus: last.sCum < 0 ? -last.sCum : 0,
        },
        resorb,
      },
    },
    outputs: {
      "O-RUNRATE": { value: runRate },
      "O-SEPCOST": { value: separationCost },
      "O-PEAK": { value: peakAmount, period: peakPeriod },
      "O-STEADY": { value: opened.steady ?? "non atteint à l'horizon" },
      "O-RESORB": { state: resorb.state },
    },
  };
}
