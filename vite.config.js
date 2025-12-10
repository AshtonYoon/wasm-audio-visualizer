import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: "./",
  publicDir: "public",
  base: process.env.GITHUB_PAGES ? "/wasm-audio-visualizer/" : "/",
  server: {
    port: 8000,
    headers: {
      // Required for SharedArrayBuffer (pthread support)
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "pure-js-fft": path.resolve(__dirname, "pure-js-fft.html"),
      },
      output: {
        // Ensure Service Worker is not hashed
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "coi-serviceworker.js") {
            return "coi-serviceworker.js";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  preview: {
    port: 4173,
    // Support GitHub Pages path in preview mode
    ...(process.env.GITHUB_PAGES && {
      base: "/wasm-audio-visualizer/",
    }),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
