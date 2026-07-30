const fs = require('fs');
const path = require('path');

const docsDir = path.resolve(__dirname, '..', 'docs');
const indexFile = path.join(docsDir, 'index.html');
const notFoundFile = path.join(docsDir, '404.html');

try {
  if (!fs.existsSync(indexFile)) {
    console.error('Error: docs/index.html not found. Make sure to run the build first.');
    process.exit(1);
  }

  const html = fs.readFileSync(indexFile, 'utf8');
  fs.writeFileSync(notFoundFile, html, 'utf8');
  console.log('Wrote docs/404.html -> created SPA fallback for GitHub Pages.');
} catch (err) {
  console.error('Failed to create 404.html:', err);
  process.exit(1);
}
