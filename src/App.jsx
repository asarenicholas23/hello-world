import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Firms from "./pages/Firms";
import FirmDetail from "./pages/FirmDetail";
import Inspections from "./pages/Inspections";
import NewInspection from "./pages/NewInspection";
import InspectionDetail from "./pages/InspectionDetail";
import Violations from "./pages/Violations";
import ViolationDetail from "./pages/ViolationDetail";
import Reports from "./pages/Reports";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="firms" element={<Firms />} />
            <Route path="firms/:id" element={<FirmDetail />} />
            <Route path="inspections" element={<Inspections />} />
            <Route path="inspections/new" element={<NewInspection />} />
            <Route path="inspections/:id" element={<InspectionDetail />} />
            <Route path="violations" element={<Violations />} />
            <Route path="violations/:id" element={<ViolationDetail />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
