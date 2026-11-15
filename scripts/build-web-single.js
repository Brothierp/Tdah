// Assemble l'export web d'Expo en une page autonome (JS et images intégrés), à partager comme lien de test.
// Usage : npm run build:web-single  ->  dist-single/focus.html
const fs = require('fs');
const path = require('path');
const [, , exportDir, outFile] = process.argv;
const jsDir = path.join(exportDir, '_expo/static/js/web');
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
if (files.length !== 1) throw new Error('Un seul bundle attendu, trouvé : ' + files.join(', '));
let js = fs.readFileSync(path.join(jsDir, files[0]), 'utf8');

// Images : "/assets/…png" -> data URI.
let replaced = 0;
js = js.replace(/"(\/assets\/[^"]+\.png)"/g, (m, p) => {
  const file = path.join(exportDir, p);
  if (!fs.existsSync(file)) return m;
  replaced++;
  return JSON.stringify('data:image/png;base64,' + fs.readFileSync(file).toString('base64'));
});
const leftovers = js.match(/"\/(assets|_expo)\/[^"]*"/g) || [];
js = js.replace(/<\/script/gi, '<\\/script');

const html = `<title>Focus</title>
<meta name="description" content="Focus : tâches, timer et rappels pour les personnes TDAH et TSA.">
<style>
  :root { --bg: #F8F7FB; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #1D1C26; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #1D1C26; color-scheme: dark; }
  html { box-sizing: border-box; height: 100%; }
  body { height: 100%; overflow: hidden; background: var(--bg); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>Active JavaScript pour utiliser Focus.</noscript>
<div id="root"></div>
<script>
  // Lien de test « …#reinitialiser » : efface les données de Focus sur cet appareil et repart de zéro.
  try {
    if (location.hash === '#reinitialiser') {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('focus:') || k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch (e) {}
</script>
<script>${js}</script>
`;
fs.writeFileSync(outFile, html);
console.log(JSON.stringify({ bytes: html.length, images: replaced, leftovers: leftovers.slice(0, 5) }));
