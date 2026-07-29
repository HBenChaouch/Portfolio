import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import DataTable from "../components/DataTable.jsx";
import MetricTile from "../components/MetricTile.jsx";
import WaterfallBridge from "../components/WaterfallBridge.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useOpellaScenario } from "../context/OpellaScenarioContext.jsx";
import {
  createOpellaCopy,
  opellaDiligenceItems,
} from "../data/opellaCase.js";
import { opellaFinancials } from "../data/opellaFinancials.js";
import { calculateOpella } from "../utils/opellaEngine.js";

const stateCopyIds = {
  "résorbé": "funding.state.resorbed",
  plateau: "funding.state.plateau",
  "non résorbé à l'horizon": "funding.state.nonResorbed",
  "croissant à l'horizon": "funding.state.growing",
};

const stateMessageIds = {
  "résorbé": "funding.message.resorbed",
  plateau: "funding.message.plateau",
  "non résorbé à l'horizon": "funding.message.nonResorbed",
  "croissant à l'horizon": "funding.message.growing",
};

const statusCopyIds = {
  public: "common.public",
  "recoupement public": "common.publicCrossCheck",
  estimation: "common.estimated",
  calculé: "common.calculated",
  "à confirmer": "common.toConfirm",
};

const leverStateCopyIds = {
  basse: "common.low",
  centrale: "common.central",
  haute: "common.high",
};

const leverUnitCopyIds = {
  "S-COST": "lever.unit.multiplierRunRate",
  "S-TSA": "lever.unit.months",
  "S-ONEOFF": "lever.unit.multiplierAmount",
  "S-OPS": "lever.unit.ops",
};

const sum = (values) => values.reduce((total, value) => total + value, 0);

function localeFor(language) {
  return language === "en" ? "en-GB" : "fr-FR";
}

function formatNumber(value, language, decimals = 1, signed = false) {
  const rounded = Math.abs(value) < Number.EPSILON ? 0 : value;
  let displayDecimals = decimals;

  while (
    rounded !== 0 &&
    Number(Math.abs(rounded).toFixed(displayDecimals)) === 0 &&
    displayDecimals < 12
  ) {
    displayDecimals += 1;
  }

  return new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: displayDecimals,
    minimumFractionDigits: displayDecimals,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(rounded);
}

function formatMoney(value, language, { decimals = 1, signed = false } = {}) {
  const amount = formatNumber(value, language, decimals, signed);
  return language === "en" ? `€${amount}m` : `${amount} M€`;
}

function formatPercent(value, language, decimals = 1) {
  return new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    style: "percent",
  }).format(value);
}

function formatMultiple(value, language, decimals = 1) {
  return `${formatNumber(value, language, decimals)}x`;
}

function formatBillions(value, language, decimals = 1) {
  const amount = formatNumber(value / 1000, language, decimals);
  return language === "en" ? `€${amount}bn` : `${amount} Md€`;
}

