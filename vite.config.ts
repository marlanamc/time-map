import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  // publicDir: false, // Assets are handled via Vite's asset system - REMOVED to allow PWA assets (manifest) to copy

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        // Use ESM format for import.meta.env to work correctly
        format: "es",
        // Ensure consistent file names for caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase/supabase-js")) return "supabase";
            return "vendor";
          }
          if (id.includes("/src/components/dayView/")) return "day-view";
          if (id.includes("/src/garden/")) return "garden";
          if (id.includes("/src/features/NDSupport")) return "nd-support";
          if (id.includes("/src/features/ZenFocus")) return "zen-focus";
          if (id.includes("/src/features/QuickAdd")) return "quick-add";
          if (id.includes("/src/features/AppSettings")) return "app-settings";
          if (id.includes("/src/features/")) return "features";
          return undefined;
        },
      },
    },
    // Generate source maps for easier debugging
    sourcemap: true,
    // Minify for production
    minify: "esbuild",
    // Target modern browsers
    target: "es2020",
  },

  server: {
    port: 4173,
    open: true, // Auto-open browser
    // Disable service worker in dev
    headers: {
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  },

  preview: {
    port: 4173,
  },

  // Handle CSS
  css: {
    devSourcemap: true,
  },

  // Resolve TypeScript paths
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@styles": resolve(__dirname, "styles"),
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ["@supabase/supabase-js", "idb"],
  },
});
