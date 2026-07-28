import { useMemo } from "react";
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
    const central = calculateOpella(opellaFinancials);
    const sensitivityRows = Object.entries(leverContracts).flatMap(([id, contract]) => (
      ["basse", "haute"].map((leverState) => ({
        id: `${id}-${leverState}`,
        label: `${copy(`lever.${id}`)} · ${copy(leverStateCopyIds[leverState])}`,
        output: calculateOpella(opellaFinancials, { [id]: leverState }),
      }))
    ));
    return [
      { id: "active", label: copy("common.currentSelection"), output: result },
      { id: "central", label: copy("common.centralCase"), output: central },
      ...sensitivityRows,
    ];
  }, [copy, leverContracts, result]);

  const sourceRows = snapshot.sources.map((source) => {
    const publicReference = source.references.find(({ url }) => Boolean(url));
    return [
      source.id,
      copy(`source.${source.id}.label`),
      formatDate(source.value_date, language),
      statusLabel(source.status, copy),
      copy(`source.${source.id}.coverage`),
      publicReference ? (
        <a href={publicReference.url} rel="noreferrer" target="_blank">
          {copy("sources.open")} ↗
        </a>
      ) : copy("common.notApplicable"),
    ];
  });

  return (
    <article className="opella-analysis-view">
      <section className="opella-hero" id="executive">
        <div className="opella-hero-copy">
          <p className="eyebrow">{copy("executive.eyebrow")}</p>
          <h1>{copy("executive.title")}</h1>
          <p>{copy("executive.intro")}</p>
          <span className="opella-illustrative">{copy("common.illustrative")}</span>
        </div>
        <div aria-label={copy("nav.executive")} className="opella-kpi-grid">
          <MetricTile
            detail={copy("kpi.runRate.detail")}
            label={copy("kpi.runRate")}
            meta={<StatusTag copy={copy} status="estimation" />}
            outputId="O-RUNRATE"
            tone="neutral"
            value={formatMoney(runRate, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.separationCost.detail")}
            label={copy("kpi.separationCost")}
            meta={(
              <span className="opella-sepcost-components">
                TSA {formatMoney(separationComponents.tsa, language)} ·
                {" "}{copy("nav.oneOffs")} {formatMoney(separationComponents.oneOffs, language)} ·
                {" "}Capex {formatMoney(separationComponents.capex, language)}
              </span>
            )}
            outputId="O-SEPCOST"
            tone="neutral"
            value={formatMoney(separationCost, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.peak.detail", { period: periodLabel(peak.period) })}
            label={copy("kpi.peak")}
            meta={<StatusTag copy={copy} status="calculé" />}
            outputId="O-PEAK"
            tone="neutral"
            value={formatMoney(peak.value, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.steady.detail")}
            label={copy("kpi.steady")}
            meta={<StatusTag copy={copy} status="calculé" />}
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
          <article>
            <span>{copy("transaction.ev")}</span>
            <strong>{formatMoney(snapshot.m1.enterpriseValue.value, language, { decimals: 0 })}</strong>
            <StatusTag copy={copy} status={snapshot.m1.enterpriseValue.status} />
            <small>{snapshot.m1.enterpriseValue.source}</small>
          </article>
          <article>
            <span>{copy("transaction.multiple")}</span>
            <strong>{formatMultiple(result.modules.m1.entryMultiple, language)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.entryMultiple.status} />
            <small>{snapshot.m1.entryMultiple.source}</small>
          </article>
          <article>
            <span>{copy("transaction.closing")}</span>
            <strong>{formatDate(snapshot.calendar.closing, language)}</strong>
            <StatusTag copy={copy} status="public" />
            <small>S2</small>
          </article>
        </div>
        <div className="opella-ownership" aria-label={copy("transaction.ownership")}>
          <h3>{copy("transaction.ownership")}</h3>
          {Object.entries(snapshot.m1.ownership).map(([holder, field]) => (
            <div key={holder}>
              <span>{copy(`transaction.holder.${holder}`)}</span>
              <strong>{formatPercent(field.value, language)}</strong>
              <StatusTag copy={copy} status={field.status} />
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
          <article>
            <span>{copy("perimeter.revenue")}</span>
            <strong>{formatMoney(snapshot.m1.revenue.value, language, { decimals: 0 })}</strong>
            <StatusTag copy={copy} status={snapshot.m1.revenue.status} />
            <small>{snapshot.m1.revenue.source}</small>
          </article>
          <article>
            <span>{copy("perimeter.margin")}</span>
            <strong>{formatPercent(snapshot.m1.margin.value, language, 2)}</strong>
            <StatusTag copy={copy} status={snapshot.m1.margin.status} />
            <small>{snapshot.m1.margin.source}</small>
          </article>
          <article>
            <span>{copy("perimeter.ebitda")}</span>
            <strong>{formatMoney(snapshot.m1.ebitda.value, language, { decimals: 0 })}</strong>
            <StatusTag copy={copy} status={snapshot.m1.ebitda.status} />
            <small>{snapshot.m1.ebitda.formulaId}</small>
          </article>
        </div>
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
        <DataTable
          columns={[
            "ID",
            copy("sources.reference"),
            copy("sources.valueDate"),
            copy("common.status"),
            copy("sources.coverage"),
            copy("common.source"),
          ]}
          getRowKey={(row) => row[0]}
          highlightColumn={null}
          label={copy("nav.sources")}
          rowHeaderColumn={0}
          rows={sourceRows}
        />
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
