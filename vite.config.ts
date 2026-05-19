import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const redirectAppBasePlugin = {
  name: "redirect-app-base",
  configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode?: number; setHeader: (name: string, value: string) => void; end: () => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      if (!req.url || !/^\/app(?:\?.*)?$/.test(req.url)) {
        next();
        return;
      }

      const query = req.url.slice("/app".length);
      res.statusCode = 302;
      res.setHeader("Location", `/app/${query}`);
      res.end();
    });
  },
};

export default defineConfig({
  plugins: [redirectAppBasePlugin, react()],
  base: "/app/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./src/test/setup.ts")],
  },
  build: {
    outDir: path.resolve(__dirname, "./dist"),
    emptyOutDir: true,
  },
});
