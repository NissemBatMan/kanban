import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Served from https://nissembatman.github.io/kanban/ on GitHub Pages.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
