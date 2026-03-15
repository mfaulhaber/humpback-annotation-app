import { useState } from "react";
import { getDevUser, setDevUser } from "../api/client.js";

const DEV_USERS = [
  { userId: "dev_user_1", role: "annotator", label: "User 1 (annotator)" },
  { userId: "dev_user_2", role: "annotator", label: "User 2 (annotator)" },
  { userId: "admin_user", role: "admin", label: "Admin" },
] as const;

export function DevUserPicker() {
  const [current, setCurrent] = useState(() => getDevUser());

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = DEV_USERS.find((u) => u.userId === e.target.value);
    if (!selected) return;
    setDevUser(selected.userId, selected.role);
    setCurrent({ userId: selected.userId, role: selected.role });
    // Reload to reflect new user state across all data
    window.location.reload();
  }

  return (
    <select
      value={current.userId}
      onChange={handleChange}
      style={{
        padding: "4px 8px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.3)",
        background: "rgba(255,255,255,0.1)",
        color: "#fff",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {DEV_USERS.map((u) => (
        <option key={u.userId} value={u.userId} style={{ color: "#333" }}>
          {u.label}
        </option>
      ))}
    </select>
  );
}
