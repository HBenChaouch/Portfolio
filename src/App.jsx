import { Navigate, Route, Routes } from "react-router-dom";
import CaseShell from "./components/CaseShell.jsx";
import { SidetradeScenarioProvider } from "./context/SidetradeScenarioContext.jsx";
import PortfolioHome from "./routes/PortfolioHome.jsx";
import AnalysisView from "./routes/AnalysisView.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortfolioHome />} />
      <Route
        path="/cases/sidetrade-valuation"
        element={
          <SidetradeScenarioProvider>
            <CaseShell />
          </SidetradeScenarioProvider>
        }
      >
        <Route index element={<AnalysisView />} />
        <Route path="analysis" element={<AnalysisView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}