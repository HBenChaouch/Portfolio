import { scenarioMeta } from "../data/sidetradeCase.js";
import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import { scenarioSummary } from "../utils/dcfEngine.js";

export default function ScenarioSwitch({ activeScenario, onChange }) {
  const context = useSidetradeScenario();
  const currentScenario = activeScenario || context.activeScenario;
  const handleChange = onChange || context.setActiveScenario;

  return (
    <div className="scenario-switch" role="tablist" aria-label="DCF scenario">
      {Object.values(scenarioMeta).map((scenario) => (
        <button
          aria-selected={currentScenario === scenario.id}
          className="scenario-card"
          key={scenario.id}
          onClick={() => handleChange(scenario.id)}
          role="tab"
          type="button"
        >
          <span>{scenario.label}</span>
          <small>{scenario.short}</small>
          <strong>EUR{scenarioSummary(scenario.id).ev.toFixed(0)}m EV</strong>
        </button>
      ))}
    </div>
  );
}
