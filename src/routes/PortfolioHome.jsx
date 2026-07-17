import { Link } from "react-router-dom";
import { portfolioCases } from "../data/portfolioCases.js";

export default function PortfolioHome() {
  return (
    <main className="portfolio-home">
      <section className="home-hero">
        <p className="eyebrow">Finance and analytics portfolio</p>
        <h1>Investment judgment, translated into usable analytical cases.</h1>
        <p>
          Three finance cases, each built for a different decision: public-company valuation, transaction
          services and downside-oriented fund controlling.
        </p>
      </section>

      <section className="case-grid" aria-label="Portfolio cases">
        {portfolioCases.map((item, index) => {
          const content = (
            <article
              className={`case-card ${item.priority === "flagship" ? "case-card-flagship" : ""}`}
              style={{ "--card-index": index }}
            >
              <div>
                <span className="case-status">{item.status}</span>
                <p className="eyebrow">{item.category}</p>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <div className="case-metrics">
                {item.metrics.map((metric) => (
                  <span key={metric}>{metric}</span>
                ))}
              </div>
              <span className="case-cta">{item.cta}<span aria-hidden="true"> →</span></span>
            </article>
          );

          return item.external || item.download ? (
            <a
              download={item.download || undefined}
              href={item.href}
              key={item.slug}
              rel={item.external ? "noopener noreferrer" : undefined}
              target={item.external ? "_blank" : undefined}
            >
              {content}
            </a>
          ) : (
            <Link key={item.slug} to={item.href}>
              {content}
            </Link>
          );
        })}
      </section>
    </main>
  );
}
