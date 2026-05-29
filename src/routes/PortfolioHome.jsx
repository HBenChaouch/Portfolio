import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { portfolioCases } from "../data/portfolioCases.js";

export default function PortfolioHome() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="portfolio-home">
      <section className="home-hero">
        <p className="eyebrow">Finance and analytics portfolio</p>
        <h1>Investment judgment, translated into usable analytical cases.</h1>
        <p>
          A portfolio of valuation work, deal analysis, market mapping and operating models. Sidetrade is
          the first migrated case in the new React/Vite architecture.
        </p>
      </section>

      <section className="case-grid" aria-label="Portfolio cases">
        {portfolioCases.map((item, index) => {
          const content = (
            <motion.article
              animate={{ opacity: 1, y: 0 }}
              className="case-card"
              initial={{ opacity: 0, y: 16 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
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
            </motion.article>
          );

          return item.href === "#" ? (
            <div className="disabled-link" key={item.slug}>
              {content}
            </div>
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
