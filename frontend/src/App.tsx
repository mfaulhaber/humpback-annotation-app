import { Routes, Route } from "react-router-dom";
import { FolderListPage } from "./pages/FolderListPage.js";
import { SampleListPage } from "./pages/SampleListPage.js";
import { SampleDetailPage } from "./pages/SampleDetailPage.js";
import { DevUserPicker } from "./components/DevUserPicker.js";

export function App() {
  return (
    <div>
      <header
        style={{
          padding: "12px 24px",
          background: "#1a1a2e",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <strong style={{ fontSize: 16 }}>Humpback Annotation</strong>
        <div style={{ flex: 1 }} />
        <DevUserPicker />
      </header>
      <Routes>
        <Route path="/" element={<FolderListPage />} />
        <Route path="/folders/:folderId" element={<SampleListPage />} />
        <Route path="/samples/:sampleId" element={<SampleDetailPage />} />
      </Routes>
    </div>
  );
}