function formatDate(value, language) {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function periodDisplay(periods, periodId, language, copy) {
  const period = periods.find(({ id }) => id === periodId);
  if (!period) return copy("common.notReached");
  if (period.id === "P1") {
    return `${period.id} · ${copy("calendar.stub", { year: period.end.slice(0, 4) })}`;
  }
  return `${period.id} · ${period.label}`;
}

function statusLabel(status, copy) {
  return copy(statusCopyIds[status] ?? "common.toConfirm");
}

function sourceIdList(sourceIds) {
  return sourceIds.split("+").filter(Boolean);
}

function ExternalSourceLink({ copy, reference, sourceId }) {
  return (
    <a
      aria-label={copy("sources.openAccessible", { document: reference.document })}
      data-source-id={sourceId}
      data-source-url={reference.url}
      href={reference.url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {copy("sources.openOriginal")} ↗
    </a>
  );
}

function SourceReferenceBlock({
  compact = false,
  copy,
  sourceIds,
  sourcesById,
}) {
  return (
    <div className={compact ? "source-reference-list compact" : "source-reference-list"}>
      {sourceIdList(sourceIds).map((sourceId) => {
        const source = sourcesById.get(sourceId);
        if (!source) return null;
        return (
          <div
            className="source-reference"
            data-source-id={source.id}
            data-source-location={source.location}
            key={source.id}
          >
            <strong>{source.organization}</strong>
            <span>{source.document}</span>
            <small>{source.location}</small>
            {source.references.filter(({ url }) => Boolean(url)).map((reference) => (
              <ExternalSourceLink
                copy={copy}
                key={reference.url}
                reference={reference}
                sourceId={source.id}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Section({ children, id, kicker, title }) {
  return (
    <section className="opella-section" id={id}>
      <header className="opella-section-header">
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function StatusTag({ copy, status }) {
  return (
    <span className={`opella-status status-${status.replace(/\s+/g, "-")}`}>
      {statusLabel(status, copy)}
    </span>
  );
}

function BarGraphic({ copy, items, label, valueFormatter }) {
  const maximum = Math.max(...items.map(({ value }) => Math.abs(value)), Number.EPSILON);
  return (
    <div aria-label={label} className="opella-bar-chart" role="img">
      {items.map((item) => (
        <div className="opella-bar-row" key={item.id}>
          <span>{item.label}</span>
          <div aria-hidden="true" className="opella-bar-track">
            <i style={{ "--bar-size": `${Math.abs(item.value) / maximum * 100}%` }} />
          </div>
          <strong>{valueFormatter(item.value)}</strong>
          {item.status ? <StatusTag copy={copy} status={item.status} /> : null}
        </div>
      ))}
    </div>
  );
}

function BridgeGraphic({ ariaLabel, items }) {
  return (
    <WaterfallBridge ariaLabel={ariaLabel} className="opella-waterfall">
      <ol className="opella-bridge-visual">
        {items.map((item) => (
          <li className={`bridge-${item.tone ?? "neutral"}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </li>
        ))}
      </ol>
      <ol aria-label={ariaLabel} className="opella-bridge-mobile">
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </li>
        ))}
      </ol>
    </WaterfallBridge>
  );
}

function FundingCurve({
  copy,
  language,
  periodLabel,
  periods,
  stateLabel,
}) {
  const width = 920;
  const height = 300;
  const left = 52;
  const right = 24;
  const top = 28;
  const bottom = 56;
  const maximum = Math.max(...periods.map(({ need }) => need), Number.EPSILON);
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;
  const xFor = (index) => left + (periods.length === 1 ? 0 : index / (periods.length - 1) * usableWidth);
  const yFor = (value) => top + usableHeight - value / maximum * usableHeight;
  const points = periods.map((row, index) => `${xFor(index)},${yFor(row.need)}`).join(" ");
  const peak = periods.reduce((current, row) => row.need > current.need ? row : current, periods[0]);

  return (
    <>
      <div
        aria-label={copy("funding.chartLabel", { state: stateLabel })}
        className="funding-curve"
        role="img"
      >
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
          <line className="funding-axis" x1={left} x2={width - right} y1={top + usableHeight} y2={top + usableHeight} />
          <polyline className="funding-area-line" fill="none" points={points} />
          {periods.map((row, index) => (
            <g key={row.period}>
              <circle
                className={row.period === peak.period ? "funding-point peak" : "funding-point"}
                cx={xFor(index)}
                cy={yFor(row.need)}
                r={row.period === peak.period ? 7 : 5}
              />
              <text className="funding-period-label" textAnchor="middle" x={xFor(index)} y={height - 20}>
                {row.period}
              </text>
            </g>
          ))}
        </svg>
        <div className="funding-peak-callout">
          <span>{copy("kpi.peak")}</span>
          <strong>{formatMoney(peak.need, language)}</strong>
          <small>{periodLabel(peak.period)}</small>
        </div>
      </div>
      <div className="funding-mobile-profile" aria-label={copy("funding.chartLabel", { state: stateLabel })}>
        {periods.map((row) => (
          <article key={row.period}>
            <span>{periodLabel(row.period)}</span>
            <strong>{formatMoney(row.need, language)}</strong>
            <div aria-hidden="true"><i style={{ "--bar-size": `${row.need / maximum * 100}%` }} /></div>
          </article>
        ))}
      </div>
    </>
  );
}

function leverValue(id, value, language) {
  if (id === "S-OPS") {
    return `${formatPercent(value[0], language, 1)} / ${formatNumber(value[1] * 100, language, 1)} pt`;
  }
  if (id === "S-TSA") return `${formatNumber(value, language, 0, true)} m`;
  return `${formatNumber(value, language, 2)}x`;
}

function leverStep(id, states, language) {
  const values = Object.values(states);
  if (id === "S-OPS") {
    const growth = Math.abs(values[1][0] - values[0][0]);
    const margin = Math.abs(values[1][1] - values[0][1]);
    return `${formatNumber(growth * 100, language, 1)} pt / ${formatNumber(margin * 100, language, 1)} pt`;
  }
  const first = Math.abs(values[1] - values[0]);
  const second = Math.abs(values[2] - values[1]);
  const suffix = id === "S-TSA" ? " m" : "x";
  return `${formatNumber(first, language, 2)}${suffix} / ${formatNumber(second, language, 2)}${suffix}`;
}

export default function OpellaAnalysisView() {
  const { language } = useLanguage();
  const {
    isCentral,
    reset,
    result,
    selections,
    setLever,
  } = useOpellaScenario();
  const copy = useMemo(() => createOpellaCopy(language), [language]);
  const snapshot = opellaFinancials.snapshot;
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceButtonRef = useRef(null);
  const sourcesById = useMemo(
    () => new Map(snapshot.sources.map((source) => [source.id, source])),
    [snapshot.sources],
  );
  const centralResult = useMemo(() => calculateOpella(opellaFinancials), []);
  const periods = result.calendar.periods.filter(({ inHorizon }) => inHorizon);
  const horizon = result.calendar.horizon;
  const periodLabel = (id) => periodDisplay(result.calendar.periods, id, language, copy);
  const inventoryMetadata = useMemo(
    () => new Map(snapshot.m7.inventory.map((line) => [line.id, line])),
    [snapshot.m7.inventory],
  );
  const inventory = result.modules.m7.inventory;
  const lineById = (id) => inventory.find((line) => line.id === id);
  const amountFor = (id, period) => lineById(id)?.amounts[period] ?? 0;
  const groupAmount = (predicate, period) => sum(
    inventory.filter(predicate).map((line) => line.amounts[period] ?? 0),
  );

  const separationComponents = {
    tsa: Math.abs(sum(Object.values(result.modules.m4.byPeriod))),
    oneOffs: Math.abs(sum(Object.values(result.modules.m5.byPeriod))),
    capex: Math.abs(sum(horizon.map((period) => amountFor("L-SEPCAPEX", period)))),
  };

  const kpis = result.outputs;
  const runRate = kpis["O-RUNRATE"].value;
  const separationCost = kpis["O-SEPCOST"].value;
  const peak = kpis["O-PEAK"];
  const steady = kpis["O-STEADY"].value;

  const functionItems = result.modules.m3.functions.map((item) => {
    const source = snapshot.m3.functions.find(({ id }) => id === item.id);
    return {
      id: item.id,
      label: copy(`function.${item.id}`),
      value: item.runRate,
      driver: copy(`function.${item.id}.driver`),
      status: "estimation",
    };
  });

  const standaloneBridge = [
    {
      id: "perimeter",
      label: copy("standalone.perimeterEbitda"),
      value: formatMoney(result.modules.m1.ebitda[result.calendar.maxHorizon], language, { decimals: 0 }),
      detail: periodLabel(result.calendar.maxHorizon),
      tone: "source",
    },
    {
      id: "allocations",
      label: copy("standalone.sellerAllocations"),
      value: formatMoney(amountFor("L-ALLOC", result.calendar.maxHorizon), language, { signed: true }),
      tone: "positive",
    },
    {
      id: "costs",
      label: copy("standalone.costs"),
      value: formatMoney(-runRate, language, { signed: true }),
      tone: "negative",
    },
    {
      id: "output",
      label: copy("standalone.output"),
      value: formatMoney(result.modules.m6.standaloneRunRate, language),
      tone: "output",
    },
  ];

  const oneOffItems = snapshot.m5.lines.map((source) => {
    const engineLine = lineById(`L-M5-${source.id}`);
    return {
      id: source.id,
      label: copy(`oneOff.${source.id}`),
      status: source.status,
      value: sum(horizon.map((period) => engineLine?.amounts[period] ?? 0)),
      values: Object.fromEntries(horizon.map((period) => [period, engineLine?.amounts[period] ?? 0])),
    };
  });

  const cashRows = [
    ["cash.ebitda", (line) => line.id === "L-EBITDA"],
    ["cash.allocations", (line) => line.id === "L-ALLOC"],
    ["cash.standalone", (line) => line.group === "L-M3"],
    ["cash.tsa", (line) => line.group === "L-M4"],
    ["cash.oneOffs", (line) => line.group === "L-M5"],
    ["cash.separation", (line) => line.group === "L-M6SEP"],
    ["cash.tax", (line) => ["L-TAXREC", "L-TAXPONC"].includes(line.id)],
    ["cash.currentCapex", (line) => line.id === "L-CAPEX"],
    ["cash.currentWc", (line) => line.id === "L-WC"],
    ["cash.other", (line) => line.id === "L-OTHER"],
  ].map(([label, predicate]) => ({
    id: label,
    label: copy(label),
    values: Object.fromEntries(horizon.map((period) => [period, groupAmount(predicate, period)])),
  }));

  const cashBridgeItems = horizon.map((period) => ({
    id: period,
    label: periodLabel(period),
    value: formatMoney(result.modules.m6.cash[period], language),
    detail: copy("common.calculated"),
    tone: "output",
  }));

  const fundingRows = result.modules.m7.periods;
  const fundingLast = fundingRows.at(-1);
  const state = result.modules.m7.resorb.state;
  const stateLabel = copy(stateCopyIds[state]);
  const pk = result.modules.m7.resorb.pk;
  const tolerance = opellaFinancials.contracts.relations.find(
    ({ id }) => id === "R-FUNDING-CUM",
  ).tolerance;
  const grossDiffersFromNeed = Math.abs(fundingLast.sCum - fundingLast.need) > tolerance;
  const residualSurplus = result.modules.m7.horizon.residualSurplus;

  const stateSlots = {
    horizon: periodLabel(result.calendar.maxHorizon),
    pk: pk ? periodLabel(pk) : copy("common.notApplicable"),
  };
  const horizonReferenceSlots = { period: stateSlots.horizon };
  const horizonReference = copy("funding.reference.horizon", horizonReferenceSlots);
  const stateReference = copy("funding.reference.state", horizonReferenceSlots);
  const finalWindowReference = copy("funding.reference.finalWindow", horizonReferenceSlots);
  const conditionalMessages = [];
  if (state === "résorbé" && peak.value <= tolerance) {
    conditionalMessages.push(copy("funding.conditional.noNeed", stateSlots));
  }
  if (state === "résorbé" && peak.value > tolerance && pk === result.calendar.maxHorizon) {
    conditionalMessages.push(copy("funding.conditional.boundaryZero"));
  }
  if (state === "plateau" && pk === result.calendar.maxHorizon) {
    conditionalMessages.push(copy("funding.conditional.boundaryPlateau"));
  }
  if (state === "résorbé" && fundingLast.sCum < -tolerance) {
    conditionalMessages.push(copy("funding.conditional.surplus", {
      surplus: formatMoney(residualSurplus, language),
    }));
  }
  if (state === "croissant à l'horizon" && fundingLast.need <= tolerance) {
    conditionalMessages.push(copy("funding.conditional.zeroButGrowing", {
      surplus: formatMoney(residualSurplus, language),
    }));
  }

  const recurringLines = inventory
    .filter(({ qualification }) => qualification === "récurrent")
    .map((line) => {
      const metadata = inventoryMetadata.get(line.id);
      return {
        ...line,
        declaredEnd: metadata?.declaredEnd,
        label: copy(`line.${line.id}`),
        source: metadata?.source,
        status: metadata?.status,
      };
    });

  const leverContracts = opellaFinancials.contracts.engine.levers;
  const comparisonRows = useMemo(() => {
    const sensitivityRows = Object.entries(leverContracts).flatMap(([id, contract]) => (
      ["basse", "haute"].map((leverState) => ({
        id: `${id}-${leverState}`,
        label: `${copy(`lever.${id}`)} · ${copy(leverStateCopyIds[leverState])}`,
        output: calculateOpella(opellaFinancials, { [id]: leverState }),
      }))
    ));
    return [
      { id: "active", label: copy("common.currentSelection"), output: result },
      { id: "central", label: copy("common.centralCase"), output: centralResult },
      ...sensitivityRows,
    ];
  }, [centralResult, copy, leverContracts, result]);

  useEffect(() => {
    if (!evidenceOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setEvidenceOpen(false);
      evidenceButtonRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [evidenceOpen]);

  const publicEvidenceFacts = [
    {
      id: "revenue-rounded",
      label: copy("evidence.public.revenueRounded"),
      sourceIds: snapshot.m1.revenue.source,
      value: `≈ ${formatBillions(snapshot.m1.revenue.value, language, 0)}`,
    },
    {
      id: "revenue-reported",
      label: copy("evidence.public.revenueReported"),
      sourceIds: snapshot.m1.reportedRevenue.source,
      value: formatMoney(snapshot.m1.reportedRevenue.value, language, { decimals: 0 }),
    },
    {
      id: "enterprise-value",
      label: copy("evidence.public.ev"),
      sourceIds: snapshot.m1.enterpriseValue.source,
      value: `≈ ${formatBillions(snapshot.m1.enterpriseValue.value, language, 0)}`,
    },
    {
      id: "entry-multiple",
      label: copy("evidence.public.multiple"),
      sourceIds: snapshot.m1.entryMultiple.source,
      value: `≈ ${formatMultiple(snapshot.m1.entryMultiple.value, language, 0)}`,
    },
    {
      id: "closing-ownership",
      label: copy("evidence.public.closingOwnership"),
      sourceIds: "S2",
      value: copy("evidence.public.closingOwnershipValue", {
        bpifrance: formatPercent(snapshot.m1.ownership.bpifrance.value, language),
        cdr: formatPercent(snapshot.m1.ownership.cdr.value, language),
        date: formatDate(snapshot.calendar.closing, language),
        sanofi: formatPercent(snapshot.m1.ownership.sanofi.value, language),
      }),
    },
  ];

  const derivedEvidenceValues = [
    {
      formula: copy("evidence.derived.ebitdaFormula"),
      id: "transaction-implied-ebitda",
      label: copy("evidence.derived.ebitda"),
      sourceIds: snapshot.m1.ebitda.source,
      value: `≈ ${formatBillions(snapshot.m1.ebitda.value, language, 2)}`,
    },
    {
      formula: copy("evidence.derived.marginFormula"),
      id: "implied-margin",
      label: copy("evidence.derived.margin"),
      sourceIds: snapshot.m1.margin.source,
      value: `≈ ${formatPercent(snapshot.m1.margin.value, language, 1)}`,
    },
  ];

  const illustrativeAssumptions = [
    {
      id: "perimeter-trajectory",
      label: copy("evidence.assumption.perimeter"),
      reason: copy("evidence.assumption.perimeterReason"),
      value: leverValue(
        "S-OPS",
        leverContracts["S-OPS"].states[selections["S-OPS"]],
        language,
      ),
    },
    {
      id: "seller-allocations",
      label: copy("evidence.assumption.allocations"),
      reason: copy("evidence.assumption.allocationsReason"),
      value: formatPercent(snapshot.m2.rate.value, language, 1),
    },
    {
      id: "standalone-functions",
      label: copy("evidence.assumption.standalone"),
      reason: copy("evidence.assumption.standaloneReason"),
      value: formatMoney(Math.abs(snapshot.m3.runRateTotal), language, { decimals: 0 }),
    },
    {
      id: "transition-services",
      label: copy("evidence.assumption.tsa"),
      reason: copy("evidence.assumption.tsaReason"),
      value: formatMoney(separationComponents.tsa, language, { decimals: 0 }),
    },
    {
      id: "one-offs",
      label: copy("evidence.assumption.oneOffs"),
      reason: copy("evidence.assumption.oneOffsReason"),
      value: formatMoney(separationComponents.oneOffs, language, { decimals: 0 }),
    },
    {
      id: "cash-bridge",
      label: copy("evidence.assumption.cash"),
      reason: copy("evidence.assumption.cashReason"),
      value: [
        formatPercent(snapshot.m6.taxRate.value, language, 1),
        formatPercent(snapshot.m6.capexRate.value, language, 1),
        formatPercent(snapshot.m6.wcIntensity.value, language, 1),
      ].join(" · "),
    },
  ];

  const scenarioEvidenceOutputs = [
    {
      formula: copy("evidence.outputFormula.runRate"),
      id: "run-rate",
      label: copy("kpi.runRate"),
      value: formatMoney(runRate, language, { decimals: 0 }),
    },
    {
      formula: copy("evidence.outputFormula.separationCost"),
      id: "separation-cost",
      label: copy("kpi.separationCost"),
      value: formatMoney(separationCost, language, { decimals: 0 }),
    },
    {
      formula: copy("evidence.outputFormula.peak"),
      id: "funding-peak",
      label: copy("kpi.peak"),
      value: `${formatMoney(peak.value, language, { decimals: 0 })} · ${periodLabel(peak.period)}`,
    },
    {
      formula: copy("evidence.outputFormula.steady"),
      id: "steady-state",
      label: copy("kpi.steady"),
      value: periodLabel(steady),
    },
    {
      formula: copy("evidence.outputFormula.p5Ebitda"),
      id: "central-p5-ebitda",
      label: copy("evidence.output.p5Ebitda"),
      value: formatMoney(centralResult.modules.m1.ebitda.P5, language, { decimals: 0 }),
    },
  ];

  return (
    <article className="opella-analysis-view">
      <section className="opella-hero" id="executive">
        <div className="opella-hero-copy">
          <p className="eyebrow">{copy("executive.eyebrow")}</p>
          <h1>{copy("executive.title")}</h1>
          <p>{copy("executive.intro")}</p>
          <span className="opella-illustrative">{copy("common.illustrative")}</span>
        </div>
        <div aria-label={copy("evidence.chainLabel")} className="opella-evidence-chain">
          <article className="evidence-stage stage-public">
            <span>{copy("evidence.public.title")}</span>
            <p>{copy("evidence.public.text")}</p>
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds="S1+S2+S5+S6"
              sourcesById={sourcesById}
            />
          </article>
          <article className="evidence-stage stage-derived">
            <span>{copy("evidence.derived.title")}</span>
            <p>{copy("evidence.derived.text")}</p>
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds="S1+S5+S6"
              sourcesById={sourcesById}
            />
          </article>
          <article className="evidence-stage stage-assumptions">
            <span>{copy("evidence.assumptions.title")}</span>
            <p>{copy("evidence.assumptions.text")}</p>
            <small data-source-id="S4">{copy("common.internalAssumption")}</small>
          </article>
          <article className="evidence-stage stage-outputs">
            <span>{copy("evidence.outputs.title")}</span>
            <p>{copy("evidence.outputs.text")}</p>
            <small>{copy("common.modelOutput")}</small>
          </article>
        </div>
        <button
          aria-controls="opella-evidence-panel"
          aria-expanded={evidenceOpen}
          className="opella-evidence-toggle"
          onClick={() => setEvidenceOpen((current) => !current)}
          ref={evidenceButtonRef}
          type="button"
        >
          {copy("evidence.toggle")}
          <span aria-hidden="true">{evidenceOpen ? "−" : "+"}</span>
        </button>
        <section
          aria-labelledby="opella-evidence-panel-title"
          className="opella-evidence-panel"
          hidden={!evidenceOpen}
          id="opella-evidence-panel"
        >
          <header>
            <div>
              <p className="eyebrow">{copy("evidence.chainLabel")}</p>
              <h2 id="opella-evidence-panel-title">{copy("evidence.panelTitle")}</h2>
              <p>{copy("evidence.panelIntro")}</p>
            </div>
            <button
              aria-label={copy("evidence.close")}
              onClick={() => {
                setEvidenceOpen(false);
                evidenceButtonRef.current?.focus();
              }}
              type="button"
            >
              ×
            </button>
          </header>

          <div className="evidence-panel-group">
            <h3>{copy("evidence.publicFacts")}</h3>
            <div className="evidence-card-grid">
              {publicEvidenceFacts.map((fact) => (
                <article
                  data-public-fact-id={fact.id}
                  data-source-ids={fact.sourceIds}
                  key={fact.id}
                >
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                  <StatusTag copy={copy} status="public" />
                  <SourceReferenceBlock
                    copy={copy}
                    sourceIds={fact.sourceIds}
                    sourcesById={sourcesById}
                  />
                </article>
              ))}
            </div>
          </div>

          <div className="evidence-panel-group">
            <h3>{copy("evidence.derivedValues")}</h3>
            <div className="evidence-card-grid derived">
              {derivedEvidenceValues.map((fact) => (
                <article data-derived-value-id={fact.id} key={fact.id}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                  <StatusTag copy={copy} status="calculé" />
                  <p><b>{copy("evidence.formula")}:</b> {fact.formula}</p>
                  <p className="evidence-operands">{copy("evidence.operands")}</p>
                  <SourceReferenceBlock
                    copy={copy}
                    sourceIds={fact.sourceIds}
                    sourcesById={sourcesById}
                  />
                </article>
              ))}
            </div>
          </div>

          <div className="evidence-panel-group">
            <h3>{copy("evidence.assumptionModules")}</h3>
            <div className="evidence-assumption-list">
              {illustrativeAssumptions.map((assumption) => (
                <article data-assumption-key={assumption.id} data-source-id="S4" key={assumption.id}>
                  <div>
                    <strong>{assumption.label}</strong>
                    <p>{assumption.reason}</p>
                  </div>
                  <span>{assumption.value}</span>
                  <small>{copy("common.internalAssumption")}</small>
                </article>
              ))}
            </div>
          </div>

          <div className="evidence-panel-group">
            <h3>{copy("evidence.scenarioOutputs")}</h3>
            <div className="evidence-output-list">
              {scenarioEvidenceOutputs.map((output) => (
                <article data-scenario-output-id={output.id} key={output.id}>
                  <span>{output.label}</span>
                  <strong>{output.value}</strong>
                  <p><b>{copy("evidence.formula")}:</b> {output.formula}</p>
                </article>
              ))}
            </div>
            <p className="evidence-output-caveat">{copy("evidence.outputCaveat")}</p>
            <p className="evidence-scope-caveat">{copy("evidence.scopeCaveat")}</p>
            <a href="#diligence">{copy("buyer.link")} ↓</a>
          </div>
        </section>
        <div aria-label={copy("nav.executive")} className="opella-kpi-grid">
          <MetricTile
            detail={copy("kpi.runRate.detail")}
            label={copy("kpi.runRate")}
            meta={<span className="opella-output-status">{copy("common.modelOutput")}</span>}
            outputId="O-RUNRATE"
            tone="neutral"
            value={formatMoney(runRate, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.separationCost.detail")}
            label={copy("kpi.separationCost")}
            meta={(
              <span className="opella-sepcost-components">
                <small>{copy("common.modelOutput")}</small>
                <span>
                  TSA {formatMoney(separationComponents.tsa, language)} ·
                  {" "}{copy("nav.oneOffs")} {formatMoney(separationComponents.oneOffs, language)} ·
                  {" "}Capex {formatMoney(separationComponents.capex, language)}
                </span>
              </span>
            )}
            outputId="O-SEPCOST"
            tone="neutral"
            value={formatMoney(separationCost, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.peak.detail", { period: periodLabel(peak.period) })}
            label={copy("kpi.peak")}
            meta={<span className="opella-output-status">{copy("common.modelOutput")}</span>}
            outputId="O-PEAK"
            tone="neutral"
            value={formatMoney(peak.value, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.steady.detail")}
            label={copy("kpi.steady")}
            meta={<span className="opella-output-status">{copy("common.modelOutput")}</span>}
            outputId="O-STEADY"
            tone="neutral"
            value={periodLabel(steady)}
          />
        </div>
      </section>

      <Section
        id="transaction"
        kicker={copy("transaction.kicker")}
        title={copy("transaction.title")}
      >
        <p className="opella-section-intro">{copy("transaction.intro")}</p>
        <div className="opella-fact-grid">
          <article
            data-public-fact-id="transaction-enterprise-value"
            data-source-ids={snapshot.m1.enterpriseValue.source}
          >
            <span>{copy("transaction.ev")}</span>
            <strong>≈ {formatBillions(snapshot.m1.enterpriseValue.value, language, 0)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.enterpriseValue.status} />
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds={snapshot.m1.enterpriseValue.source}
              sourcesById={sourcesById}
            />
          </article>
          <article
            data-public-fact-id="transaction-entry-multiple"
            data-source-ids={snapshot.m1.entryMultiple.source}
          >
            <span>{copy("transaction.multiple")}</span>
            <strong>≈ {formatMultiple(result.modules.m1.entryMultiple, language, 0)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.entryMultiple.status} />
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds={snapshot.m1.entryMultiple.source}
              sourcesById={sourcesById}
            />
          </article>
          <article data-public-fact-id="transaction-closing" data-source-ids="S2">
            <span>{copy("transaction.closing")}</span>
            <strong>{formatDate(snapshot.calendar.closing, language)}</strong>
            <StatusTag copy={copy} status="public" />
            <SourceReferenceBlock compact copy={copy} sourceIds="S2" sourcesById={sourcesById} />
          </article>
        </div>
        <div className="opella-ownership" aria-label={copy("transaction.ownership")}>
          <h3>{copy("transaction.ownership")}</h3>
          {Object.entries(snapshot.m1.ownership).map(([holder, field]) => (
            <div
              data-public-fact-id={`transaction-ownership-${holder}`}
              data-source-ids={field.source}
              key={holder}
            >
              <span>{copy(`transaction.holder.${holder}`)}</span>
              <strong>{formatPercent(field.value, language)}</strong>
              <StatusTag copy={copy} status={field.status} />
              <SourceReferenceBlock
                compact
                copy={copy}
                sourceIds={field.source}
                sourcesById={sourcesById}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="perimeter"
        kicker={copy("perimeter.kicker")}
        title={copy("perimeter.title")}
      >
        <p className="opella-section-intro">{copy("perimeter.intro")}</p>
        <div className="opella-fact-grid">
          <article
            data-public-fact-id="perimeter-rounded-revenue"
            data-source-ids={snapshot.m1.revenue.source}
          >
            <span>{copy("perimeter.revenue")}</span>
            <strong>≈ {formatBillions(snapshot.m1.revenue.value, language, 0)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.revenue.status} />
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds={snapshot.m1.revenue.source}
              sourcesById={sourcesById}
            />
          </article>
          <article
            data-public-fact-id="perimeter-reported-revenue"
            data-source-ids={snapshot.m1.reportedRevenue.source}
          >
            <span>{copy("perimeter.reportedRevenue")}</span>
            <strong>{formatMoney(snapshot.m1.reportedRevenue.value, language, { decimals: 0 })}</strong>
            <StatusTag copy={copy} status={snapshot.m1.reportedRevenue.status} />
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds={snapshot.m1.reportedRevenue.source}
              sourcesById={sourcesById}
            />
          </article>
          <article data-derived-value-id="perimeter-implied-margin">
            <span>{copy("perimeter.margin")}</span>
            <strong>≈ {formatPercent(snapshot.m1.margin.value, language, 1)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.margin.status} />
            <small><b>{copy("evidence.formula")}:</b> {copy("evidence.derived.marginFormula")}</small>
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds={snapshot.m1.margin.source}
              sourcesById={sourcesById}
            />
          </article>
          <article data-derived-value-id="perimeter-transaction-implied-ebitda">
            <span>{copy("perimeter.ebitda")}</span>
            <strong>≈ {formatBillions(snapshot.m1.ebitda.value, language, 2)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.ebitda.status} />
            <small><b>{copy("evidence.formula")}:</b> {copy("evidence.derived.ebitdaFormula")}</small>
            <SourceReferenceBlock
              compact
              copy={copy}
              sourceIds={snapshot.m1.ebitda.source}
              sourcesById={sourcesById}
            />
          </article>
        </div>
        <p className="evidence-scope-caveat">{copy("evidence.scopeCaveat")}</p>
      </Section>

      <Section
        id="standalone-build"
        kicker={copy("standalone.kicker")}
        title={copy("standalone.title")}
      >
        <p className="opella-section-intro">{copy("standalone.intro")}</p>
        <BridgeGraphic ariaLabel={copy("standalone.bridgeLabel")} items={standaloneBridge} />
        <DataTable
          columns={[copy("cash.line"), copy("common.value"), copy("common.status")]}
          getRowKey={(row) => row[0]}
          highlightColumn={1}
          label={copy("standalone.bridgeLabel")}
          rowHeaderColumn={0}
          rows={standaloneBridge.map((item) => [
            item.label,
            item.value,
            item.id === "output" ? copy("common.calculated") : copy("common.estimated"),
          ])}
        />
        <BarGraphic
          copy={copy}
          items={functionItems}
          label={copy("standalone.functionsLabel")}
          valueFormatter={(value) => formatMoney(Math.abs(value), language)}
        />
        <DataTable
          columns={[
            copy("standalone.function"),
            copy("common.value"),
            copy("standalone.driver"),
            copy("common.status"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={1}
          label={copy("standalone.functionsLabel")}
          rowHeaderColumn={0}
          rows={functionItems.map((item) => [
            item.label,
            formatMoney(Math.abs(item.value), language),
            item.driver,
            statusLabel(item.status, copy),
          ])}
        />
      </Section>

      <Section id="tsa" kicker={copy("tsa.kicker")} title={copy("tsa.title")}>
        <p className="opella-section-intro">{copy("tsa.intro")}</p>
        <div aria-label={copy("tsa.timelineLabel")} className="tsa-timeline" role="img">
          <div className="tsa-timeline-head">
            <span>{copy("tsa.service")}</span>
            {horizon.map((period) => <span key={period}>{period}</span>)}
          </div>
          {result.modules.m4.services.map((service) => (
            <div className="tsa-timeline-row" key={service.id}>
              <strong>{copy(`service.${service.id}`)}</strong>
              {horizon.map((period) => (
                <span
                  className={(service.monthsByPeriod[period] ?? 0) > 0 ? "active" : ""}
                  key={period}
                  title={formatMoney(service.costByPeriod[period] ?? 0, language, { signed: true })}
                >
                  {(service.monthsByPeriod[period] ?? 0) > 0
                    ? copy("tsa.months", { value: service.monthsByPeriod[period] })
                    : ""}
                </span>
              ))}
            </div>
          ))}
        </div>
        <DataTable
          columns={[
            copy("tsa.service"),
            copy("tsa.monthly"),
            copy("tsa.duration"),
            copy("tsa.doubleRun"),
            ...horizon,
            copy("tsa.strategy"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={null}
          label={copy("tsa.timelineLabel")}
          rowHeaderColumn={0}
          rows={result.modules.m4.services.map((service) => [
            copy(`service.${service.id}`),
            formatMoney(service.monthly, language, { signed: true }),
            copy("tsa.months", { value: service.duration }),
            copy("tsa.months", { value: service.doubleRunMonths }),
            ...horizon.map((period) => formatMoney(service.costByPeriod[period] ?? 0, language, { signed: true })),
            copy(`service.${service.id}.strategy`),
          ])}
        />
      </Section>

      <Section id="one-offs" kicker={copy("oneOffs.kicker")} title={copy("oneOffs.title")}>
        <p className="opella-section-intro">{copy("oneOffs.intro")}</p>
        <BarGraphic
          copy={copy}
          items={oneOffItems}
          label={copy("oneOffs.chartLabel")}
          valueFormatter={(value) => formatMoney(Math.abs(value), language)}
        />
        <DataTable
          columns={[
            copy("oneOffs.nature"),
            ...horizon,
            copy("common.total"),
            copy("common.status"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={horizon.length + 1}
          label={copy("oneOffs.chartLabel")}
          rowHeaderColumn={0}
          rows={oneOffItems.map((item) => [
            item.label,
            ...horizon.map((period) => formatMoney(item.values[period], language, { signed: true })),
            formatMoney(Math.abs(item.value), language),
            statusLabel(item.status, copy),
          ])}
        />
      </Section>

      <Section id="cash-transition" kicker={copy("cash.kicker")} title={copy("cash.title")}>
        <p className="opella-section-intro">{copy("cash.intro")}</p>
        <BridgeGraphic ariaLabel={copy("cash.chartLabel")} items={cashBridgeItems} />
        <DataTable
          columns={[copy("cash.line"), ...horizon]}
          getRowKey={(row) => row[0]}
          highlightColumn={null}
          label={copy("cash.chartLabel")}
          rowHeaderColumn={0}
          rows={[
            ...cashRows.map((row) => [
              row.label,
              ...horizon.map((period) => formatMoney(row.values[period], language, { signed: true })),
            ]),
            [
              copy("common.total"),
              ...horizon.map((period) => formatMoney(result.modules.m6.cash[period], language, { signed: true })),
            ],
          ]}
        />
      </Section>

      <Section id="funding-need" kicker={copy("funding.kicker")} title={copy("funding.title")}>
        <p className="opella-section-intro">{copy("funding.intro")}</p>
        <FundingCurve
          copy={copy}
          language={language}
          periodLabel={periodLabel}
          periods={fundingRows}
          stateLabel={stateLabel}
        />
        <p className="funding-peak-announcement">
          <strong>{formatMoney(peak.value, language)}</strong>
          {" · "}
          {copy("funding.peakAnnouncement", { period: periodLabel(peak.period) })}
        </p>
        <DataTable
          columns={[
            copy("common.period"),
            copy("funding.periodNeed"),
            copy("funding.periodChange"),
            copy("funding.periodRecurringGap"),
            copy("funding.periodOneOffGap"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={1}
          label={copy("funding.periodTable")}
          rowHeaderColumn={0}
          rows={fundingRows.map((row) => [
            periodLabel(row.period),
            formatMoney(row.need, language),
            formatMoney(row.s, language, { signed: true }),
            formatMoney(row.eGap, language, { signed: true }),
            formatMoney(row.nOneOff, language, { signed: true }),
          ])}
        />

        <aside
          aria-labelledby="opella-funding-state-title"
          className="funding-state-card"
          data-content-id="opella.funding.state"
        >
          <div className="funding-state-heading">
            <span>{copy("funding.stateTitle")}</span>
            <h3 id="opella-funding-state-title">{stateLabel}</h3>
          </div>
          <p>{copy(stateMessageIds[state], stateSlots)}</p>
          {conditionalMessages.map((message) => <p key={message}>{message}</p>)}
          <p>{copy("funding.notDebt")}</p>
          <DataTable
            columns={[
              copy("common.indicator"),
              copy("common.value"),
              copy("common.reference"),
            ]}
            getRowKey={(row) => row[0]}
            highlightColumn={1}
            label={`${copy("funding.stateTitle")} · ${stateLabel}`}
            rowHeaderColumn={0}
            rows={[
              [copy("funding.stateTitle"), stateLabel, stateReference],
              [
                state === "plateau"
                  ? copy("funding.plateauAtHorizon")
                  : state === "non résorbé à l'horizon"
                    ? copy("funding.residualNeed")
                    : copy("funding.needAtHorizon"),
                formatMoney(fundingLast.need, language),
                horizonReference,
              ],
              [
                copy("funding.delta"),
                formatMoney(result.modules.m7.horizon.delta, language, { signed: true }),
                horizonReference,
              ],
              [
                copy("funding.recurringGap"),
                formatMoney(fundingLast.eGap, language, { signed: true }),
                horizonReference,
              ],
              [
                copy("funding.oneOffGap"),
                formatMoney(fundingLast.nOneOff, language, { signed: true }),
                horizonReference,
              ],
              ...(grossDiffersFromNeed ? [[
                copy("funding.grossBalance"),
                formatMoney(fundingLast.sCum, language, { signed: true }),
                horizonReference,
              ]] : []),
              ...(state === "résorbé" && fundingLast.sCum < -tolerance
                ? [[
                  copy("funding.residualSurplus"),
                  formatMoney(residualSurplus, language),
                  horizonReference,
                ]]
                : []),
              [
                copy("funding.pk"),
                pk ? periodLabel(pk) : copy("common.notApplicable"),
                finalWindowReference,
              ],
            ]}
          />
          <div className="funding-counterfactual">
            <strong>{copy("funding.counterfactual")}</strong>
            <p>{copy("funding.counterfactualText")}</p>
          </div>
        </aside>

        <h3 className="opella-subtitle">{copy("funding.recurringLines")}</h3>
        <DataTable
          columns={[
            copy("cash.line"),
            copy("common.value"),
            copy("common.recurring"),
            copy("common.declaredEnd"),
            copy("common.status"),
            copy("common.source"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={1}
          label={copy("funding.recurringLines")}
          rowHeaderColumn={0}
          rows={recurringLines.map((line) => [
            line.label,
            formatMoney(line.contribution[result.calendar.maxHorizon], language, { signed: true }),
            copy("common.recurring"),
            line.declaredEnd ? periodLabel(line.declaredEnd) : copy("common.noDeclaredEnd"),
            statusLabel(line.status, copy),
            line.source,
          ])}
        />
      </Section>

      <Section id="scenarios" kicker={copy("scenarios.kicker")} title={copy("scenarios.title")}>
        <p className="opella-section-intro">{copy("scenarios.intro")}</p>
        <div aria-label={copy("scenarios.panelLabel")} className="opella-scenario-panel" role="group">
          {Object.entries(leverContracts).map(([id, contract]) => (
            <fieldset className="opella-lever" key={id}>
              <legend>{copy(`lever.${id}`)}</legend>
              <div className="opella-lever-meta">
                <span>{copy("scenarios.unit", { unit: copy(leverUnitCopyIds[id]) })}</span>
                <span>{copy("scenarios.step", { step: leverStep(id, contract.states, language) })}</span>
              </div>
              <div className="opella-lever-options">
                {Object.entries(contract.states).map(([leverState, value]) => (
                  <button
                    aria-label={`${copy(`lever.${id}`)} · ${copy(leverStateCopyIds[leverState])} · ${leverValue(id, value, language)}`}
                    aria-pressed={selections[id] === leverState}
                    key={leverState}
                    onClick={() => setLever(id, leverState)}
                    type="button"
                  >
                    <span>{copy(leverStateCopyIds[leverState])}</span>
                    <strong>{leverValue(id, value, language)}</strong>
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <div aria-live="polite" className="opella-scenario-summary">
            <span>{isCentral ? copy("common.centralCase") : copy("common.currentSelection")}</span>
            <button disabled={isCentral} onClick={reset} type="button">
              {copy("scenarios.reset")}
            </button>
          </div>
        </div>
        <h3 className="opella-subtitle">{copy("scenarios.comparison")}</h3>
        <DataTable
          columns={[
            copy("scenarios.combination"),
            copy("kpi.runRate"),
            copy("kpi.separationCost"),
            copy("kpi.peak"),
            copy("kpi.steady"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={null}
          label={copy("scenarios.comparison")}
          rowHeaderColumn={0}
          rows={comparisonRows.map(({ label, output }) => [
            label,
            formatMoney(output.outputs["O-RUNRATE"].value, language),
            formatMoney(output.outputs["O-SEPCOST"].value, language),
            `${formatMoney(output.outputs["O-PEAK"].value, language)} · ${periodDisplay(
              output.calendar.periods,
              output.outputs["O-PEAK"].period,
              language,
              copy,
            )}`,
            periodDisplay(
              output.calendar.periods,
              output.outputs["O-STEADY"].value,
              language,
              copy,
            ),
          ])}
        />
      </Section>

      <Section id="buyer-implications" kicker={copy("buyer.kicker")} title={copy("buyer.title")}>
        <aside aria-label={`${copy("buyer.title")} · ${copy("common.illustrative")}`} className="buyer-implications">
          <p>{copy("buyer.qualitative")}</p>
          <a href="#diligence">{copy("buyer.link")} ↓</a>
        </aside>
      </Section>

      <Section id="diligence" kicker={copy("diligence.kicker")} title={copy("diligence.title")}>
        <p className="opella-section-intro">{copy("diligence.intro")}</p>
        <DataTable
          columns={[copy("diligence.item"), copy("diligence.effect"), copy("common.status")]}
          getRowKey={(row) => row[0]}
          highlightColumn={null}
          label={copy("nav.diligence")}
          rowHeaderColumn={0}
          rows={opellaDiligenceItems.map((id) => [
            copy(id),
            copy(`${id}.effect`),
            copy("common.toConfirm"),
          ])}
        />
      </Section>

      <Section id="sources" kicker={copy("sources.kicker")} title={copy("sources.title")}>
        <p className="opella-section-intro">{copy("sources.intro")}</p>
        <div aria-label={copy("nav.sources")} className="opella-source-registry">
          {snapshot.sources.map((source) => (
            <article data-source-registry-id={source.id} key={source.id}>
              <header>
                <div>
                  <h3>{copy(`source.${source.id}.label`)}</h3>
                  <small>{source.id}</small>
                </div>
                <StatusTag copy={copy} status={source.status} />
              </header>
              <dl>
                <div>
                  <dt>{copy("sources.document")}</dt>
                  <dd>{source.id === "S4" ? copy("sources.internalOnly") : source.document}</dd>
                </div>
                <div>
                  <dt>{copy("sources.fact")}</dt>
                  <dd>{copy(`source.${source.id}.coverage`, {
                    ev: formatBillions(snapshot.m1.enterpriseValue.value, language, 0),
                    multiple: formatMultiple(snapshot.m1.entryMultiple.value, language, 0),
                    revenue: source.id === "S5"
                      ? formatMoney(snapshot.m1.reportedRevenue.value, language, { decimals: 0 })
                      : formatBillions(snapshot.m1.revenue.value, language, 0),
                  })}</dd>
                </div>
                <div>
                  <dt>{copy("sources.scope")}</dt>
                  <dd>{copy(`source.${source.id}.scope`, {
                    date: formatDate(snapshot.calendar.closing, language),
                  })}</dd>
                </div>
                <div>
                  <dt>{copy("sources.location")}</dt>
                  <dd data-source-location={source.id === "S4" ? "internal" : source.location}>
                    {source.id === "S4" ? copy("sources.internalOnly") : source.location}
                  </dd>
                </div>
                <div>
                  <dt>{copy("sources.publicationDate")}</dt>
                  <dd>{source.id === "S4"
                    ? copy("common.notApplicable")
                    : source.publication_date === "not-stated"
                    ? copy("common.notStated")
                    : formatDate(source.publication_date, language)}</dd>
                </div>
                <div>
                  <dt>{copy("sources.accessed")}</dt>
                  <dd>{formatDate(source.accessed, language)}</dd>
                </div>
                <div>
                  <dt>{copy("sources.evidenceRole")}</dt>
                  <dd>{copy(`sources.role.${source.evidence_role}`)}</dd>
                </div>
              </dl>
              {source.references.some(({ url }) => Boolean(url)) ? (
                <SourceReferenceBlock
                  copy={copy}
                  sourceIds={source.id}
                  sourcesById={sourcesById}
                />
              ) : (
                <p className="source-internal-only" data-source-id="S4">
                  {copy("sources.internalOnly")}
                </p>
              )}
            </article>
          ))}
        </div>
        <div className="opella-limitations">
          <p>{copy("sources.limit.estimates")}</p>
          <p>{copy("sources.limit.stub")}</p>
          <p>{copy("sources.limit.noFullCashflow")}</p>
          <p>{copy("sources.limit.noUnderwriting")}</p>
          <p className="opella-no-download">{copy("sources.noDownload")}</p>
        </div>

        <section className="opella-methodology" id="methodology">
          <p className="eyebrow">{copy("methodology.kicker")}</p>
          <h3>{copy("methodology.title")}</h3>
          <div>
            <p>{copy("methodology.stub")}</p>
            <p>{copy("methodology.steady")}</p>
            <p>{copy("methodology.signs")}</p>
            <p>{copy("methodology.separationCost")}</p>
            <p>{copy("methodology.counterfactual")}</p>
          </div>
        </section>
      </Section>
    </article>
  );
}
