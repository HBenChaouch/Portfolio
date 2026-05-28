import { useSidetradeScenario } from "../context/SidetradeScenarioContext.jsx";
import { SCENARIOS, sensitivityWaccG } from "../utils/dcfEngine.js";

export default function SensitivityTable() {
  const { activeScenario } = useSidetradeScenario();
  const waccs = [0.085, 0.09, 0.095, 0.1, 0.105];
  const terminalGrowths = [0.035, 0.03, 0.025, 0.02, 0.015];
  const scenario = SCENARIOS[activeScenario];
  const grid = sensitivityWaccG(activeScenario, waccs, terminalGrowths);
  const values = grid.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="sensitivity-wrap">
      <div className="panel-head compact">
        <div>
          <p className="eyebrow">Sensitivity</p>
          <h3>Enterprise value by WACC and terminal growth</h3>
        </div>
        <span className="panel-kicker">Base FCF profile</span>
      </div>
      <div className="table-scroll">
        <table className="sensitivity-table">
          <thead>
            <tr>
              <th>EV EURm / WACC</th>
              {waccs.map((wacc) => (
                <th key={wacc}>{(wacc * 100).toFixed(1)}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terminalGrowths.map((g, rowIndex) => (
              <tr key={g}>
                <td>g = {(g * 100).toFixed(1)}%</td>
                {waccs.map((wacc, colIndex) => {
                  const value = grid[rowIndex][colIndex];
                  const isCenter = Math.abs(wacc - scenario.wacc) < 0.0001 && Math.abs(g - scenario.g) < 0.0001;
                  const alpha = 0.05 + ((value - min) / (max - min)) * 0.22;
                  return (
                    <td
                      className={isCenter ? "center" : ""}
                      key={`${g}-${wacc}`}
                      style={{ background: isCenter ? undefined : `rgba(128, 30, 42, ${alpha})` }}
                    >
                      EUR{Math.round(value)}m
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
