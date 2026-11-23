// Builds the viewer into dist/: index.html and the code in assets/ (three.js in its own chunk,
// loaded with the 3D mode). The scenarios come from the server (app/server/server.mjs): in
// development, Vite forwards /api and /files to it (API_URL, http://127.0.0.1:8787 by default).
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const api = process.env.API_URL || "http://127.0.0.1:8787"

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: { reportCompressedSize: false, chunkSizeWarningLimit: 800 }, // the 3D chunk is mostly three.js
  server: { proxy: { "/api": api, "/files": api } },
})
