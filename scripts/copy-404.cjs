const fs = require("fs");
const path = require("path");

const distDir = path.resolve(__dirname, "..", "dist");
const indexFile = path.join(distDir, "index.html");
const notFoundFile = path.join(distDir, "404.html");

try {
  if (!fs.existsSync(indexFile)) {
    console.error("Error: dist/index.html not found. Run the build first.");
    process.exit(1);
  }

  fs.copyFileSync(indexFile, notFoundFile);
  console.log("Wrote dist/404.html for GitHub Pages SPA fallback.");
} catch (err) {
  console.error("Failed to create 404.html:", err);
  process.exit(1);
}
