// GitHub Pages serves one static index.html for the whole SPA, so link
// previews (iMessage, Slack, etc. don't run JS) always show the portfolio's
// title and image. This writes real HTML entry points for the Drunkopoly
// routes with their own title, favicon and share image. The React app still
// boots from them exactly as it does from index.html.
const fs = require('fs');
const path = require('path');

const SITE = 'https://nathanham.tech';
const docsDir = path.resolve(__dirname, '..', 'docs');
const indexFile = path.join(docsDir, 'index.html');

const IMAGE = `${SITE}/drunkopoly/share.jpg`;
const DESCRIPTION = 'The drinking board game. Roll, buy, drink.';

const PAGES = [
  { route: 'drunk/drunkopoly', title: 'Drunkopoly' },
  { route: 'drunk/drunkopoly/rules', title: 'Drunkopoly · Rules' },
  { route: 'drunk/drunkopoly/messages', title: 'Drunkopoly · Messages' },
  { route: 'drunk/drunkopoly/player', title: 'Drunkopoly · Player Stats' },
];

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function headFor({ route, title }) {
  const url = `${SITE}/${route}/`;
  const t = escape(title);
  const d = escape(DESCRIPTION);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="theme-color" content="#000000" />`,
    `<link rel="icon" type="image/png" href="/drunkopoly/favicon.png" />`,
    `<link rel="apple-touch-icon" href="/drunkopoly/apple-touch-icon.png" />`,
    `<meta property="og:site_name" content="Drunkopoly" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Drunkopoly mascot raising a beer" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${IMAGE}" />`,
  ].join('\n    ');
}

try {
  const base = fs.readFileSync(indexFile, 'utf8')
    // Drop every tag that identifies the portfolio so none can leak into a preview.
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+(?:name|property)="(?:description|author|theme-color|og:[^"]*|twitter:[^"]*)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>\s*/gi, '');

  for (const page of PAGES) {
    const html = base.replace('</head>', `  ${headFor(page)}\n  </head>`);
    const outDir = path.join(docsDir, page.route);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    console.log(`Wrote docs/${page.route}/index.html (Drunkopoly share preview)`);
  }
} catch (err) {
  console.error('Failed to write Drunkopoly share pages:', err);
  process.exit(1);
}
