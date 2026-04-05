import { Navigate, Route, Routes } from "react-router-dom";
import { TimelineIndexPage } from "./pages/TimelineIndexPage.js";
import { TimelineViewerPage } from "./pages/TimelineViewerPage.js";

export function App() {
  return (
    <div className="timeline-app">
      <Routes>
        <Route path="/" element={<TimelineIndexPage />} />
        <Route path="/folders/*" element={<Navigate replace to="/" />} />
        <Route path="/samples/*" element={<Navigate replace to="/" />} />
        <Route path="/:jobId" element={<TimelineViewerPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </div>
  );
}
