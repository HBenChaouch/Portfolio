import { Link } from "react-router-dom";
import LanguageToggle from "../components/LanguageToggle.jsx";
import Localized from "../components/Localized.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { portfolioCases } from "../data/portfolioCases.js";

const CV_EN_FILE = "Hamza_Ben_Chaouch_CV_EN.pdf";
const CV_EN_AVAILABLE = false;

const asset = (file) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${file}`;

const CONTACT_LINKS = [
  { label: "Email", href: "mailto:hamza.benchaouch@essec.edu" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/hbenchaouch" },
  { label: "GitHub", href: "https://github.com/HBenChaouch" },
];

export default function PortfolioHome() {
  const { language, t } = useLanguage();

  return (
    <Localized><main className="portfolio-home">
      <header className="home-masthead">
        <div className="home-identity"><strong>Hamza Ben Chaouch</strong></div>
        <LanguageToggle />
      </header>

      <section className="home-id-block">
        <img
          alt=""
          className="home-id-portrait"
          src={asset("Hamza_Ben_Chaouch_Headshot.jpg")}
        />
        <div className="home-id-body">
          <p className="home-id-name">Hamza Ben Chaouch</p>
          <p className="home-id-line">ESSEC Grande École · Finance &amp; Analytics</p>
          <p className="home-id-line">Paris, France</p>
          <p className="home-id-toolkit">{t("Financial modeling · Valuation · Python · Power BI · Data analysis")}</p>
          <p className="home-id-contact">
            {CONTACT_LINKS.map((link) => (
              <a href={link.href} key={link.label} rel="noopener">{link.label}</a>
            ))}
            <a download="Hamza_Ben_Chaouch_CV_FR.pdf" href={asset("Hamza_Ben_Chaouch_CV_FR.pdf")}>CV FR</a>
            {CV_EN_AVAILABLE ? (
              <a download={CV_EN_FILE} href={asset(CV_EN_FILE)}>CV EN</a>
            ) : null}
          </p>
        </div>
      </section>

      <section className="home-hero">
        <div>
          <p className="eyebrow">Portfolio · Finance &amp; Analytics</p>
          <h1>Finance and analytics work.</h1>
        </div>
        <div>
          <p>Three self-built cases: a listed-company valuation with DCF scenarios, comparables and LBO affordability; a carve-out model covering the stand-alone perimeter, TSA unwind and separation costs; and a fund downside cockpit for covenants and liquidity. Figures carry their source status, market references are dated, and the underlying workbooks are downloadable.</p>
        </div>
      </section>

      <section className="home-selection" aria-label="Portfolio cases">
        <header className="home-selection-head">
          <p className="eyebrow">Projects</p>
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

          return item.static ? (
            <a
              className="case-grid-item"
              href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}${item.href}${language === "en" ? "?lang=en" : ""}`}
              key={item.slug}
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
