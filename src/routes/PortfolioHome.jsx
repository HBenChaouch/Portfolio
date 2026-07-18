import { Link } from "react-router-dom";
import LanguageToggle from "../components/LanguageToggle.jsx";
import Localized from "../components/Localized.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { portfolioCases } from "../data/portfolioCases.js";

export default function PortfolioHome() {
  const { language, t } = useLanguage();

  return (
    <Localized><main className="portfolio-home">
      <header className="home-masthead">
        <div className="home-identity">
          <strong>Hamza Ben Chaouch</strong>
          <span>ESSEC Grande École · Finance &amp; Analytics</span>
        </div>
        <div className="home-contact">
          <a href="mailto:hamza.benchaouch@essec.edu">hamza.benchaouch@essec.edu</a>
          <LanguageToggle />
        </div>
      </header>
      <section className="home-hero">
        <div>
          <p className="eyebrow">Finance and analytics portfolio</p>
          <h1>Finance cases, built for decisions.</h1>
        </div>
        <p>Three finance cases built for three decisions: public-company valuation, transaction services and downside-oriented fund controlling.</p>
      </section>

      <section className="home-selection" aria-label="Portfolio cases">
        <header className="home-selection-head">
          <p className="eyebrow">Selected work</p>
          <p>One flagship case, supported by two complementary finance projects.</p>
        </header>
        <div className="case-grid">
          {portfolioCases.map((item, index) => {
          const content = (
            <article
              className={`case-card ${item.priority === "flagship" ? "case-card-flagship" : ""}`}
              style={{ "--card-index": index }}
            >
              <div>
                <span className="case-status">{t(item.status)}</span>
                <p className="eyebrow">{t(item.category)}</p>
                <h2>{t(item.title)}</h2>
                <p>{t(item.description)}</p>
              </div>
              <div className="case-metrics">
                {item.metrics.map((metric) => (
                  <span key={metric}>{t(metric)}</span>
                ))}
              </div>
              <span className="case-cta">{t(item.cta)}<span aria-hidden="true"> →</span></span>
            </article>
          );

          if (item.available === false) {
            return <div className="case-grid-item case-grid-item-unavailable" key={item.slug}>{content}</div>;
          }

          return item.external ? (
            <a
              className="case-grid-item"
              href={item.href}
              key={item.slug}
              rel="noopener noreferrer"
              target="_blank"
            >
              {content}
            </a>
          ) : (
            <Link className="case-grid-item" key={item.slug} to={language === "en" ? `${item.href}?lang=en` : item.href}>
              {content}
            </Link>
          );
          })}
        </div>
      </section>
    </main></Localized>
  );
}
