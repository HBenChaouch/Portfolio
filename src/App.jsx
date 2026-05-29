import { Navigate, Route, Routes } from "react-router-dom";
import CaseShell from "./components/CaseShell.jsx";
import { SidetradeScenarioProvider } from "./context/SidetradeScenarioContext.jsx";
import {
  AnalysisView,
  DocumentsPage,
  MethodologyPage,
} from "./routes/CaseSubPages.jsx";
import PortfolioHome from "./routes/PortfolioHome.jsx";
import SummaryView from "./routes/SummaryView.jsx";

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
        <Route index element={<Navigate to="summary" replace />} />
        <Route path="summary" element={<SummaryView />} />
        <Route path="analysis" element={<AnalysisView />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="sources" element={<Navigate to="documents" replace />} />
        <Route path="snapshot" element={<Navigate to="../analysis#snapshot" replace />} />
        <Route path="market" element={<Navigate to="../analysis#market" replace />} />
        <Route path="dcf" element={<Navigate to="../analysis#dcf" replace />} />
        <Route path="trading-comps" element={<Navigate to="../analysis#trading" replace />} />
        <Route path="transaction-comps" element={<Navigate to="../analysis#transaction" replace />} />
        <Route path="lbo" element={<Navigate to="../analysis#lbo" replace />} />
        <Route path="football-field" element={<Navigate to="../analysis#football" replace />} />
        <Route path="equity-bridge" element={<Navigate to="../analysis#football" replace />} />
        <Route path="caveats" element={<Navigate to="../analysis#caveats" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
