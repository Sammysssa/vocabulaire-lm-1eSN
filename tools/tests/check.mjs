// Vérifie l'app avant de publier : à lancer depuis la racine du projet.
//   npm install --no-save playwright && npx playwright install chromium   (une seule fois)
//   node tools/tests/check.mjs
// Le script sert le dossier en local, ouvre l'app dans Chromium (taille téléphone) et contrôle :
// - aucun fichier audio référencé ne manque ;
// - aucune erreur JavaScript, sur chaque écran principal ;
// - chaque exercice de grammaire et de conjugaison a une seule bonne réponse, des choix distincts
//   et aucun texte « undefined » ;
// - les phrases à traduire générées et les tableaux du conjugueur sont complets.
// Il s'arrête avec le code 1 au moindre problème.
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp4': 'audio/mp4', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const problems = [];
const fail = (...a) => { problems.push(a.join(' ')); };

// 1. Audio files referenced in the data.
const words = JSON.parse(await readFile(join(ROOT, 'words.json'), 'utf8'));
const grammar = JSON.parse(await readFile(join(ROOT, 'grammar.json'), 'utf8'));
const audio = new Set();
const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (typeof v === 'string' && v.startsWith('audio/')) audio.add(v); else walk(v); } };
walk(words); walk(grammar);
for (const a of audio) await access(join(ROOT, a)).catch(() => fail('audio manquant :', a));

// 2. The app in a headless browser.
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') || 'index.html';
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 760 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
page.on('pageerror', e => fail('erreur JS :', e.message));
// Expose the app internals to the test only (app.js stays unchanged on the site).
await page.route('**/app.js', async route => {
  const r = await route.fetch(); let body = await r.text();
  const i = body.lastIndexOf('})();');
  body = body.slice(0, i) + 'window.__T = { state, buildGrammarPool, trMixed, trCourse, conjVerbs, conjugate, presForm, blankItems };\n' + body.slice(i);
  await route.fulfill({ response: r, body });
});
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__T && window.__T.state.loaded && window.__T.state.grammar, null, { timeout: 15000 });
// Close the "what's new" window shown at the first visit.
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelectorAll('#newFeature').forEach(e => e.remove()));

const res = await page.evaluate(() => {
  const T = window.__T; const out = [];
  const lessons = T.state.grammar.lessons.map(l => l.id).concat(['sec:grammaire', 'sec:conjugaison']);
  let n = 0;
  for (const L of lessons) for (const num of (L === 'passe' ? ['s', 'd', 'p', 'all'] : ['all'])) for (let rep = 0; rep < 3; rep++){
    const { rules, app } = T.buildGrammarPool(L, { num });
    for (const q of rules.concat(app)){
      n++;
      const texts = q.choices.map(c => c.text);
      if (q.choices.filter(c => c.ok).length !== 1) out.push(`${L} ${q.kind} ${q.key} : pas exactement une bonne réponse`);
      if (new Set(texts).size !== texts.length) out.push(`${L} ${q.kind} ${q.key} : choix en double ${JSON.stringify(texts)}`);
      if (texts.some(t => !t || /undefined|null|NaN/.test(t)) || /undefined|null/.test(q.prompt + (q.why || '') + JSON.stringify(q.reveal || {}))) out.push(`${L} ${q.kind} ${q.key} : texte vide ou undefined`);
    }
  }
  const mixed = []; for (let i = 0; i < 30; i++) mixed.push(...T.trMixed(10));
  mixed.filter(m => !m.fr || !m.ar || /undefined|null|NaN/.test(JSON.stringify(m))).slice(0, 5).forEach(m => out.push('traduction incomplète : ' + JSON.stringify(m)));
  if (!T.trCourse().length) out.push('aucune phrase du cours à traduire');
  return { out, n, mixed: mixed.length, verbs: T.conjVerbs().map(v => v.id) };
});
res.out.forEach(p => fail(p));

// 3. Every screen renders without error.
const clickIf = async sel => { const el = await page.$(sel); if (el) await el.click(); return !!el; };
const viewHasUndefined = async where => { const t = await page.textContent('#view'); if (/undefined|NaN/.test(t)) fail('« undefined » affiché :', where); };
for (const tab of ['review', 'list', 'grammar', 'reader', 'stats']){ await page.click(`.tabs button[data-tab="${tab}"]`); await viewHasUndefined('onglet ' + tab); }
await page.click('.tabs button[data-tab="grammar"]');
await clickIf('[data-action="opt"][data-name="gsection"][data-value="conjugaison"]');
for (const id of res.verbs){
  await page.click(`[data-action="conj-verb"][data-id="${id}"]`); await viewHasUndefined('conjugueur ' + id);
  await page.click('[data-action="conj-back"]');
}
for (const l of grammar.lessons){
  await page.click(`.tabs button[data-tab="grammar"]`);
  await clickIf(`[data-action="opt"][data-name="gsection"][data-value="${l.section === 'conjugaison' ? 'conjugaison' : 'grammaire'}"]`);
  await page.click(`[data-action="lesson"][data-id="${l.id}"]`); await viewHasUndefined('leçon ' + l.id);
  await page.click('[data-action="lesson-back"]');
}
await page.click('.tabs button[data-tab="reader"]');
await page.click('[data-action="practice"][data-value="traduction"]');
await page.click('[data-action="tr-start"]'); await page.click('[data-action="tr-reveal"]'); await viewHasUndefined('traduction');
await page.click('[data-action="quit"]');
await page.click('.tabs button[data-tab="reader"]');
await page.click('[data-action="practice"][data-value="feuille"]');
await page.click('[data-action="blank-start"]'); await page.click('[data-action="blank-check"]'); await page.click('[data-action="blank-done"]'); await viewHasUndefined('feuille blanche');

await browser.close(); server.close();
console.log(`${audio.size} fichiers audio, ${res.n} questions, ${res.mixed} phrases générées, ${res.verbs.length} verbes vérifiés.`);
if (problems.length){ console.log(problems.length + ' problème(s) :'); problems.slice(0, 40).forEach(p => console.log(' - ' + p)); process.exit(1); }
console.log('Tout est bon.');
