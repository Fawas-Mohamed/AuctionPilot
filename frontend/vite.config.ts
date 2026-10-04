import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && mode === "production") {
    const api = (env.VITE_API_URL || "").trim().replace(/\/$/, "");
    const hub = (env.VITE_SIGNALR_URL || api.replace(/\/api$/, "") + "/hubs/auction").trim();
    let valid = false;
    try {
      const apiUrl = new URL(api), hubUrl = new URL(hub);
      valid = apiUrl.protocol === "https:" && hubUrl.protocol === "https:" &&
        apiUrl.pathname === "/api" && hubUrl.pathname === "/hubs/auction" &&
        apiUrl.origin === hubUrl.origin && !apiUrl.search && !hubUrl.search &&
        !apiUrl.hash && !hubUrl.hash && !apiUrl.username && !hubUrl.username;
    } catch { /* Fail the build with the actionable message below. */ }
    if (!valid) throw new Error("Set VITE_API_URL=https://YOUR-BACKEND/api and VITE_SIGNALR_URL=https://YOUR-BACKEND/hubs/auction before building.");
  }
  return {
    server: { host: "::", port: 5173 },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  };
});
