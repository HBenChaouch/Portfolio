import { Navigate, Route, Routes } from "react-router-dom";
import CaseShell from "./components/CaseShell.jsx";
import { SidetradeScenarioProvider } from "./context/SidetradeScenarioContext.jsx";
import {
  CaveatsPage,
  CompanySnapshotPage,
  DcfPage,
  DocumentsPage,
  EquityBridgePage,
  FootballFieldPage,
  LboPage,
  MarketReferencePage,
  MethodologyPage,
  SourcesPage,
  TradingCompsPage,
  TransactionCompsPage,
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
        <Route path="snapshot" element={<CompanySnapshotPage />} />
        <Route path="market" element={<MarketReferencePage />} />
        <Route path="dcf" element={<DcfPage />} />
        <Route path="trading-comps" element={<TradingCompsPage />} />
        <Route path="transaction-comps" element={<TransactionCompsPage />} />
        <Route path="lbo" element={<LboPage />} />
        <Route path="football-field" element={<FootballFieldPage />} />
        <Route path="equity-bridge" element={<EquityBridgePage />} />
        <Route path="caveats" element={<CaveatsPage />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
