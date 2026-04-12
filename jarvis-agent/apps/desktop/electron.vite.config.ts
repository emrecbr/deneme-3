import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main"
    }
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs"
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: "out/renderer"
    }
  }
});
