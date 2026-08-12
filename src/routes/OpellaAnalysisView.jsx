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
  opellaPublicWorkbook,
  opellaTransactionScopeEditorial,
} from "../data/opellaCase.js";
import { opellaFinancials } from "../data/opellaFinancials.js";

const ISO_YEAR_TOKEN = "YYYY";

const stateCopyIds = {
  "résorbé": "funding.state.resorbed",
  plateau: "funding.state.plateau",
  "non résorbé à l'horizon": "funding.state.nonResorbed",
  "croissant à l'horizon": "funding.state.growing",
};

const stateSummaryIds = {
  "résorbé": "funding.summary.resorbed",
  plateau: "funding.summary.plateau",
  "non résorbé à l'horizon": "funding.summary.nonResorbed",
  "croissant à l'horizon": "funding.summary.growing",
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

function formatAccountingAmount(value, language, { decimals = 2, positiveSign = false } = {}) {
  const amount = formatNumber(Math.abs(value), language, decimals);
  if (value < 0) return `(${amount})`;
  return positiveSign && value > 0 ? `+${amount}` : amount;
}

function formatAccountingMoney(value, language, { decimals = 1, positiveSign = false } = {}) {
  const amount = formatNumber(Math.abs(value), language, decimals);
  if (value < 0) return language === "en" ? `(€${amount}m)` : `(${amount} M€)`;
  if (positiveSign && value > 0) return language === "en" ? `+€${amount}m` : `+${amount} M€`;
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

function formatLongDate(value, language) {
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTextList(values, language) {
  return new Intl.ListFormat(localeFor(language), {
    style: "long",
    type: "conjunction",
  }).format(values);
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
      data-source-location={reference.location}
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
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function ScenarioRange({ formatValue, maximum, minimum, value }) {
  const position = maximum === minimum
    ? 50
    : ((value - minimum) / (maximum - minimum)) * 100;
  return (
    <div className="opella-scenario-range">
      <span>{formatValue(minimum)}</span>
      <span aria-hidden="true" className="opella-scenario-range-track">
        <i style={{ "--scenario-position": `${Math.max(0, Math.min(100, position))}%` }} />
      </span>
      <span>{formatValue(maximum)}</span>
    </div>
  );
}

function StatusTag({ copy, status }) {
  return (
    <span className={`opella-status status-${status.replace(/\s+/g, "-")}`}>
      {statusLabel(status, copy)}
    </span>
  );
}

function AtlasScopeIcon({ type }) {
  const isIncluded = type === "included";
  return (
    <svg
      aria-hidden="true"
      className={`opella-atlas-icon ${isIncluded ? "is-included" : "is-excluded"}`}
      focusable="false"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="6.25" />
      {isIncluded ? (
        <path d="m5.15 8.1 1.75 1.75 3.95-4" />
      ) : (
        <path d="m5.65 5.65 4.7 4.7m0-4.7-4.7 4.7" />
      )}
    </svg>
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
        <article key={source.id}>
          <details>
            <summary>
              <div>
                <h3>{copy(`source.${source.id}.label`)}</h3>
                <p>{copy(`source.${source.id}.coverage`, {
                  ev: formatBillions(snapshot.m1.enterpriseValue.value, language, 0),
                  multiple: formatMultiple(snapshot.m1.entryMultiple.value, language, 0),
                  reportedRevenue: formatMoney(snapshot.m1.reportedRevenue.value, language, { decimals: 0 }),
                })}</p>
              </div>
              <span className="source-category">{copy(`sources.role.${source.evidence_role}`)}</span>
              <span aria-hidden="true" className="source-disclosure-mark">+</span>
            </summary>
            <div className="source-registry-detail">
              <dl>
                {source.id === "S4" ? (
                  <>
                    <div>
                      <dt>{copy("sources.internal.natureLabel")}</dt>
                      <dd>{copy("sources.internal.nature")}</dd>
                    </div>
                    <div>
                      <dt>{copy("sources.internal.scopeLabel")}</dt>
                      <dd>{copy("sources.internal.scope")}</dd>
                    </div>
                    <div>
                      <dt>{copy("sources.internal.horizonLabel")}</dt>
                      <dd>{copy("sources.internal.horizon")}</dd>
                    </div>
                    <div>
                      <dt>{copy("sources.internal.externalLabel")}</dt>
                      <dd>{copy("sources.internal.external")}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt>{copy("sources.document")}</dt>
                      <dd>{source.document}</dd>
                    </div>
                    <div>
                      <dt>{copy("sources.scope")}</dt>
                      <dd>{copy(`source.${source.id}.scope`, {
                        date: formatDate(snapshot.calendar.closing, language),
                      })}</dd>
                    </div>
                    <div>
                      <dt>{copy("sources.location")}</dt>
                      <dd data-source-location={source.location}>{source.location}</dd>
                    </div>
                    <div>
                      <dt>{copy("sources.publicationDate")}</dt>
                      <dd>{source.publication_date === "not-stated"
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
                  </>
                )}
              </dl>
              {source.id !== "S4" && source.references.some(({ url }) => Boolean(url)) ? (
                <SourceReferenceBlock
                  copy={copy}
                  sourceIds={source.id}
                  sourcesById={sourcesById}
                />
              ) : null}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}

function SignedWaterfall({ ariaLabel, items }) {
  const bridgeMaximum = Math.max(...items.flatMap(({ end, start }) => [start, end]));
  const scaleMaximum = Math.max(1550, bridgeMaximum);
  const scaleMinimum = 0;
  const scaleRange = scaleMaximum;
  const position = (value) => (scaleMaximum - value) / scaleRange * 100;

  return (
    <div aria-label={ariaLabel} className="opella-waterfall" role="img">
      <ol
        aria-hidden="true"
        className="opella-bridge-visual"
        style={{ "--waterfall-count": items.length }}
      >
        {items.map((item) => (
          <li
            className={`bridge-${item.kind} bridge-${item.value < 0 ? "negative" : "positive"}`}
            data-waterfall-end={item.end}
            data-waterfall-id={item.id}
            data-waterfall-start={item.start}
            data-waterfall-value={item.value}
            key={item.id}
            style={{
              "--waterfall-bar-height": `${Math.abs(
                item.end - (item.kind === "delta" ? item.start : scaleMinimum),
              ) / scaleRange * 100}%`,
              "--waterfall-bar-top": `${position(Math.max(item.start, item.end))}%`,
              "--waterfall-connector-top": `${position(item.end)}%`,
            }}
          >
            <div className="waterfall-plot">
              <strong className="waterfall-value">{item.displayValue}</strong>
              <i className="waterfall-bar" />
              <i className="waterfall-connector" />
            </div>
            <span>{item.axisLabel ?? item.label}</span>
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
  copy,
  items,
  language,
  period,
  periodLabel,
  reconciliations,
  total,
}) {
  return (
    <section aria-label={ariaLabel} className="cash-bridge-chart">
      <div className="cash-bridge-title">
        <h3>{copy("cash.bridgeTitle")}</h3>
        <span>{copy("cash.bridgeUnit", { period: periodLabel(period) })}</span>
      </div>
      <div className="cash-bridge-heading">
        <span>
          {copy("cash.headline")}
          <small>{copy("cash.headline.detail")}</small>
        </span>
        <strong>{formatMoney(total, language)}</strong>
      </div>
      <dl className="cash-bridge-lines">
        {items.map((item) => (
          <div key={item.id}>
            <dt>{item.label}</dt>
            <dd>{formatAccountingAmount(item.value, language, {
              positiveSign: item.id === "cash.allocations",
            })}</dd>
          </div>
        ))}
        <div className="cash-total">
          <dt>{copy("cash.generated", { period: periodLabel(period) })}</dt>
          <dd>{formatAccountingAmount(total, language)}</dd>
        </div>
      </dl>
      <div className="cash-bridge-reconciliations">
        {reconciliations.map((item) => (
          <p key={item.id}>
            <strong>{item.label}</strong>
            <span>{item.formula}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function TsaExitBars({ copy, language, services }) {
  const maximumDuration = Math.max(...services.map(({ duration }) => duration), Number.EPSILON);

  return (
    <section aria-label={copy("tsa.timelineLabel")} className="opella-tsa-exit-card">
      <div className="opella-tsa-card-heading">
        <h3>{copy("tsa.exitByService")}</h3>
        <div aria-hidden="true" className="opella-tsa-legend">
          <span className="is-duration">{copy("tsa.durationExcludingDoubleRun")}</span>
          <span className="is-double-run">{copy("tsa.doubleRun")}</span>
        </div>
      </div>
      <ul className="opella-tsa-exit-list">
        {services.map((service) => (
          <li key={service.id}>
            <div className="opella-tsa-exit-copy">
              <strong>{copy(`service.${service.id}`)}</strong>
              <small>{copy(`service.${service.id}.strategy`)}</small>
            </div>
            <div aria-hidden="true" className="opella-tsa-exit-track">
              <span style={{ width: `${service.duration / maximumDuration * 100}%` }}>
                <i style={{ width: `${service.doubleRunMonths / service.duration * 100}%` }} />
              </span>
            </div>
            <div className="opella-tsa-exit-values">
              <strong>{copy("tsa.months", { value: service.duration })}</strong>
              <span>{copy(
                `tsa.doubleRunShort.${service.doubleRunMonths === 1 ? "one" : "other"}`,
                { value: service.doubleRunMonths },
              )}</span>
              <small>
                {formatMoney(Math.abs(service.monthly), language)} {copy("tsa.perMonth")}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OneOffNatureTable({ copy, items, language, total }) {
  return (
    <section className="opella-oneoff-nature-card">
      <h3>{copy("tsa.oneOffNature")}</h3>
      <dl>
        {items.map((item) => (
          <div key={item.id}>
            <dt>{item.label}</dt>
            <dd>{formatMoney(Math.abs(item.value), language)}</dd>
          </div>
        ))}
        <div className="is-total">
          <dt>{copy("tsa.oneOffTotal")}</dt>
          <dd>{formatMoney(Math.abs(total), language)}</dd>
        </div>
      </dl>
    </section>
  );
}

function OneOffPhasingChart({ copy, language, periods, transitionEconomics }) {
  const barScaleMaximum = 100;
  const cumulativeScaleMaximum = 180;
  const barScaleTicks = [100, 80, 60, 40, 20, 0];
  const cumulativeScaleTicks = [180, 120, 60, 0];
  let cumulative = 0;
  const points = periods.map((period, index) => {
    cumulative += period.value;
    return {
      ...period,
      cumulative,
      curveX: (index + .5) / periods.length * 100,
      curveY: 100 - cumulative / cumulativeScaleMaximum * 100,
    };
  });
  return (
    <div className="opella-oneoff-phasing-layout" id="one-offs">
      <figure aria-label={copy("tsa.oneOffPhasing")} className="opella-oneoff-phasing">
        <div className="opella-tsa-card-heading">
          <h3>{copy("tsa.oneOffPhasing")}</h3>
          <div aria-hidden="true" className="opella-oneoff-legend">
            <span className="is-period">{copy("tsa.periodSpend")}</span>
            <span className="is-cumulative">{copy("tsa.cumulative")}</span>
          </div>
        </div>
        <div className="opella-oneoff-axis-titles">
          <span>{copy("tsa.periodAxis")}</span>
          <span>{copy("tsa.cumulativeAxis")}</span>
        </div>
        <div className="opella-oneoff-chart-frame">
          <div aria-hidden="true" className="opella-oneoff-axis is-bar-axis">
            {barScaleTicks.map((tick) => (
              <span key={tick}>{formatNumber(tick, language, 0)}</span>
            ))}
          </div>
          <div className="opella-oneoff-phasing-plot">
            <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
              {barScaleTicks.map((tick) => (
                <line
                  className="opella-oneoff-gridline"
                  key={tick}
                  x1="0"
                  x2="100"
                  y1={100 - tick / barScaleMaximum * 100}
                  y2={100 - tick / barScaleMaximum * 100}
                />
              ))}
              <polyline points={points.map(({ curveX, curveY }) => `${curveX},${curveY}`).join(" ")} />
            </svg>
            <ol style={{ "--oneoff-period-count": periods.length }}>
              {points.map((point, index) => (
                <li
                  key={point.id}
                  style={{
                    "--oneoff-bar-height": `${point.value / barScaleMaximum * 100}%`,
                    "--oneoff-curve-y": `${point.curveY}%`,
                  }}
                >
                  <span aria-hidden="true" className="opella-oneoff-curve-point" />
                  {index > 0 ? (
                    <span className="opella-oneoff-cumulative-value">
                      {formatMoney(point.cumulative, language, { decimals: 0 })}
                    </span>
                  ) : null}
                  <span className={`opella-oneoff-period-value${point.value >= barScaleMaximum / 5 ? " is-inside" : ""}`}>
                    {formatMoney(point.value, language, { decimals: 0 })}
                  </span>
                  <i aria-hidden="true" />
                  <strong>{point.label}</strong>
                </li>
              ))}
            </ol>
          </div>
          <div aria-hidden="true" className="opella-oneoff-axis is-cumulative-axis">
            {cumulativeScaleTicks.map((tick) => (
              <span key={tick}>{formatNumber(tick, language, 0)}</span>
            ))}
          </div>
        </div>
      </figure>
      <aside className="opella-oneoff-reading">
        <h3>{copy("tsa.transitionEconomics")}</h3>
        <ul>
          <li>
            <strong>{formatMoney(transitionEconomics.total, language)}</strong>
            <span>{copy("tsa.transitionEconomics.total")}</span>
          </li>
          <li>
            <strong>{formatPercent(transitionEconomics.concentration, language, 0)}</strong>
            <span>{copy("tsa.transitionEconomics.concentration", {
              committed: formatMoney(transitionEconomics.committed, language),
              total: formatMoney(transitionEconomics.total, language),
            })}</span>
          </li>
          <li>
            <strong>{copy("tsa.transitionEconomics.monthlyValue", {
              value: formatMoney(transitionEconomics.tailMonthlyCost, language),
            })}</strong>
            <span>{copy("tsa.transitionEconomics.tail", {
              services: formatTextList(transitionEconomics.tailServices, language),
            })}</span>
          </li>
        </ul>
      </aside>
    </div>
  );
}

function FundingCurve({
  annotation,
  copy,
  language,
  peak,
  periodLabel,
  periods,
  stateLabel,
}) {
  const width = 700;
  const height = 260;
  const left = 82;
  const right = 60;
  const top = 24;
  const bottom = 48;
  const maximum = Math.max(...periods.map(({ need }) => need), Number.EPSILON);
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;
  const xFor = (index) => left + (periods.length === 1 ? 0 : index / (periods.length - 1) * usableWidth);
  const yFor = (value) => top + usableHeight - value / maximum * usableHeight;
  const points = periods.map((row, index) => `${xFor(index)},${yFor(row.need)}`).join(" ");
  const areaPoints = `${left},${top + usableHeight} ${points} ${width - right},${top + usableHeight}`;

  return (
    <div className="funding-visual">
      <div className="funding-chart-heading">
        <h3>{copy("funding.profileTitle")}</h3>
        <span>{copy("funding.profileUnit")}</span>
      </div>
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
                  r={row.period === peak.period ? 6 : 4}
                />
                <text className="funding-value-label" textAnchor="middle" x={xFor(index)} y={Math.max(20 - 2, yFor(row.need) - 12 - 2)}>
                  {formatMoney(row.need, language)}
                </text>
                <text className="funding-period-label" textAnchor="middle" x={xFor(index)} y={height - 20}>
                  {periodLabel(row.period)}
                </text>
                {row.period === peak.period ? (
                  <text className="funding-peak-label" textAnchor="middle" x={xFor(index)} y={Math.max(34, yFor(row.need) + 24)}>
                    {copy("funding.peakShort")}
                  </text>
                ) : null}
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
        <div className="funding-chart-annotation">
          <div>
            <span>{copy("funding.stateTitle")}</span>
            <strong>{stateLabel}</strong>
          </div>
          <p>{annotation.summary}</p>
          <p className="funding-chart-peak">
            <span>{copy("kpi.peak")}</span>
            <strong>{formatMoney(annotation.peak.value, language)} · {periodLabel(annotation.peak.period)}</strong>
          </p>
        </div>
    </div>
  );
}

function FundingAssumptions({ assumptions, copy }) {
  return (
    <aside className="funding-assumptions">
      <h3>{copy("funding.assumptionsTitle")}</h3>
      <dl>
        {assumptions.map((item) => (
          <div key={item.id}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function leverStateLabel(id, state, copy) {
  return id === "S-TSA"
    ? copy(`scenarios.tsaState.${state}`)
    : copy(leverStateCopyIds[state]);
}

function leverValue(id, value, language, copy) {
  if (id === "S-OPS") {
    return `${formatPercent(value[0], language, 1)} / ${formatNumber(value[1] * 100, language, 1)} pt`;
  }
  if (id === "S-TSA") {
    return copy("scenarios.monthValue", {
      value: formatNumber(value, language, 0, true).replace("-", "−"),
    });
  }
  return `${formatNumber(value, language, 2)}x`;
}

export default function OpellaAnalysisView() {
  const { language } = useLanguage();
  const {
    centralResult,
    isCentral,
    reset,
    result,
    scenarioUniverse,
    selections,
    setLever,
    setScenario,
  } = useOpellaScenario();
  const copy = useMemo(() => createOpellaCopy(language), [language]);
  const snapshot = opellaFinancials.snapshot;
  const publicProfile = opellaTransactionScopeEditorial;
  const sourcesById = useMemo(
    () => new Map(snapshot.sources.map((source) => [source.id, source])),
    [snapshot.sources],
  );
  const periods = result.calendar.periods.filter(({ inHorizon }) => inHorizon);
  const horizon = result.calendar.horizon;
  const periodLabel = (id) => periodCalendarDisplay(result.calendar.periods, id, language, copy);
  const heroPeriodLabel = periodLabel;
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

  const engineStandaloneBridge = result.modules.m6.standaloneBridge;
  const perimeterBridgeStep = engineStandaloneBridge.find(({ id }) => id === "perimeter");
  const allocationBridgeStep = engineStandaloneBridge.find(({ id }) => id === "allocations");
  const costBridgeStep = engineStandaloneBridge.find(({ id }) => id === "costs");
  const outputBridgeStep = engineStandaloneBridge.find(({ id }) => id === "output");
  const baseRevenue = snapshot.m1.revenue.value;
  const baseMargin = snapshot.m1.margin.value;
  const transactionEbitda = snapshot.m1.ebitda.value;
  const horizonRevenue = result.modules.m1.revenue[result.calendar.maxHorizon];
  const horizonMargin = result.modules.m1.margin[result.calendar.maxHorizon];
  const revenueGrowthContribution = (horizonRevenue - baseRevenue) * baseMargin;
  const marginExpansionContribution = horizonRevenue * (horizonMargin - baseMargin);
  const formatBridgeNumber = (value, signed = false, decimals = 1) => {
    const formatted = formatNumber(Math.abs(value), language, decimals);
    if (value < 0) return `(${formatted})`;
    return signed && value > 0 ? `+${formatted}` : formatted;
  };
  const transactionStep = {
    axisLabel: copy("standalone.axis.transactionEbitda"),
    detail: null,
    displayValue: formatBridgeNumber(transactionEbitda, false, 0),
    end: transactionEbitda,
    id: "transaction-ebitda",
    kind: "total",
    label: copy("standalone.transactionEbitda"),
    start: 0,
    value: transactionEbitda,
  };
  const revenueGrowthStep = {
    axisLabel: copy("standalone.axis.revenueGrowth"),
    detail: null,
    displayValue: formatBridgeNumber(revenueGrowthContribution, true),
    end: transactionEbitda + revenueGrowthContribution,
    id: "revenue-growth",
    kind: "delta",
    label: copy("standalone.revenueGrowth"),
    start: transactionEbitda,
    value: revenueGrowthContribution,
  };
  const marginExpansionStep = {
    axisLabel: copy("standalone.axis.marginExpansion"),
    detail: null,
    displayValue: formatBridgeNumber(marginExpansionContribution, true),
    end: perimeterBridgeStep.value,
    id: "margin-expansion",
    kind: "delta",
    label: copy("standalone.marginExpansion"),
    start: revenueGrowthStep.end,
    value: marginExpansionContribution,
  };
  const perimeterSubtotalStep = {
    ...perimeterBridgeStep,
    axisLabel: copy("standalone.axis.perimeterSubtotal"),
    detail: null,
    displayValue: formatBridgeNumber(perimeterBridgeStep.value),
    id: "perimeter-subtotal",
    kind: "subtotal",
    label: copy("standalone.perimeterSubtotal"),
  };
  const allocationStep = {
    ...allocationBridgeStep,
    axisLabel: copy("standalone.axis.sellerAllocations"),
    detail: null,
    displayValue: formatBridgeNumber(allocationBridgeStep.value, true),
    label: copy("standalone.sellerAllocations"),
  };
  let standaloneCostCursor = costBridgeStep.start;
  const standaloneFunctionSteps = functionItems.map((item) => {
    const start = standaloneCostCursor;
    standaloneCostCursor -= Math.abs(item.value);
    return {
      ...item,
      detail: null,
      displayValue: formatBridgeNumber(-Math.abs(item.value)),
      end: standaloneCostCursor,
      id: `standalone-${item.id}`,
      kind: "delta",
      label: copy(`kpi.runRate.component.${item.id}`),
      start,
      value: -Math.abs(item.value),
    };
  });
  const outputStep = {
    ...outputBridgeStep,
    axisLabel: copy("standalone.axis.output"),
    detail: null,
    displayValue: formatBridgeNumber(outputBridgeStep.value),
    label: copy("standalone.output"),
  };
  const standaloneWaterfallItems = [
    transactionStep,
    revenueGrowthStep,
    marginExpansionStep,
    perimeterSubtotalStep,
    allocationStep,
    ...standaloneFunctionSteps,
    outputStep,
  ];
  const standaloneSummaryItems = [
    {
      ...transactionStep,
      commentary: copy("standalone.summary.transaction"),
    },
    {
      ...revenueGrowthStep,
      commentary: copy("standalone.summary.revenueGrowth"),
    },
    {
      ...marginExpansionStep,
      commentary: copy("standalone.summary.marginExpansion"),
    },
    {
      ...perimeterSubtotalStep,
      commentary: copy("standalone.summary.perimeterSubtotal"),
    },
    {
      ...allocationStep,
      commentary: copy("standalone.summary.allocations"),
    },
    ...functionItems.map((item) => ({
      commentary: item.driver,
      displayValue: `(${formatNumber(Math.abs(item.value), language, 1)})`,
      id: item.id,
      label: item.label,
    })),
    {
      ...outputStep,
      commentary: copy("standalone.summary.output"),
    },
  ].map((item) => ({
    ...item,
    displayValue: item.id.startsWith("F-")
      ? item.displayValue
      : formatBridgeNumber(item.value, item.kind === "delta"),
  }));
  const standaloneTakeaways = [
    {
      body: copy("standalone.takeaway.perimeter", {
        growth: formatBridgeNumber(revenueGrowthContribution, true),
        margin: formatBridgeNumber(marginExpansionContribution, true),
      }),
      headline: formatMoney(perimeterBridgeStep.value, language),
      id: "perimeter",
    },
    {
      body: copy("standalone.takeaway.allocations", {
        costs: formatMoney(Math.abs(costBridgeStep.value), language),
      }),
      headline: formatMoney(allocationBridgeStep.value, language, { signed: true }),
      id: "allocations",
    },
    {
      body: copy("standalone.takeaway.output", {
        period: periodLabel(result.calendar.maxHorizon),
      }),
      headline: formatMoney(outputBridgeStep.value, language),
      id: "output",
    },
  ];
  const standaloneChartTitle = copy("standalone.chartTitle");

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
  const oneOffPhasingPeriods = horizon
    .map((period) => ({
      id: period,
      label: heroPeriodLabel(period),
      value: Math.abs(result.modules.m5.byPeriod[period] ?? 0),
    }))
    .filter(({ value }) => value > Number.EPSILON);
  const throughFy2026 = horizon.slice(0, horizon.indexOf("P2") + 1);
  const transitionTotal = Math.abs(separationComponents.tsa) + Math.abs(separationComponents.oneOffs);
  const transitionCommitted = throughFy2026.reduce(
    (sum, period) => sum
      + Math.abs(result.modules.m4.byPeriod[period] ?? 0)
      + Math.abs(result.modules.m5.byPeriod[period] ?? 0),
    0,
  );
  const tailServices = result.modules.m4.services.filter(({ duration }) => duration > 18);
  const transitionEconomics = {
    committed: transitionCommitted,
    concentration: transitionCommitted / transitionTotal,
    tailMonthlyCost: tailServices.reduce((sum, { monthly }) => sum + Math.abs(monthly), 0),
    tailServices: tailServices.map(({ id }) => copy(`service.${id}.tail`)),
    total: transitionTotal,
  };

  const cashRows = result.modules.m6.cashBridge.map((row) => ({
    id: row.id,
    label: copy(row.id),
    values: row.amounts,
  }));
  const firstPeriod = horizon[0];
  const cashValue = (id, period = firstPeriod) => (
    cashRows.find((row) => row.id === id)?.values[period] ?? 0
  );
  const separationCash = cashValue("cash.tsa")
    + cashValue("cash.oneOffs")
    + cashValue("cash.separation");
  const taxAndReinvestment = cashValue("cash.tax")
    + cashValue("cash.currentCapex")
    + cashValue("cash.currentWc");
  const cashOverviewRows = [
    "cash.ebitda",
    "cash.allocations",
    "cash.standalone",
  ].map((id) => ({ id, label: copy(id), value: cashValue(id) }));
  cashOverviewRows.push(
    { id: "cash.separationUses", label: copy("cash.separationUses"), value: separationCash },
    { id: "cash.taxReinvestment", label: copy("cash.taxReinvestment"), value: taxAndReinvestment },
  );
  const cashReconciliations = [
    {
      formula: ["cash.tsa", "cash.oneOffs", "cash.separation"]
        .map((id) => formatNumber(Math.abs(cashValue(id)), language, 2))
        .join(" + ") + ` = ${formatMoney(Math.abs(separationCash), language, { decimals: 2 })}`,
      id: "separation",
      label: copy("cash.reconciliation.separation"),
    },
    {
      formula: ["cash.tax", "cash.currentCapex", "cash.currentWc"]
        .map((id) => formatNumber(Math.abs(cashValue(id)), language, 2))
        .join(" + ") + ` = ${formatMoney(Math.abs(taxAndReinvestment), language, { decimals: 2 })}`,
      id: "reinvestment",
      label: copy("cash.reconciliation.reinvestment"),
    },
  ];

  const fundingRows = result.modules.m7.periods;
  const fundingLast = fundingRows.at(-1);
  const fundingPrevious = fundingRows.at(-2);
  const recurringEbitdaImpact = allocationBridgeStep.value + costBridgeStep.value;
  const state = result.modules.m7.resorb.state;
  const stateLabel = copy(stateCopyIds[state]);
  const pk = result.modules.m7.resorb.pk;
  const horizonPeriod = result.calendar.maxHorizon;
  const horizonContribution = (predicate) => result.modules.m7.inventory
    .filter(predicate)
    .reduce((sum, line) => sum + line.contribution[horizonPeriod], 0);
  const uncoveredStandaloneCosts = horizonContribution(
    ({ module }) => module === "M2" || module === "M3",
  );
  const compensatingTaxEffect = horizonContribution(
    ({ id }) => id === "L-TAXREC" || id === "L-CF-TAX",
  );
  const horizonMovement = result.modules.m7.horizon.delta;
  const horizonExplanationTitle = horizonMovement > 0
    ? copy("funding.horizonExplanation.rising", { period: periodLabel(horizonPeriod) })
    : horizonMovement < 0
      ? copy("funding.horizonExplanation.falling", { period: periodLabel(horizonPeriod) })
      : copy("funding.horizonExplanation.stable", { period: periodLabel(horizonPeriod) });

  const selectedOps = opellaFinancials.contracts.engine.levers["S-OPS"]
    .states[result.selections["S-OPS"]];
  const weightedTsaExit = result.modules.m4.services.reduce(
    (sum, service) => sum + Math.abs(service.monthly) * service.duration,
    0,
  ) / result.modules.m4.services.reduce(
    (sum, service) => sum + Math.abs(service.monthly),
    0,
  );
  const fundingAssumptions = [
    {
      id: "growth",
      label: copy("funding.assumption.growth"),
      value: formatPercent(selectedOps[0], language, 1),
    },
    {
      id: "margin",
      label: copy("funding.assumption.margin"),
      value: copy("funding.assumption.marginValue", {
        value: formatNumber(selectedOps[1] * 100, language, 1, true),
      }),
    },
    {
      id: "tax",
      label: copy("funding.assumption.tax"),
      value: formatPercent(snapshot.m6.taxRate.value, language, 0),
    },
    {
      id: "capex",
      label: copy("funding.assumption.capex"),
      value: formatPercent(snapshot.m6.capexRate.value, language, 1),
    },
    {
      id: "working-capital",
      label: copy("funding.assumption.workingCapital"),
      value: formatPercent(snapshot.m6.wcIntensity.value, language, 0),
    },
    {
      id: "tsa-exit",
      label: copy("funding.assumption.tsaExit"),
      value: copy("funding.assumption.months", {
        value: formatNumber(weightedTsaExit, language, 1),
      }),
    },
  ];

  const fundingSummary = copy(stateSummaryIds[state], {
    amount: formatMoney(fundingLast.need, language),
    horizon: periodLabel(fundingLast.period),
    pk: pk ? periodLabel(pk) : copy("common.notApplicable"),
  });
  const leverContracts = opellaFinancials.contracts.engine.levers;
  const leverOrder = ["S-COST", "S-ONEOFF", "S-OPS", "S-TSA"];
  const scenarioPresets = [
    {
      id: "prudent",
      selections: {
        "S-COST": "haute",
        "S-ONEOFF": "haute",
        "S-OPS": "basse",
        "S-TSA": "haute",
      },
    },
    {
      id: "central",
      selections: Object.fromEntries(leverOrder.map((id) => [id, "centrale"])),
    },
    {
      id: "favorable",
      selections: {
        "S-COST": "basse",
        "S-ONEOFF": "basse",
        "S-OPS": "haute",
        "S-TSA": "basse",
      },
    },
  ];
  const selectionMatches = (candidate) => leverOrder.every(
    (id) => selections[id] === candidate[id],
  );
  const activePreset = scenarioPresets.find(({ selections: candidate }) => (
    selectionMatches(candidate)
  ))?.id ?? "custom";
  const centralOutputs = centralResult.outputs;
  const activeOutputs = result.outputs;
  const scenarioPeriod = (output, id) => periodCalendarDisplay(
    output.calendar.periods,
    id,
    language,
    copy,
  );
  const steadyDifference = Number(activeOutputs["O-STEADY"].value.slice(1))
    - Number(centralOutputs["O-STEADY"].value.slice(1));
  const scenarioMetricDefinitions = [
    {
      id: "O-RUNRATE",
      active: formatMoney(activeOutputs["O-RUNRATE"].value, language),
      central: formatMoney(centralOutputs["O-RUNRATE"].value, language),
      delta: formatAccountingMoney(
        activeOutputs["O-RUNRATE"].value - centralOutputs["O-RUNRATE"].value,
        language,
        { positiveSign: true },
      ),
      formatRange: (value) => formatMoney(value, language),
      getRangeValue: (output) => output.outputs["O-RUNRATE"].value,
      label: copy("kpi.runRate"),
    },
    {
      id: "O-SEPCOST",
      active: formatMoney(activeOutputs["O-SEPCOST"].value, language),
      central: formatMoney(centralOutputs["O-SEPCOST"].value, language),
      delta: formatAccountingMoney(
        activeOutputs["O-SEPCOST"].value - centralOutputs["O-SEPCOST"].value,
        language,
        { positiveSign: true },
      ),
      formatRange: (value) => formatMoney(value, language),
      getRangeValue: (output) => output.outputs["O-SEPCOST"].value,
      label: copy("kpi.separationCost"),
    },
    {
      id: "O-PEAK",
      active: formatMoney(activeOutputs["O-PEAK"].value, language),
      central: formatMoney(centralOutputs["O-PEAK"].value, language),
      delta: formatAccountingMoney(
        activeOutputs["O-PEAK"].value - centralOutputs["O-PEAK"].value,
        language,
        { positiveSign: true },
      ),
      formatRange: (value) => formatMoney(value, language),
      getRangeValue: (output) => output.outputs["O-PEAK"].value,
      label: copy("kpi.peak"),
    },
    {
      id: "O-STEADY",
      active: scenarioPeriod(result, activeOutputs["O-STEADY"].value),
      central: scenarioPeriod(centralResult, centralOutputs["O-STEADY"].value),
      delta: steadyDifference === 0
        ? copy("common.noChange")
        : copy("scenarios.yearDelta", {
          value: formatNumber(steadyDifference, language, 0, true),
        }),
      formatRange: (value) => scenarioPeriod(
        scenarioUniverse.find(({ output }) => Number(output.outputs["O-STEADY"].value.slice(1)) === value)?.output
          ?? result,
        `P${value}`,
      ),
      getRangeValue: (output) => Number(output.outputs["O-STEADY"].value.slice(1)),
      description: copy("scenarios.steadyExplanation"),
      label: copy("scenarios.steadyIndicator"),
    },
  ];
  const scenarioComparisonRows = scenarioMetricDefinitions.map((definition) => {
    const rangeValues = scenarioUniverse.map(({ output }) => definition.getRangeValue(output));
    return {
      ...definition,
      maximum: Math.max(...rangeValues),
      minimum: Math.min(...rangeValues),
      value: definition.getRangeValue(result),
    };
  });

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
        formatMoney(recurringEbitdaImpact, language),
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
          <div className="opella-hero-download">
            <a
              download={opellaPublicWorkbook.file}
              href={opellaPublicWorkbook.href}
            >
              {copy("executive.download.button")}
            </a>
            <p>{copy("executive.download.description")}</p>
          </div>
        </div>
        <div aria-label={copy("nav.executive")} className="opella-kpi-grid">
          <MetricTile
            detail={copy("kpi.runRate.detail", {
              allocations: formatMoney(allocationBridgeStep.value, language),
              net: formatAccountingMoney(recurringEbitdaImpact, language),
              period: periodLabel(horizonPeriod),
            })}
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
            detail={copy("kpi.peak.detail", {
              horizon: formatMoney(fundingLast.need, language),
              horizonPeriod: periodLabel(fundingLast.period),
              peak: formatMoney(peak.value, language),
              peakPeriod: heroPeriodLabel(peak.period),
              recurring: formatAccountingMoney(fundingLast.eGap, language, { positiveSign: true }),
            })}
            detailClassName="opella-kpi-explanation"
            label={copy("kpi.peak")}
            outputId="O-PEAK"
            tone="neutral"
            value={formatMoney(peak.value, language)}
          />
          <MetricTile
            detail={copy("kpi.recurringEbitdaImpact.detail", {
              allocations: formatMoney(allocationBridgeStep.value, language),
              standalone: formatMoney(Math.abs(costBridgeStep.value), language),
            })}
            detailClassName="opella-kpi-explanation"
            label={copy("kpi.recurringEbitdaImpact")}
            tone="neutral"
            value={copy("kpi.recurringEbitdaImpact.value", {
              period: periodLabel(horizonPeriod),
              value: formatMoney(recurringEbitdaImpact, language),
            })}
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
        className="opella-transaction-scope"
        id="transaction"
        title={copy("transactionScope.title")}
      >
        <div className="opella-transaction-scope-grid">
          <article className="opella-transaction-scope-column">
            <h3>{copy("transactionScope.snapshot")}</h3>
            <dl className="opella-transaction-snapshot">
              <div
                data-public-fact-id="transaction-seller"
                data-source-ids={publicProfile.transaction.seller.source}
              >
                <dt>{copy("transactionScope.snapshot.seller")}</dt>
                <dd>{publicProfile.transaction.seller.value}</dd>
              </div>
              <div
                data-public-fact-id="transaction-buyer"
                data-source-ids={publicProfile.transaction.buyer.source}
              >
                <dt>{copy("transactionScope.snapshot.buyer")}</dt>
                <dd>{publicProfile.transaction.buyer.value}</dd>
              </div>
              <div data-public-fact-id="transaction-closing" data-source-ids="S2">
                <dt>{copy("transactionScope.snapshot.closing")}</dt>
                <dd>{formatLongDate(snapshot.calendar.closing, language)}</dd>
              </div>
              <div
                data-public-fact-id="transaction-enterprise-value"
                data-source-ids={snapshot.m1.enterpriseValue.source}
              >
                <dt>{copy("transactionScope.snapshot.enterpriseValue")}</dt>
                <dd>≈ {formatBillions(snapshot.m1.enterpriseValue.value, language, 0)}</dd>
              </div>
              <div
                data-public-fact-id="transaction-entry-multiple"
                data-source-ids={snapshot.m1.entryMultiple.source}
              >
                <dt>{copy("transactionScope.snapshot.entryMultiple")}</dt>
                <dd>≈ {formatMultiple(snapshot.m1.entryMultiple.value, language, 0)}</dd>
              </div>
              <div
                data-public-fact-id="transaction-reported-revenue"
                data-source-ids={snapshot.m1.reportedRevenue.source}
              >
                <dt>{copy("transactionScope.snapshot.reportedRevenue", {
                  period: publicProfile.transaction.reportedRevenuePeriod.value,
                })}</dt>
                <dd>{formatMoney(snapshot.m1.reportedRevenue.value, language, { decimals: 0 })}</dd>
              </div>
              <div
                data-derived-value-id="transaction-implied-ebitda"
                data-source-ids={snapshot.m1.ebitda.source}
              >
                <dt>{copy("transactionScope.snapshot.impliedEbitda")}</dt>
                <dd>≈ {formatBillions(snapshot.m1.ebitda.value, language, 2)}</dd>
              </div>
              <div
                data-derived-value-id="transaction-implied-margin"
                data-source-ids={snapshot.m1.margin.source}
              >
                <dt>{copy("transactionScope.snapshot.impliedMargin")}</dt>
                <dd>
                  ≈ {formatPercent(snapshot.m1.margin.value, language, 1)}
                  <small>{copy("evidence.scopeCaveat")}</small>
                </dd>
              </div>
              <div
                data-public-fact-id="transaction-ownership"
                data-source-ids={snapshot.m1.ownership.cdr.source}
                className="opella-transaction-ownership-row"
              >
                <dt>{copy("transactionScope.snapshot.ownership")}</dt>
                <dd>{Object.entries(snapshot.m1.ownership).map(([holder, field]) => (
                  `${publicProfile.transaction.ownershipHolders.value[holder]} ${formatPercent(field.value, language, 1)}`
                )).join(" · ")}</dd>
              </div>
            </dl>
          </article>

          <article className="opella-transaction-scope-column">
            <h3>{copy("transactionScope.scope")}</h3>
            <h4>{copy("transactionScope.scope.in")}</h4>
            <ul className="opella-atlas-list is-in-scope">
              <li
                data-public-fact-id="scope-market"
                data-source-ids={publicProfile.scope.market.source}
              >
                <AtlasScopeIcon type="included" />
                <span>{copy(`transactionScope.scope.market.${publicProfile.scope.market.value}`)}</span>
              </li>
              <li
                data-public-fact-id="scope-brand-count"
                data-source-ids={publicProfile.scope.brandCount.source}
              >
                <AtlasScopeIcon type="included" />
                <span>{copy("transactionScope.scope.brandCount", {
                  value: formatNumber(publicProfile.scope.brandCount.value, language, 0),
                })}</span>
              </li>
              <li
                data-public-fact-id="scope-brands"
                data-source-ids={publicProfile.scope.brands.source}
              >
                <AtlasScopeIcon type="included" />
                <span>{formatTextList(publicProfile.scope.brands.value, language)}</span>
              </li>
              <li
                data-public-fact-id="scope-employees"
                data-source-ids={publicProfile.scope.employees.source}
              >
                <AtlasScopeIcon type="included" />
                <span>{copy("transactionScope.scope.employees", {
                  value: formatNumber(publicProfile.scope.employees.value, language, 0),
                })}</span>
              </li>
            </ul>
            <h4>{copy("transactionScope.scope.out")}</h4>
            <ul className="opella-atlas-list is-out-of-scope">
              {publicProfile.scope.outOfScope.value.map((item) => (
                <li
                  data-public-fact-id={`scope-out-${item}`}
                  data-source-ids={publicProfile.scope.outOfScope.source}
                  key={item}
                >
                  <AtlasScopeIcon type="excluded" />
                  <span>{copy(`transactionScope.scope.out.${item}`)}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="opella-transaction-scope-column">
            <h3>{copy("transactionScope.geography")}</h3>
            <p className="opella-footprint-summary">
              <span
                data-public-fact-id="geography-directCountries"
                data-source-ids={publicProfile.geography.directCountries.source}
              >
                {copy("transactionScope.geography.directCountries", {
                  value: formatNumber(publicProfile.geography.directCountries.value, language, 0),
                })}
              </span>
              {" ; "}
              <span
                data-public-fact-id="geography-indirectCountries"
                data-source-ids={publicProfile.geography.indirectCountries.source}
              >
                {copy("transactionScope.geography.indirectCountries", {
                  value: formatNumber(publicProfile.geography.indirectCountries.value, language, 0),
                })}
              </span>
              .
            </p>
            <dl className="opella-atlas-metrics">
              <div
                data-public-fact-id="geography-nationalities"
                data-source-ids={publicProfile.geography.nationalities.source}
              >
                <dt>{copy("transactionScope.geography.nationalities")}</dt>
                <dd>{copy("transactionScope.value.minimum", {
                  value: formatNumber(publicProfile.geography.nationalities.value, language, 0),
                })}</dd>
              </div>
              <div
                data-public-fact-id="geography-consumers"
                data-source-ids={publicProfile.geography.consumers.source}
              >
                <dt>{copy("transactionScope.geography.consumers")}</dt>
                <dd>{copy("transactionScope.value.approxMillions", {
                  value: formatNumber(publicProfile.geography.consumers.value, language, 0),
                })}</dd>
              </div>
            </dl>
          </article>

          <article className="opella-transaction-scope-column">
            <h3>{copy("transactionScope.industry")}</h3>
            <p
              className="opella-footprint-summary"
              data-public-fact-id="industry-summary"
              data-source-ids={publicProfile.industry.summary.source}
            >
              {copy(`transactionScope.industry.summary.${publicProfile.industry.summary.value}`)}
            </p>
            <dl className="opella-atlas-metrics">
              {[
                "manufacturingSites",
                "innovationCenters",
                "manufacturingProfessionals",
              ].map((fieldName) => {
                const field = publicProfile.industry[fieldName];
                return (
                  <div
                    data-public-fact-id={`industry-${fieldName}`}
                    data-source-ids={field.source}
                    key={fieldName}
                  >
                    <dt>{copy(`transactionScope.industry.${fieldName}`)}</dt>
                    <dd>{fieldName === "manufacturingProfessionals"
                      ? copy("transactionScope.value.minimum", {
                        value: formatNumber(field.value, language, 0),
                      })
                      : formatNumber(field.value, language, 0)}</dd>
                  </div>
                );
              })}
            </dl>
          </article>
        </div>
        <div className="opella-transaction-scope-footer">
          <p>{copy("transactionScope.caveat")}</p>
          <a href="#sources">{copy("transactionScope.sources")} ↓</a>
        </div>
      </Section>

      <Section
        className="opella-analytical-block opella-standalone-block"
        id="standalone-build"
        kicker={copy("standalone.kicker")}
        title={copy("standalone.title")}
      >
        <p className="opella-section-intro">{copy("standalone.intro")}</p>
        <div className="opella-standalone-layout">
          <div className="opella-standalone-main">
            <div className="opella-standalone-chart">
              <h3>{standaloneChartTitle}</h3>
              <SignedWaterfall
                ariaLabel={standaloneChartTitle}
                items={standaloneWaterfallItems}
              />
            </div>
            <div className="opella-standalone-summary">
              <div className="opella-standalone-summary-heading">
                <h3>{copy("standalone.summary")}</h3>
                <span>{copy("standalone.summary.value")}</span>
                <span>{copy("standalone.summary.commentary")}</span>
              </div>
              {standaloneSummaryItems.map((item) => (
                <div
                  className={`opella-standalone-summary-row${item.id === "perimeter-subtotal" ? " is-subtotal" : ""}${item.id === "output" ? " is-output" : ""}`}
                  key={item.id}
                >
                  <strong>{item.label}</strong>
                  <span>{item.displayValue}</span>
                  <p>{item.commentary}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="opella-standalone-takeaways">
            <h3>{copy("standalone.takeaways")}</h3>
            <ul>
              {standaloneTakeaways.map((takeaway) => (
                <li key={takeaway.id}>
                  <strong>{takeaway.headline}</strong>
                  <p>{takeaway.body}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Section>

      <Section
        className="opella-analytical-block opella-tsa-block"
        id="tsa"
        kicker={copy("tsa.kicker")}
        title={copy("tsa.title")}
      >
        <p className="opella-section-intro">{copy("tsa.intro")}</p>
        <div className="opella-tsa-atlas-layout">
          <TsaExitBars
            copy={copy}
            language={language}
            services={result.modules.m4.services}
          />
          <OneOffNatureTable
            copy={copy}
            items={oneOffItems}
            language={language}
            total={separationComponents.oneOffs}
          />
          <OneOffPhasingChart
            copy={copy}
            language={language}
            periods={oneOffPhasingPeriods}
            transitionEconomics={transitionEconomics}
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
        <div className="cash-funding-content" id="funding-need">
          <div className="cash-funding-grid">
            <CashBridgeGraphic
              ariaLabel={`${copy("cash.chartLabel")} · ${periodLabel(firstPeriod)}`}
              copy={copy}
              items={cashOverviewRows}
              language={language}
              period={firstPeriod}
              periodLabel={periodLabel}
              reconciliations={cashReconciliations}
              total={result.modules.m6.cash[firstPeriod]}
            />
            <FundingCurve
              annotation={{ peak, summary: fundingSummary }}
              copy={copy}
              language={language}
              peak={peak}
              periodLabel={periodLabel}
              periods={fundingRows}
              stateLabel={stateLabel}
            />
            <FundingAssumptions assumptions={fundingAssumptions} copy={copy} />
          </div>

          <details className="cash-funding-details">
            <summary>{copy("cash.detailsSummary")}</summary>
            <div className="cash-funding-details-body">
              <h3>{copy("cash.matrixTitle")}</h3>
              <DataTable
                columns={[copy("cash.line"), ...horizon.map(periodLabel)]}
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

              <h3>{copy("funding.periodTable")}</h3>
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

              <section
                aria-labelledby="opella-funding-state-title"
                className="funding-horizon-explanation"
                data-content-id="opella.funding.state"
              >
                <h3 id="opella-funding-state-title">{horizonExplanationTitle}</h3>
                <dl>
                  <div>
                    <dt>{copy("funding.horizonExplanation.need", { period: periodLabel(horizonPeriod) })}</dt>
                    <dd>{formatAccountingMoney(fundingLast.need, language)}</dd>
                  </div>
                  <div>
                    <dt>{copy("funding.horizonExplanation.change", { period: periodLabel(fundingPrevious.period) })}</dt>
                    <dd>{formatAccountingMoney(horizonMovement, language, { positiveSign: true })}</dd>
                  </div>
                  <div>
                    <dt>{copy("funding.horizonExplanation.uncoveredStandalone")}</dt>
                    <dd>{formatAccountingMoney(uncoveredStandaloneCosts, language, { positiveSign: true })}</dd>
                  </div>
                  <div>
                    <dt>{copy("funding.horizonExplanation.taxOffset")}</dt>
                    <dd>{formatAccountingMoney(compensatingTaxEffect, language)}</dd>
                  </div>
                  <div className="is-net">
                    <dt>{copy("funding.horizonExplanation.netRecurring")}</dt>
                    <dd>{formatAccountingMoney(fundingLast.eGap, language, { positiveSign: true })}</dd>
                  </div>
                  <div>
                    <dt>{copy("funding.horizonExplanation.remainingOneOff")}</dt>
                    <dd>{formatAccountingMoney(fundingLast.nOneOff, language)}</dd>
                  </div>
                </dl>
                <p>{copy(`funding.horizonExplanation.conclusion.${stateCopyIds[state].split(".").at(-1)}`)}</p>
              </section>
            </div>
          </details>
        </div>
      </Section>

      <Section
        className="opella-analytical-block opella-scenarios-block"
        id="scenarios"
        title={copy("scenarios.title")}
      >
        <div aria-live="polite" className="opella-scenario-top-action">
          {isCentral
            ? <span>{copy("scenarios.centralActive")}</span>
            : <button onClick={reset} type="button">{copy("scenarios.reset")}</button>}
        </div>

        <div className="opella-scenario-presets">
          <div className="opella-scenario-presets-intro">
            <h3>{copy("scenarios.presets")}</h3>
            <p>{copy("scenarios.presetsIntro")}</p>
          </div>
          {scenarioPresets.map((preset) => (
            <button
              aria-pressed={activePreset === preset.id}
              className="opella-scenario-preset"
              key={preset.id}
              onClick={() => setScenario(preset.selections)}
              type="button"
            >
              <strong>{copy(`scenarios.preset.${preset.id}`)}</strong>
              <span>
                {leverOrder.map((id) => (
                  <span key={id}>
                    {id === "S-TSA" ? copy("scenarios.tsaPresetLabel") : copy(`lever.${id}`)} : {leverStateLabel(id, preset.selections[id], copy)}
                  </span>
                ))}
              </span>
            </button>
          ))}
          <div className={`opella-scenario-preset is-custom${activePreset === "custom" ? " is-active" : ""}`}>
            <strong>{copy("scenarios.preset.custom")}</strong>
            <p>{copy("scenarios.preset.customText")}</p>
          </div>
        </div>

        <div aria-label={copy("scenarios.panelLabel")} className="opella-scenario-panel" role="group">
          {leverOrder.map((id) => {
            const contract = leverContracts[id];
            const headingId = `opella-lever-${id.toLowerCase()}`;
            return (
            <div aria-labelledby={headingId} className="opella-lever" key={id} role="group">
              <h3 id={headingId}>
                <span>{leverOrder.indexOf(id) + 1}.</span> {copy(`lever.${id}`)}
              </h3>
              <div className="opella-lever-options">
                {Object.entries(contract.states).map(([leverState, value]) => (
                  <button
                    aria-label={`${copy(`lever.${id}`)} · ${leverStateLabel(id, leverState, copy)} · ${leverValue(id, value, language, copy)}`}
                    aria-pressed={selections[id] === leverState}
                    key={leverState}
                    onClick={() => setLever(id, leverState)}
                    type="button"
                  >
                    <span>{leverStateLabel(id, leverState, copy)}</span>
                    <strong>{leverValue(id, value, language, copy)}</strong>
                  </button>
                ))}
              </div>
            </div>
            );
          })}
        </div>

        <div className="opella-scenario-comparison">
          <div className="opella-scenario-comparison-heading">
            <h3>{copy("scenarios.comparison")}</h3>
            <p>{copy("scenarios.impactsIntro")}</p>
          </div>
          <div className="table-scroll" tabIndex="0">
            <table className="opella-scenario-impact-table">
              <caption className="sr-only">{copy("scenarios.comparison")}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy("common.indicator")}</th>
                  <th scope="col">{copy("scenarios.range")}</th>
                  <th scope="col">{copy("common.centralCase")}</th>
                  <th className="is-current" scope="col">{copy("common.currentSelection")}</th>
                  <th scope="col">{copy("scenarios.delta")}</th>
                </tr>
              </thead>
              <tbody>
                {scenarioComparisonRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <span>{row.label}</span>
                      {row.description ? <small>{row.description}</small> : null}
                    </th>
                    <td>
                      <ScenarioRange
                        formatValue={row.formatRange}
                        maximum={row.maximum}
                        minimum={row.minimum}
                        value={row.value}
                      />
                    </td>
                    <td>{row.central}</td>
                    <td className="is-current">{row.active}</td>
                    <td>{row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section
        className="opella-decision-diligence"
        id="buyer-implications"
        kicker={copy("buyer.kicker")}
        title={copy("buyer.title")}
      >
        <span aria-hidden="true" className="anchor-alias" id="diligence" />
        <div className="opella-implications-summary">
          <h3>{copy("buyer.implicationsTitle")}</h3>
          <ul>
            {["autonomy", "tsa", "separation", "funding", "persistence"].map((id) => (
              <li key={id}>{copy(`buyer.implication.${id}`)}</li>
            ))}
          </ul>
        </div>
        <h3 className="opella-diligence-title">{copy("diligence.title")}</h3>
        <p className="opella-section-intro">{copy("diligence.intro")}</p>
        <DataTable
          columns={[copy("diligence.item"), copy("diligence.why"), copy("diligence.effect")]}
          getRowKey={(row) => row[0]}
          highlightColumn={null}
          label={copy("nav.diligence")}
          rowHeaderColumn={0}
          rows={opellaDiligenceItems.map((id) => [
            copy(id),
            copy(`${id}.why`),
            copy(`${id}.effect`),
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
        <div className="opella-source-footnotes">
          <section id="methodology">
            <h3>{copy("sources.conventionsTitle")}</h3>
            <ul>
              {["stub", "steady", "signs", "separationCost", "counterfactual"].map((id) => (
                <li key={id}>{copy(`methodology.${id}`)}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>{copy("sources.limitationsTitle")}</h3>
            <ul>
              {["estimates", "stub", "noFullCashflow", "noUnderwriting"].map((id) => (
                <li key={id}>{copy(`sources.limit.${id}`)}</li>
              ))}
            </ul>
          </section>
          <aside className="opella-model-download">
            <div>
              <h3>{copy("sources.download.title")}</h3>
              <p>{copy("sources.download.text")}</p>
            </div>
            <a
              download={opellaPublicWorkbook.file}
              href={opellaPublicWorkbook.href}
            >
              {copy("sources.download.button")}
            </a>
          </aside>
        </div>
      </Section>
    </article>
  );
}
