import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const port = Number(process.env.PORT ?? 5173);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    // Outside Replit the API runs on 8080; on Replit the path router sends /api there directly.
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
});
