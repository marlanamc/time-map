import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: false, // Assets are handled via Vite's asset system
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Ensure consistent file names for caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Generate source maps for easier debugging
    sourcemap: true,
    // Minify for production
    minify: 'esbuild',
    // Target modern browsers
    target: 'es2020',
  },
  
  server: {
    port: 4173,
    open: true, // Auto-open browser
    // Disable service worker in dev
    headers: {
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
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
      '@': resolve(__dirname, 'src'),
      '@styles': resolve(__dirname, 'styles'),
    },
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['@supabase/supabase-js', 'idb'],
  },
});

