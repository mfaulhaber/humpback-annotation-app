import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendPort = parseInt(process.env["FRONTEND_PORT"] ?? "6173", 10);
const apiPort = process.env["API_PORT"] ?? "3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/media": `http://localhost:${apiPort}`,
    },
  },
});
