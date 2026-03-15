import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Folder } from "@humpback/api";
import { fetchFolders } from "../api/catalog.js";

export function FolderListPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFolders()
      .then((res) => setFolders(res.folders))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load folders"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Loading folders...</p>;
  if (error) return <p style={{ padding: 24, color: "crimson" }}>{error}</p>;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 16 }}>Folders</h1>
      {folders.length === 0 ? (
        <p>No folders found.</p>
      ) : (
        <ul style={{ listStyle: "none", display: "grid", gap: 12 }}>
          {folders.map((f) => (
            <li key={f.folderId}>
              <Link
                to={`/folders/${f.folderId}`}
                style={{
                  display: "block",
                  padding: 16,
                  background: "#fff",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid #e0e0e0",
                }}
              >
                <strong>{f.name}</strong>
                <br />
                <span style={{ color: "#666", fontSize: 14 }}>
                  {f.description} &middot; {f.sampleCount} samples
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
