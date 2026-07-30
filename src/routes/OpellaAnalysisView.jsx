import {
  useMemo,
  useState,
} from "react";
import DataTable from "../components/DataTable.jsx";
import MetricTile from "../components/MetricTile.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useOpellaScenario } from "../context/OpellaScenarioContext.jsx";
import {
  createOpellaCopy,
  opellaDiligenceItems,
} from "../data/opellaCase.js";
import { opellaFinancials } from "../data/opellaFinancials.js";

const ISO_YEAR_TOKEN = "YYYY";

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
    return `${period.id} · ${copy("calendar.stub", { year: period.end.slice(0, ISO_YEAR_TOKEN.length) })}`;
  }
  return `${period.id} · ${period.label}`;
}

function periodCalendarDisplay(periods, periodId, language, copy) {
  const period = periods.find(({ id }) => id === periodId);
  if (!period) return copy("common.notReached");
  if (period.id === "P1") {
    return copy("calendar.stub", { year: period.end.slice(0, ISO_YEAR_TOKEN.length) });
  }
  return period.label;
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

function Section({ children, className = "", id, kicker, title }) {
  return (
    <section className={`opella-section ${className}`.trim()} id={id}>
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

function MethodTabs({ assumptions, chainSteps, copy, mechanics }) {
  const tabs = ["proof", "assumptions", "mechanics"];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  const handleTabKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab);
    event.currentTarget.parentElement
      ?.querySelector(`[data-method-tab="${nextTab}"]`)
      ?.focus();
  };

  return (
    <section aria-labelledby="opella-method-title" className="opella-method">
      <header className="opella-method-header">
        <p className="eyebrow">{copy("method.compact.kicker")}</p>
        <h2 id="opella-method-title">{copy("method.compact.title")}</h2>
      </header>

      <div aria-label={copy("method.compact.tabsLabel")} className="opella-method-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`opella-method-panel-${tab}`}
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            data-method-tab={tab}
            id={`opella-method-tab-${tab}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
            role="tab"
            tabIndex={activeTab === tab ? 0 : -1}
            type="button"
          >
            {copy(`method.compact.tab.${tab}`)}
          </button>
        ))}
      </div>

      <div
        aria-labelledby="opella-method-tab-proof"
        className="opella-method-panel opella-method-proof"
        hidden={activeTab !== "proof"}
        id="opella-method-panel-proof"
        role="tabpanel"
        tabIndex={0}
      >
        <ol className="opella-proof-chain">
          {chainSteps.map((step, index) => (
            <li data-proof-step={index + 1} key={step.title}>
              <span aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <small>{step.value}</small>
              </div>
            </li>
          ))}
        </ol>
        <aside className="opella-method-reading">
          <h3>{copy("method.compact.reading.title")}</h3>
          <p>{copy("method.compact.reading.text")}</p>
        </aside>
      </div>

      <div
        aria-labelledby="opella-method-tab-assumptions"
        className="opella-method-panel"
        hidden={activeTab !== "assumptions"}
        id="opella-method-panel-assumptions"
        role="tabpanel"
        tabIndex={0}
      >
        <div className="opella-assumption-table" role="table">
          <div className="opella-assumption-row opella-assumption-header" role="row">
            <span role="columnheader">{copy("method.compact.assumption")}</span>
            <span role="columnheader">{copy("method.compact.centralValue")}</span>
            <span role="columnheader">{copy("method.compact.financialConstruction")}</span>
            <span role="columnheader">{copy("method.compact.mainEffect")}</span>
          </div>
          {assumptions.map((assumption) => (
            <div className="opella-assumption-row" data-assumption-key={assumption.id} key={assumption.id} role="row">
              <strong role="rowheader">{assumption.label}</strong>
              <span data-label={copy("method.compact.centralValue")} role="cell">{assumption.value}</span>
              <span data-label={copy("method.compact.financialConstruction")} role="cell">{assumption.construction}</span>
              <span data-label={copy("method.compact.mainEffect")} role="cell">{assumption.effect}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-labelledby="opella-method-tab-mechanics"
        className="opella-method-panel"
        hidden={activeTab !== "mechanics"}
        id="opella-method-panel-mechanics"
        role="tabpanel"
        tabIndex={0}
      >
        <div className="opella-mechanics-list">
          {mechanics.map((mechanic) => (
            <details data-mechanic-key={mechanic.id} key={mechanic.id}>
              <summary>
                <strong className="opella-mechanic-title">{mechanic.title}</strong>
                <b className="opella-mechanic-result">{mechanic.result}</b>
                <span className="opella-mechanic-toggle">
                  <span className="when-closed">{copy("method.compact.showCalculation")}</span>
                  <span className="when-open">{copy("method.compact.hideCalculation")}</span>
                  <i aria-hidden="true">▾</i>
                </span>
              </summary>
              <div className="opella-mechanic-detail">
                {mechanic.conditions ? (
                  <div className="opella-steady-conditions">
                    <p>{copy("method.compact.steady.intro", { period: mechanic.result })}</p>
                    <ul>
                      {mechanic.conditions.map((condition) => (
                        <li key={condition.label}>
                          <span>{condition.label}</span>
                          <strong>{condition.value}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <strong>{mechanic.equation}</strong>
                )}
                <p>{mechanic.explanation}</p>
              </div>
            </details>
          ))}
        </div>
        <nav aria-label={copy("method.compact.linksLabel")} className="opella-method-links">
          <a href="#methodology">{copy("method.compact.fullMethodology")} ↓</a>
          <a href="#sources">{copy("method.compact.sources")} ↓</a>
        </nav>
      </div>
    </section>
  );
}

function SourceRegistry({ copy, language, snapshot, sourcesById }) {
  return (
    <div aria-label={copy("nav.sources")} className="opella-source-registry">
      {snapshot.sources.map((source) => (
        <article data-source-registry-id={source.id} key={source.id}>
          <details>
            <summary>
              <div>
                <span>{source.id}</span>
                <h3>{copy(`source.${source.id}.label`)}</h3>
                <p>{copy(`source.${source.id}.coverage`, {
                  ev: formatBillions(snapshot.m1.enterpriseValue.value, language, 0),
                  multiple: formatMultiple(snapshot.m1.entryMultiple.value, language, 0),
                  revenue: source.id === "S5"
                    ? formatMoney(snapshot.m1.reportedRevenue.value, language, { decimals: 0 })
                    : formatBillions(snapshot.m1.revenue.value, language, 0),
                })}</p>
              </div>
              <StatusTag copy={copy} status={source.status} />
              <span aria-hidden="true" className="source-disclosure-mark">+</span>
            </summary>
            <div className="source-registry-detail">
              <dl>
                <div>
                  <dt>{copy("sources.document")}</dt>
                  <dd>{source.id === "S4" ? copy("sources.internalOnly") : source.document}</dd>
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
            </div>
          </details>
        </article>
      ))}
    </div>
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

function SignedWaterfall({ ariaLabel, items }) {
  const bounds = items.flatMap(({ end, start }) => [0, start, end]);
  const maximum = Math.max(...bounds);
  const minimum = Math.min(...bounds);
  const range = Math.max(maximum - minimum, Number.EPSILON);
  const position = (value) => (maximum - value) / range * 1000 / 5 / 2;

  return (
    <div aria-label={ariaLabel} className="opella-waterfall" role="img">
      <ol aria-hidden="true" className="opella-bridge-visual">
        {items.map((item) => (
          <li
            className={`bridge-${item.kind} bridge-${item.value < 0 ? "negative" : "positive"}`}
            key={item.id}
            style={{
              "--waterfall-bar-height": `${Math.max(Math.abs(item.end - item.start) / range * 100, 1.5)}%`,
              "--waterfall-bar-top": `${position(Math.max(item.start, item.end))}%`,
              "--waterfall-connector-top": `${position(item.end)}%`,
            }}
          >
            <div className="waterfall-plot">
              <i className="waterfall-bar" />
              <i className="waterfall-connector" />
            </div>
            <span>{item.label}</span>
            <strong>{item.displayValue}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </li>
        ))}
      </ol>
      <ol aria-hidden="true" className="opella-bridge-mobile">
        {items.map((item) => (
          <li className={`bridge-${item.kind} bridge-${item.value < 0 ? "negative" : "positive"}`} key={item.id}>
            <span>{item.label}</span>
            <strong>{item.displayValue}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CashBridgeGraphic({
  ariaLabel,
  items,
  language,
  period,
  periodLabel,
  total,
}) {
  const maximum = Math.max(
    ...items.map(({ values }) => Math.abs(values[period])),
    Math.abs(total),
    Number.EPSILON,
  );
  const chartRows = [
    ...items,
    {
      id: "cash-total",
      label: periodLabel(period),
      total: true,
      values: { [period]: total },
    },
  ];

  return (
    <div aria-label={ariaLabel} className="cash-bridge-chart" role="img">
      <div aria-hidden="true" className="cash-bridge-heading">
        <span>{periodLabel(period)}</span>
        <strong>{formatMoney(total, language, { signed: true })}</strong>
      </div>
      <ol aria-hidden="true">
        {chartRows.map((item) => {
          const value = item.values[period];
          return (
            <li
              className={`${value < 0 ? "cash-negative" : "cash-positive"}${item.total ? " cash-total" : ""}`}
              key={item.id}
            >
              <span>{item.label}</span>
              <div className="cash-bridge-track">
                <i style={{ "--cash-bar-size": `${Math.abs(value) / maximum * 50}%` }} />
              </div>
              <strong>{formatMoney(value, language, { signed: true })}</strong>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TsaTimeline({
  copy,
  horizon,
  language,
  periodLabel,
  services,
}) {
  return (
    <>
      <div aria-label={copy("tsa.timelineLabel")} className="tsa-timeline" role="img">
        <div aria-hidden="true" className="tsa-timeline-head">
          <span>{copy("tsa.service")}</span>
          {horizon.map((period) => <span key={period}>{period}</span>)}
        </div>
        {services.map((service) => (
          <div aria-hidden="true" className="tsa-timeline-row" key={service.id}>
            <strong>{copy(`service.${service.id}`)}</strong>
            {horizon.map((period) => (
              <span
                className={(service.monthsByPeriod[period] ?? 0) > 0 ? "active" : ""}
                key={period}
              >
                {(service.monthsByPeriod[period] ?? 0) > 0
                  ? copy("tsa.months", { value: service.monthsByPeriod[period] })
                  : "—"}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div aria-label={copy("tsa.timelineLabel")} className="tsa-mobile-list">
        {services.map((service) => (
          <article key={service.id}>
            <header>
              <strong>{copy(`service.${service.id}`)}</strong>
              <span>{formatMoney(service.monthly, language, { signed: true })}</span>
            </header>
            <p>
              {copy("tsa.duration")}: {copy("tsa.months", { value: service.duration })}
              {" · "}
              {copy("tsa.doubleRun")}: {copy("tsa.months", { value: service.doubleRunMonths })}
            </p>
            <div>
              {horizon.filter((period) => (service.monthsByPeriod[period] ?? 0) > 0).map((period) => (
                <span key={period}>
                  {periodLabel(period)} · {copy("tsa.months", { value: service.monthsByPeriod[period] })}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function FundingCurve({
  copy,
  language,
  peak,
  periodLabel,
  periods,
  stateLabel,
  terminal,
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
  const areaPoints = `${left},${top + usableHeight} ${points} ${width - right},${top + usableHeight}`;

  return (
    <div className="funding-overview">
      <div className="funding-visual">
        <div
          aria-label={copy("funding.chartLabel", { state: stateLabel })}
          className="funding-curve"
          role="img"
        >
          <svg aria-hidden="true" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
            <line className="funding-axis" x1={left} x2={width - right} y1={top + usableHeight} y2={top + usableHeight} />
            <polygon className="funding-area-fill" points={areaPoints} />
            <polyline className="funding-area-line" fill="none" points={points} />
            {periods.map((row, index) => (
              <g key={row.period}>
                <circle
                  className={row.period === peak.period ? "funding-point peak" : "funding-point"}
                  cx={xFor(index)}
                  cy={yFor(row.need)}
                  r={row.period === peak.period ? 7 : 5}
                />
              <text className="funding-value-label" textAnchor="middle" x={xFor(index)} y={Math.max(20 - 2, yFor(row.need) - 12 - 2)}>
                  {formatMoney(row.need, language)}
                </text>
                <text className="funding-period-label" textAnchor="middle" x={xFor(index)} y={height - 20}>
                  {row.period}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="funding-mobile-profile" aria-label={copy("funding.chartLabel", { state: stateLabel })}>
          {periods.map((row) => (
            <article className={row.period === peak.period ? "peak" : ""} key={row.period}>
              <span>{periodLabel(row.period)}</span>
              <strong>{formatMoney(row.need, language)}</strong>
              <div aria-hidden="true"><i style={{ "--bar-size": `${row.need / maximum * 100}%` }} /></div>
            </article>
          ))}
        </div>
      </div>
      <div className="funding-outcomes">
        <article>
          <span>{copy("kpi.peak")}</span>
          <strong>{formatMoney(peak.value, language)}</strong>
          <small>{periodLabel(peak.period)}</small>
        </article>
        <article>
          <span>{copy("funding.stateTitle")}</span>
          <strong>{stateLabel}</strong>
          <small>{periodLabel(terminal.period)} · {formatMoney(terminal.need, language)}</small>
        </article>
      </div>
    </div>
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
    comparisons,
    isCentral,
    reset,
    result,
    selections,
    setLever,
  } = useOpellaScenario();
  const copy = useMemo(() => createOpellaCopy(language), [language]);
  const snapshot = opellaFinancials.snapshot;
  const sourcesById = useMemo(
    () => new Map(snapshot.sources.map((source) => [source.id, source])),
    [snapshot.sources],
  );
  const periods = result.calendar.periods.filter(({ inHorizon }) => inHorizon);
  const horizon = result.calendar.horizon;
  const centralResult = comparisons.find(({ id }) => id === "central").output;
  const periodLabel = (id) => periodDisplay(result.calendar.periods, id, language, copy);
  const heroPeriodLabel = (id) => periodCalendarDisplay(result.calendar.periods, id, language, copy);
  const inventoryMetadata = useMemo(
    () => new Map(snapshot.m7.inventory.map((line) => [line.id, line])),
    [snapshot.m7.inventory],
  );
  const inventory = result.modules.m7.inventory;
  const separationComponents = result.modules.m6.separationComponents;

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
  const runRateBreakdown = result.modules.m3.functions
    .map((item) => (
      `${copy(`kpi.runRate.component.${item.id}`)} ${formatMoney(Math.abs(item.runRate), language, { decimals: 0 })}`
    ))
    .join(" · ");

  const standaloneBridge = result.modules.m6.standaloneBridge.map((item) => ({
    ...item,
    detail: item.id === "perimeter" ? periodLabel(result.calendar.maxHorizon) : null,
    displayValue: formatMoney(item.value, language, {
      decimals: item.id === "perimeter" ? 0 : 1,
      signed: item.kind === "delta",
    }),
    label: copy(`standalone.${item.id === "perimeter" ? "perimeterEbitda" : item.id === "allocations" ? "sellerAllocations" : item.id}`),
  }));

  const oneOffItems = result.modules.m5.lines.map((engineLine) => {
    const source = snapshot.m5.lines.find(({ id }) => id === engineLine.id);
    return {
      id: engineLine.id,
      label: copy(`oneOff.${engineLine.id}`),
      status: source?.status,
      value: engineLine.total,
      values: engineLine.amounts,
    };
  });

  const cashRows = result.modules.m6.cashBridge.map((row) => ({
    id: row.id,
    label: copy(row.id),
    values: row.amounts,
  }));

  const fundingRows = result.modules.m7.periods;
  const fundingLast = fundingRows.at(-1);
  const state = result.modules.m7.resorb.state;
  const stateLabel = copy(stateCopyIds[state]);
  const pk = result.modules.m7.resorb.pk;
  const tolerance = opellaFinancials.contracts.relations.find(
    ({ id }) => id === "R-FUNDING-CUM",
  ).tolerance;
  const grossDiffersFromNeed = result.modules.m7.horizon.grossDiffersFromNeed;
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
  const comparisonRows = comparisons.map((comparison) => ({
    ...comparison,
    label: comparison.id === "active"
      ? copy("common.currentSelection")
      : comparison.id === "central"
        ? copy("common.centralCase")
        : `${copy(`lever.${comparison.leverId}`)} · ${copy(leverStateCopyIds[comparison.state])}`,
  }));

  const chainSteps = [
    {
      description: copy("method.compact.proof.public.description"),
      title: copy("method.compact.proof.public.title"),
      value: [
        `≈ ${formatBillions(snapshot.m1.enterpriseValue.value, language, 0)}`,
        `≈ ${formatMultiple(snapshot.m1.entryMultiple.value, language, 0)}`,
        `≈ ${formatBillions(snapshot.m1.revenue.value, language, 0)}`,
        formatDate(snapshot.calendar.closing, language),
      ].join(" · "),
    },
    {
      description: copy("method.compact.proof.derived.description"),
      title: copy("method.compact.proof.derived.title"),
      value: [
        `≈ ${formatBillions(snapshot.m1.ebitda.value, language, 2)}`,
        `≈ ${formatPercent(snapshot.m1.margin.value, language, 1)}`,
      ].join(" · "),
    },
    {
      description: copy("method.compact.proof.separation.description"),
      title: copy("method.compact.proof.separation.title"),
      value: [
        formatMoney(Math.abs(snapshot.m3.runRateTotal), language, { decimals: 0 }),
        formatMoney(separationComponents.tsa, language, { decimals: 0 }),
        formatMoney(separationComponents.oneOffs, language, { decimals: 0 }),
        formatMoney(peak.value, language, { decimals: 0 }),
      ].join(" · "),
    },
    {
      description: copy("method.compact.proof.outputs.description"),
      title: copy("method.compact.proof.outputs.title"),
      value: [
        formatMoney(runRate, language, { decimals: 0 }),
        formatMoney(separationCost, language, { decimals: 0 }),
        formatMoney(peak.value, language, { decimals: 0 }),
        heroPeriodLabel(steady),
      ].join(" · "),
    },
  ];

  const centralOneOffPeriods = centralResult.calendar.periods
    .filter(({ id }) => Math.abs(centralResult.modules.m5.byPeriod[id] ?? 0) > Number.EPSILON);
  const fiscalYearLabel = (period) => `FY${period.end.slice(0, ISO_YEAR_TOKEN.length)}`;
  const keyAssumptions = [
    {
      construction: copy("method.compact.construction.standalone", {
        count: formatNumber(centralResult.modules.m3.functions.length, language, 0),
      }),
      effect: copy("method.compact.effect.standalone"),
      id: "standalone-functions",
      label: copy("method.compact.assumption.standalone"),
      value: formatMoney(Math.abs(centralResult.modules.m3.runRateTotal), language, { decimals: 0 }),
    },
    {
      construction: copy("method.compact.construction.tsa", {
        count: formatNumber(centralResult.modules.m4.services.length, language, 0),
      }),
      effect: copy("method.compact.effect.tsa"),
      id: "tsa",
      label: copy("method.compact.assumption.tsa"),
      value: formatMoney(centralResult.modules.m6.separationComponents.tsa, language),
    },
    {
      construction: copy("method.compact.construction.oneOffs", {
        count: formatNumber(centralResult.modules.m5.lines.length, language, 0),
        end: fiscalYearLabel(centralOneOffPeriods.at(-1)),
        start: fiscalYearLabel(centralOneOffPeriods[0]),
      }),
      effect: copy("method.compact.effect.oneOffs"),
      id: "one-offs",
      label: copy("method.compact.assumption.oneOffs"),
      value: formatMoney(centralResult.modules.m6.separationComponents.oneOffs, language, { decimals: 0 }),
    },
    {
      construction: copy("method.compact.construction.capex"),
      effect: copy("method.compact.effect.capex"),
      id: "separation-capex",
      label: copy("method.compact.assumption.capex"),
      value: formatMoney(centralResult.modules.m6.separationComponents.capex, language, { decimals: 0 }),
    },
    {
      construction: copy("method.compact.construction.tax"),
      effect: copy("method.compact.effect.tax"),
      id: "cash-tax",
      label: copy("method.compact.assumption.tax"),
      value: formatPercent(snapshot.m6.taxRate.value, language, 0),
    },
    {
      construction: copy("method.compact.construction.workingCapital"),
      effect: copy("method.compact.effect.workingCapital"),
      id: "working-capital-intensity",
      label: copy("method.compact.assumption.workingCapital"),
      value: formatPercent(snapshot.m6.wcIntensity.value, language, 0),
    },
  ];

  const runRateEquation = copy("method.compact.equation.runRate", {
    components: result.modules.m3.functions
      .map(({ runRate: value }) => formatNumber(Math.abs(value), language, 0))
      .join(" + "),
    total: formatMoney(runRate, language, { decimals: 0 }),
  });
  const separationCostEquation = copy("method.compact.equation.separationCost", {
    capex: formatNumber(separationComponents.capex, language, 0),
    exact: formatMoney(separationCost, language),
    oneOffs: formatNumber(separationComponents.oneOffs, language, 0),
    rounded: formatMoney(separationCost, language, { decimals: 0 }),
    tsa: formatNumber(separationComponents.tsa, language),
  });
  const peakEquation = copy("method.compact.equation.peak", {
    amount: formatMoney(peak.value, language),
    period: heroPeriodLabel(peak.period),
  });
  const steadyFunctionLoad = Math.min(...result.modules.m3.functions.map(({ applied, runRate: value }) => (
    Math.abs(value) <= Number.EPSILON ? 1 : Math.abs((applied[steady] ?? 0) / value)
  )));
  const steadyConditions = [
    {
      label: copy("method.compact.steady.tsa"),
      value: formatMoney(Math.abs(result.modules.m4.byPeriod[steady] ?? 0), language, { decimals: 0 }),
    },
    {
      label: copy("method.compact.steady.oneOffs"),
      value: formatMoney(Math.abs(result.modules.m5.byPeriod[steady] ?? 0), language, { decimals: 0 }),
    },
    {
      label: copy("method.compact.steady.functions"),
      value: copy("method.compact.steady.runRate", {
        value: formatPercent(steadyFunctionLoad, language, 0),
      }),
    },
  ];
  const mechanics = [
    {
      equation: runRateEquation,
      explanation: copy("method.compact.explanation.runRate"),
      id: "run-rate",
      result: formatMoney(runRate, language, { decimals: 0 }),
      title: copy("kpi.runRate"),
    },
    {
      equation: separationCostEquation,
      explanation: copy("method.compact.explanation.separationCost"),
      id: "separation-cost",
      result: formatMoney(separationCost, language, { decimals: 0 }),
      title: copy("kpi.separationCost"),
    },
    {
      equation: peakEquation,
      explanation: copy("method.compact.explanation.peak"),
      id: "funding-peak",
      result: formatMoney(peak.value, language, { decimals: 0 }),
      title: copy("kpi.peak"),
    },
    {
      conditions: steadyConditions,
      explanation: copy("method.compact.explanation.steady"),
      id: "steady-state",
      result: heroPeriodLabel(steady),
      title: copy("kpi.steady"),
    },
  ];

  return (
    <article className="opella-analysis-view">
      <section className="opella-hero" id="executive">
        <div className="opella-hero-copy">
          <p className="eyebrow">{copy("executive.eyebrow")}</p>
          <h1>{copy("executive.title")}</h1>
          <p className="opella-hero-question">{copy("executive.question")}</p>
          <p className="opella-hero-summary">{copy("executive.summary")}</p>
          <p className="opella-hero-methodology">{copy("executive.methodology")}</p>
        </div>
        <div aria-label={copy("nav.executive")} className="opella-kpi-grid">
          <MetricTile
            detail={runRateBreakdown}
            detailClassName="opella-kpi-explanation"
            label={copy("kpi.runRate")}
            outputId="O-RUNRATE"
            tone="neutral"
            value={formatMoney(runRate, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.separationCost.detail", {
              capex: formatMoney(separationComponents.capex, language, { decimals: 0 }),
              oneOffs: formatMoney(separationComponents.oneOffs, language, { decimals: 0 }),
              tsa: formatMoney(separationComponents.tsa, language, { decimals: 0 }),
            })}
            detailClassName="opella-kpi-explanation"
            label={copy("kpi.separationCost")}
            outputId="O-SEPCOST"
            tone="neutral"
            value={formatMoney(separationCost, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.peak.detail", { period: heroPeriodLabel(peak.period) })}
            detailClassName="opella-kpi-explanation"
            label={copy("kpi.peak")}
            outputId="O-PEAK"
            tone="neutral"
            value={formatMoney(peak.value, language, { decimals: 0 })}
          />
          <MetricTile
            detail={copy("kpi.steady.detail")}
            detailClassName="opella-kpi-explanation"
            label={copy("kpi.steady")}
            outputId="O-STEADY"
            tone="neutral"
            value={heroPeriodLabel(steady)}
          />
        </div>
        <MethodTabs
          assumptions={keyAssumptions}
          chainSteps={chainSteps}
          copy={copy}
          mechanics={mechanics}
        />
      </section>

      <Section
        className="opella-situation-part opella-situation-transaction"
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
        className="opella-situation-part opella-situation-perimeter"
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
        className="opella-analytical-block opella-standalone-block"
        id="standalone-build"
        kicker={copy("standalone.kicker")}
        title={copy("standalone.title")}
      >
        <p className="opella-section-intro">{copy("standalone.intro")}</p>
        <SignedWaterfall ariaLabel={copy("standalone.bridgeLabel")} items={standaloneBridge} />
        <DataTable
          columns={[copy("cash.line"), copy("common.value"), copy("common.status")]}
          getRowKey={(row) => row[0]}
          highlightColumn={1}
          label={copy("standalone.bridgeLabel")}
          rowHeaderColumn={0}
          rows={standaloneBridge.map((item) => [
            item.label,
            item.displayValue,
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

      <Section
        className="opella-analytical-block opella-tsa-block"
        id="tsa"
        kicker={copy("tsa.kicker")}
        title={copy("tsa.title")}
      >
        <p className="opella-section-intro">{copy("tsa.intro")}</p>
        <TsaTimeline
          copy={copy}
          horizon={horizon}
          language={language}
          periodLabel={periodLabel}
          services={result.modules.m4.services}
        />
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

      <Section
        className="opella-analytical-block opella-one-offs-block"
        id="one-offs"
        kicker={copy("oneOffs.kicker")}
        title={copy("oneOffs.title")}
      >
        <p className="opella-section-intro">{copy("oneOffs.intro")}</p>
        <div className="opella-complementary-layout">
          <BarGraphic
            copy={copy}
            items={oneOffItems}
            label={copy("oneOffs.chartLabel")}
            valueFormatter={(value) => formatMoney(value, language, { signed: true })}
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
              formatMoney(item.value, language, { signed: true }),
              statusLabel(item.status, copy),
            ])}
          />
        </div>
      </Section>

      <Section
        className="opella-analytical-block opella-cash-block"
        id="cash-transition"
        kicker={copy("cash.kicker")}
        title={copy("cash.title")}
      >
        <p className="opella-section-intro">{copy("cash.intro")}</p>
        <CashBridgeGraphic
          ariaLabel={`${copy("cash.chartLabel")} · ${periodLabel(horizon[0])}`}
          items={cashRows}
          language={language}
          period={horizon[0]}
          periodLabel={periodLabel}
          total={result.modules.m6.cash[horizon[0]]}
        />
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

      <Section
        className="opella-analytical-block opella-funding-block"
        id="funding-need"
        kicker={copy("funding.kicker")}
        title={copy("funding.title")}
      >
        <p className="opella-section-intro">{copy("funding.intro")}</p>
        <FundingCurve
          copy={copy}
          language={language}
          peak={peak}
          periodLabel={periodLabel}
          periods={fundingRows}
          stateLabel={stateLabel}
          terminal={fundingLast}
        />
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

      <Section
        className="opella-analytical-block opella-scenarios-block"
        id="scenarios"
        kicker={copy("scenarios.kicker")}
        title={copy("scenarios.title")}
      >
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
        <div className="opella-scenario-comparison">
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
        </div>
      </Section>

      <Section
        className="opella-diligence-buyer"
        id="buyer-implications"
        kicker={copy("buyer.kicker")}
        title={copy("buyer.title")}
      >
        <aside aria-label={`${copy("buyer.title")} · ${copy("common.illustrative")}`} className="buyer-implications">
          <p>{copy("buyer.qualitative")}</p>
          <a href="#diligence">{copy("buyer.link")} ↓</a>
        </aside>
      </Section>

      <Section
        className="opella-diligence-main"
        id="diligence"
        kicker={copy("diligence.kicker")}
        title={copy("diligence.title")}
      >
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
        <SourceRegistry
          copy={copy}
          language={language}
          snapshot={snapshot}
          sourcesById={sourcesById}
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
