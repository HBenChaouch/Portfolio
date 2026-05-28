import { Navigate, Route, Routes } from "react-router-dom";
import CaseShell from "./components/CaseShell.jsx";
import { SidetradeScenarioProvider } from "./context/SidetradeScenarioContext.jsx";
import PortfolioHome from "./routes/PortfolioHome.jsx";
import SidetradePlaceholder from "./routes/SidetradePlaceholder.jsx";
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
        <Route path="snapshot" element={<SidetradePlaceholder />} />
        <Route path="market" element={<SidetradePlaceholder />} />
        <Route path="dcf" element={<SidetradePlaceholder />} />
        <Route path="trading" element={<SidetradePlaceholder />} />
        <Route path="transaction" element={<SidetradePlaceholder />} />
        <Route path="lbo" element={<SidetradePlaceholder />} />
        <Route path="football" element={<SidetradePlaceholder />} />
        <Route path="equity-bridge" element={<SidetradePlaceholder />} />
        <Route path="caveats" element={<SidetradePlaceholder />} />
        <Route path="methodology" element={<SidetradePlaceholder />} />
        <Route path="sources" element={<SidetradePlaceholder />} />
        <Route path="source-files" element={<SidetradePlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
