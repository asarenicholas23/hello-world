import { createContext, useContext, useState } from "react";
import { firms as initialFirms, inspections as initialInspections, violations as initialViolations } from "../data/mockData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [firms, setFirms] = useState(initialFirms);
  const [inspections, setInspections] = useState(initialInspections);
  const [violations, setViolations] = useState(initialViolations);

  function addInspection(inspection) {
    const id = `INS${String(inspections.length + 1).padStart(3, "0")}`;
    const newInspection = { ...inspection, id };
    setInspections((prev) => [...prev, newInspection]);

    // Update firm compliance score and lastInspected
    setFirms((prev) =>
      prev.map((f) =>
        f.id === inspection.firmId
          ? { ...f, complianceScore: inspection.score, lastInspected: inspection.date }
          : f
      )
    );
    return id;
  }

  function addViolation(violation) {
    const id = `VIO${String(violations.length + 1).padStart(3, "0")}`;
    setViolations((prev) => [...prev, { ...violation, id }]);
  }

  function updateViolationStatus(id, status) {
    setViolations((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  }

  return (
    <AppContext.Provider value={{ firms, inspections, violations, addInspection, addViolation, updateViolationStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
