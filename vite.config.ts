import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      enableRouteGeneration: true,
      routesDirectory: fileURLToPath(new URL('./src/routes', import.meta.url)),
      generatedRouteTree: fileURLToPath(new URL('./src/routeTree.gen.ts', import.meta.url)),
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
