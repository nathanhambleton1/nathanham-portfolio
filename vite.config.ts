import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Serve the dev/public folder at /dev-static/* so it does not conflict
    // with the React app route at /dev. Use /dev-static for raw static assets.
    {
      name: 'serve-dev-public',
      configureServer(server: any) {
        const devPublic = path.resolve(__dirname, 'dev', 'public');
        server.middlewares.use((req: any, res: any, next: any) => {
          if (!req.url || !req.url.startsWith('/dev-static')) return next();
          // strip prefix
          let rel = req.url.replace(/^\/dev-static/, '') || '/';
          rel = rel.split('?')[0];
          const fp = path.join(devPublic, rel);
          let filePath = fp;
          try {
            const st = fs.statSync(filePath);
            if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
          } catch (e) {
            const fallback = path.join(devPublic, 'index.html');
            if (fs.existsSync(fallback)) {
              res.setHeader('content-type', 'text/html');
              fs.createReadStream(fallback).pipe(res);
              return;
            }
            return next();
          }
          const ext = path.extname(filePath).toLowerCase();
          const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
          res.setHeader('content-type', contentType);
          fs.createReadStream(filePath).pipe(res);
        });
      }
    },
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'docs',
  },
  // With a custom domain on GitHub Pages, the site is served at the domain root.
  // Use root base so assets resolve as /assets/* instead of /<repo>/*.
  base: '/',
}));
