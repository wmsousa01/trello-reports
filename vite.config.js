// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(() => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Tudo que começar com /api vai para o vercel dev (serverless)
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,            // caso use websockets no futuro
        // sem rewrite: mantém o prefixo /api
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
}));
