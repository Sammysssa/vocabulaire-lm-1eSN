/* Vocabulaire arabe — application de révision.
   Le vocabulaire vient de words.json ; la progression de chaque élève reste dans son navigateur. */
(function(){
'use strict';

const APP_VERSION = '1.5.2';
const DAY = 86400000;
const DIRS = ['arfr', 'frar'];
const DIR_LABEL = { arfr: 'Arabe → français', frar: 'Français → arabe' };
const LS = 'vocab-arabe-';
const K_PROGRESS = LS + 'progress-v1';
const K_HISTORY = LS + 'history-v1';
const K_WORDS = LS + 'words-cache-v1';
const K_UID = LS + 'uid';
const K_RESET = LS + 'reset-at';
const K_PUSH = LS + 'push-token';
const FONTS = [
  { id: 'scheherazade', name: 'Scheherazade', family: "'Scheherazade New'", desc: 'Lettres bien espacées, voyelles très lisibles' },
  { id: 'noto', name: 'Noto Naskh', family: "'Noto Naskh Arabic'", desc: 'Sobre et régulière' },
  { id: 'amiri', name: 'Amiri', family: "'Amiri'", desc: 'Calligraphique, lettres plus serrées' }
];
const LEVELS = [
  { id: 'new', label: 'Nouveaux' }, { id: 'learning', label: 'En cours' },
  { id: 'known', label: 'Acquis' }, { id: 'mastered', label: 'Maîtrisés' }
];
const ICON = {
  speaker: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  flip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>',
  chevron: '<svg class="chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
};

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function plural(n, one, many){ return n + ' ' + (n > 1 ? many : one); }
function startOfDay(t){ const d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); }
function addDays(t, n){ const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
function daysBetween(a, b){ return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }
function dayKey(t){ const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fmtShort(t){ return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
function fmtLong(t){ return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }
function fmtWeekday(t){ return new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); }
function fmtIvl(days){
  if (days <= 0) return 'maintenant';
  if (days < 31) return days + ' j';
  if (days < 365) return Math.round(days / 30) + ' mois';
  const y = Math.round(days / 365 * 10) / 10;
  return String(y).replace('.', ',') + (y >= 2 ? ' ans' : ' an');
}
function fmtDay(t){
  const n = daysBetween(Date.now(), t);
  if (n <= 0) return t > Date.now() ? 'plus tard aujourd’hui' : 'aujourd’hui';
  if (n === 1) return 'demain';
  if (n < 7) return 'dans ' + n + ' jours (' + fmtShort(t) + ')';
  return 'le ' + fmtLong(t);
}
function norm(s){
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا');
}
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); return true; } catch(e){ return false; } }
function lsJson(k, def){ try { const v = JSON.parse(lsGet(k)); return v && typeof v === 'object' ? Object.assign({}, def, v) : Object.assign({}, def); } catch(e){ return Object.assign({}, def); } }
function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newId(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function scrollTop(){ window.scrollTo(0, 0); }
const isTouch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

let toastTimer = null;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- state ---------- */
const state = {
  words: [], history: [], loaded: false, tab: 'review',
  dir: lsGet(LS + 'dir') || 'both', scope: 'all',
  session: null, setup: null, settings: false, detailId: null, search: '',
  banner: '', confirmReset: false,
  browseOpts: lsJson(LS + 'browse', { order: 'order', faces: 'one' }),
  examOpts: lsJson(LS + 'exam', { format: 'qcm', count: 10 }),
  font: lsGet(LS + 'font') || 'scheherazade',
  arSize: lsGet(LS + 'size') || 'normal',
  installDismissed: lsGet(LS + 'install-dismissed') === '1',
  accountDismissed: lsGet(LS + 'account-dismissed') === '1',
  grammar: null, grammarError: '', lessonId: null,
  grammarOpts: lsJson(LS + 'gopts', { lesson: 'all', count: 10 })
};
if (!['arfr', 'frar', 'both'].includes(state.dir)) state.dir = 'both';

function applyLook(){
  const f = FONTS.find(x => x.id === state.font) || FONTS[0];
  document.documentElement.style.setProperty('--arabic-font', f.family);
  document.documentElement.style.setProperty('--ar-scale', state.arSize === 'large' ? '1.2' : '1');
}
applyLook();

/* ---------- storage (this device only) ---------- */
let storageWarned = false;
function storageFailed(){
  if (storageWarned) return;
  storageWarned = true;
  toast('Ta progression ne peut pas être enregistrée sur cet appareil (navigation privée ?).');
}
const Store = {
  base: [], progress: {}, history: [], meta: null,
  loadLocal(){
    try { const p = JSON.parse(lsGet(K_PROGRESS) || '{}'); this.progress = p && typeof p === 'object' && !Array.isArray(p) ? p : {}; }
    catch(e){ this.progress = {}; }
    try { const h = JSON.parse(lsGet(K_HISTORY) || '[]'); this.history = Array.isArray(h) ? h.filter(x => x && x.id) : []; }
    catch(e){ this.history = []; }
    state.history = this.history.slice();
  },
  async loadWords(){
    let data = null;
    try {
      const r = await fetch('words.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
      lsSet(K_WORDS, JSON.stringify(data));
    } catch(e){
      try { data = JSON.parse(lsGet(K_WORDS) || 'null'); } catch(e2){ data = null; }
      if (!data) state.banner = 'Impossible de charger le vocabulaire. Vérifie ta connexion puis recharge la page.';
    }
    const list = data && Array.isArray(data.words) ? data.words : [];
    const seen = new Set();
    this.meta = data ? { updated: data.updated || '' } : null;
    this.base = list.filter(w => w && w.id && w.ar && w.fr && !seen.has(w.id) && seen.add(w.id)).map((w, i) => ({
      id: String(w.id), ar: String(w.ar), fr: String(w.fr),
      root: w.root || '', plural: w.plural || '', example: w.example || '', note: w.note || '',
      week: Number(w.week) || 1, audio: w.audio || '', createdAt: i,
      type: w.type || '', pc: w.pc || null, fr_plural: w.fr_plural || ''
    }));
    this.rebuild();
    await loadGrammar();
  },
  rebuild(){ state.words = this.base.map(w => Object.assign({}, w, { srs: this.progress[w.id] || null })); },
  saveProgress(){ if (!lsSet(K_PROGRESS, JSON.stringify(this.progress))) storageFailed(); },
  saveHistory(){
    const cutoff = Date.now() - 400 * DAY;
    this.history = this.history.filter(h => (h.at || 0) >= cutoff).slice(-1500);
    if (!lsSet(K_HISTORY, JSON.stringify(this.history))) storageFailed();
    state.history = this.history.slice();
  },
  setSrs(id, dir, s){
    const cur = Object.assign({}, this.progress[id] || {});
    cur[dir] = s; this.progress[id] = cur;
    this.saveProgress(); this.rebuild();
    Cloud.queue({ [id]: { [dir]: s } });
  },
  putHistory(id, rec){
    const doc = Object.assign({ id }, rec);
    const i = this.history.findIndex(h => h.id === id);
    if (i >= 0) this.history[i] = doc; else this.history.push(doc);
    this.saveHistory();
    Cloud.session(id, doc);
    scheduleLeaderboard();
  },
  merge(data){
    let words = 0;
    const prog = data.progress && typeof data.progress === 'object' ? data.progress : {};
    for (const id of Object.keys(prog)){
      const imp = prog[id]; if (!imp || typeof imp !== 'object') continue;
      const cur = Object.assign({}, this.progress[id] || {});
      let changed = false;
      for (const d of DIRS){
        const s = imp[d];
        if (s && typeof s === 'object' && typeof s.due === 'number' && (!cur[d] || (s.last || 0) > (cur[d].last || 0))){ cur[d] = s; changed = true; }
      }
      if (changed){ this.progress[id] = cur; words++; }
    }
    const hist = Array.isArray(data.history) ? data.history : [];
    const ids = new Set(this.history.map(h => h.id));
    for (const h of hist){ if (h && h.id && !ids.has(h.id)){ this.history.push(h); ids.add(h.id); } }
    this.history.sort((a, b) => (a.at || 0) - (b.at || 0));
    this.saveProgress(); this.saveHistory(); this.rebuild();
    Cloud.pushAll();
    return words;
  },
  reset(){
    this.progress = {}; this.history = [];
    this.saveProgress(); this.saveHistory(); this.rebuild();
    Cloud.reset();
  }
};


/* ---------- online sync (optional, see cloud.js) ---------- */
function validState(s){ return !!(s && typeof s === 'object' && typeof s.due === 'number'); }
/* Keeps, for every word and direction, the most recently reviewed state.
   "upload" lists the local states that are newer than the remote ones. */
function mergeProgress(local, remote){
  const merged = {}, upload = {};
  const ids = new Set(Object.keys(local || {}).concat(Object.keys(remote || {})));
  for (const id of ids){
    const l = (local && local[id]) || {}, r = (remote && remote[id]) || {};
    const out = {};
    for (const d of DIRS){
      const ls = validState(l[d]) ? l[d] : null, rs = validState(r[d]) ? r[d] : null;
      if (ls && (!rs || (ls.last || 0) > (rs.last || 0))){ out[d] = ls; (upload[id] = upload[id] || {})[d] = ls; }
      else if (rs) out[d] = rs;
    }
    if (Object.keys(out).length) merged[id] = out;
  }
  return { merged, upload };
}
const AUTH_ERRORS = {
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/missing-email': 'Indique ton adresse e-mail.',
  'auth/missing-password': 'Indique ton mot de passe.',
  'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail : crée-en un.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
  'auth/popup-blocked': 'La fenêtre de connexion Google a été bloquée. Réessaie, ou utilise ton e-mail.',
  'auth/popup-closed-by-user': 'La fenêtre de connexion Google a été fermée. Réessaie, ou utilise ton e-mail.',
  'auth/cancelled-popup-request': 'La connexion Google a été interrompue. Réessaie.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'auth/too-many-requests': 'Trop de tentatives. Réessaie dans quelques minutes.',
  'auth/unauthorized-domain': 'Ce site n’est pas encore autorisé pour la connexion.',
  'auth/operation-not-allowed': 'Ce mode de connexion n’est pas activé.',
  'permission-denied': 'La sauvegarde en ligne a été refusée par le serveur.'
};
function authMessage(e){ const code = e && e.code; return AUTH_ERRORS[code] || 'Connexion impossible' + (code ? ' (' + code + ')' : '') + '.'; }

const Cloud = {
  status: 'loading', user: null, synced: false, linked: false, sessionsLinked: false, replace: false, notif: null, profile: null,
  pending: {}, timer: null, email: '', error: '',
  api(){ return window.VocabCloud || null; },
  onEvent(d){
    if (d.type === 'disabled') this.status = 'disabled';
    else if (d.type === 'unavailable') this.status = 'unavailable';
    else if (d.type === 'ready'){ this.status = 'ready'; detectPush(); }
    else if (d.type === 'user') this.onUser(d.user);
    else if (d.type === 'progress'){ this.notif = d.notif || null; this.profile = d.profile || null; this.profileLoaded = true; ensureLbProfile(); return this.onProgress(d.progress || {}, Number(d.resetAt) || 0); }
    else if (d.type === 'sessions') return this.onSessions(d.sessions || []);
    else if (d.type === 'error') this.error = authMessage(d);
    refreshCloudUi();
  },
  onUser(user){
    this.user = user; this.linked = false; this.sessionsLinked = false; this.synced = false; this.notif = null; this.profile = null; this.profileLoaded = false; Push.refreshed = false; LB.list = null;
    if (user){
      const last = lsGet(K_UID);
      this.replace = !!(last && last !== user.uid);
      this.error = '';
    }
  },
  applyReset(resetAt){
    const seen = Number(lsGet(K_RESET)) || 0;
    if (!resetAt || resetAt <= seen) return;
    for (const id of Object.keys(Store.progress)){
      const cur = Store.progress[id], out = {};
      for (const d of DIRS) if (cur[d] && (cur[d].last || 0) > resetAt) out[d] = cur[d];
      if (Object.keys(out).length) Store.progress[id] = out; else delete Store.progress[id];
    }
    Store.history = Store.history.filter(h => (h.at || 0) > resetAt);
    lsSet(K_RESET, String(resetAt));
  },
  onProgress(remote, resetAt){
    if (!this.user) return;
    if (!this.linked){
      this.linked = true;
      if (this.replace){
        Store.progress = mergeProgress({}, remote).merged;
        lsSet(K_RESET, String(resetAt || 0));
      } else {
        this.applyReset(resetAt);
        const { merged, upload } = mergeProgress(Store.progress, remote);
        Store.progress = merged;
        if (Object.keys(upload).length) this.push(upload);
      }
      lsSet(K_UID, this.user.uid);
    } else {
      this.applyReset(resetAt);
      Store.progress = mergeProgress(Store.progress, remote).merged;
    }
    this.synced = true;
    Store.saveProgress(); Store.rebuild();
    refreshPushToken();
    softRefresh(); refreshCloudUi();
  },
  onSessions(remote){
    if (!this.user) return;
    if (!this.sessionsLinked){
      this.sessionsLinked = true;
      if (this.replace) Store.history = [];
      else {
        const remoteIds = new Set(remote.map(r => r.id));
        const missing = Store.history.filter(h => !remoteIds.has(h.id));
        const api = this.api();
        if (api && missing.length) api.pushSessions(missing).catch(() => {});
      }
    }
    const ids = new Set(Store.history.map(h => h.id));
    for (const r of remote){ if (r && r.id && !ids.has(r.id)){ Store.history.push(r); ids.add(r.id); } }
    Store.history.sort((a, b) => (a.at || 0) - (b.at || 0));
    Store.saveHistory();
    scheduleLeaderboard();
    softRefresh();
  },
  queue(patch){
    if (!this.user) return;
    for (const id of Object.keys(patch)) this.pending[id] = Object.assign(this.pending[id] || {}, patch[id]);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1500);
  },
  flush(){
    clearTimeout(this.timer);
    const api = this.api(); if (!api || !this.user) return;
    const patch = this.pending; this.pending = {};
    if (!Object.keys(patch).length) return;
    api.pushProgress(patch).catch(e => { this.error = authMessage(e); refreshCloudUi(); });
  },
  push(patch){ this.queue(patch); this.flush(); },
  session(id, rec){ const api = this.api(); if (api && this.user) api.pushSession(id, rec).catch(() => {}); },
  pushAll(){
    const api = this.api(); if (!api || !this.user) return;
    this.push(Store.progress);
    api.pushSessions(Store.history.slice()).catch(() => {});
  },
  reset(){
    const api = this.api(); if (!api || !this.user) return;
    api.resetAll().then(at => { if (at) lsSet(K_RESET, String(at)); }).catch(e => { this.error = authMessage(e); refreshCloudUi(); });
  }
};
window.addEventListener('vocab-cloud', e => Cloud.onEvent(e.detail || {}));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Cloud.flush(); });

function softRefresh(){
  if (!state.loaded || state.session || state.settings || state.setup) return;
  if (state.detailId) return renderDetail();
  if (state.lessonId) return;
  if (state.tab === 'list'){ if ($('#listItems')) renderListItems(); return; }
  render();
}
function refreshCloudUi(){
  const box = $('#accountBox');
  if (box){ box.innerHTML = accountHtml(); const nb = $('#notifBox'); if (nb) nb.innerHTML = notifHtml(); return; }
  if (state.loaded && !state.session && !state.settings && !state.setup && !state.detailId && state.tab === 'review') renderReview();
}
function accountHtml(){
  const c = Cloud;
  if (c.status === 'disabled') return '';
  let body;
  if (c.user){
    body = '<div class="track"><ul>' +
      '<li><span>Connecté</span><span>' + esc(c.user.email || c.user.name || 'compte Google') + '</span></li>' +
      '<li><span>Sauvegarde</span><span>' + (c.synced ? 'à jour' : 'en cours…') + '</span></li></ul></div>' +
      '<p class="hint">Ta progression est sauvegardée en ligne : tu la retrouves sur tous les appareils où tu te connectes, même hors connexion ensuite.</p>' +
      '<button type="button" class="btn ghost big" data-action="auth-signout">Se déconnecter</button>' +
      lbSettingsHtml();
  } else if (c.status === 'loading'){
    body = '<p class="hint">Connexion au service de sauvegarde…</p>';
  } else if (c.status === 'unavailable'){
    body = '<p class="hint">La sauvegarde en ligne n’est pas disponible pour le moment (pas de connexion ?). Ta progression reste enregistrée sur cet appareil.</p>';
  } else {
    body = '<p class="hint">Connecte-toi pour sauvegarder ta progression en ligne et la retrouver sur tous tes appareils. Sans compte, elle reste seulement sur cet appareil.</p>' +
      '<button type="button" class="btn primary big" data-action="auth-google">Continuer avec Google</button>' +
      '<p class="or">ou avec ton e-mail</p>' +
      '<form id="authForm" class="stack-sm" novalidate>' +
        '<label class="sr" for="authEmail">E-mail</label>' +
        '<input id="authEmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="E-mail" value="' + esc(c.email) + '">' +
        '<label class="sr" for="authPass">Mot de passe</label>' +
        '<input id="authPass" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères minimum)">' +
        '<div class="two"><button type="submit" class="btn ghost big">Se connecter</button>' +
        '<button type="button" class="btn ghost big" data-action="auth-signup">Créer un compte</button></div>' +
        '<button type="button" class="btn text" data-action="auth-reset">Mot de passe oublié ?</button>' +
      '</form>';
  }
  return '<span class="label">Compte et sauvegarde en ligne</span>' + body +
    '<p class="err" id="authMsg"' + (c.error ? '' : ' hidden') + '>' + esc(c.error) + '</p>';
}
function authNote(msg, ok){
  const el = $('#authMsg'); if (!el) return;
  el.textContent = msg; el.hidden = !msg; el.classList.toggle('ok', !!ok);
}
async function authAction(kind){
  const api = Cloud.api();
  if (!api){ authNote('Le service de connexion n’est pas encore prêt. Réessaie dans un instant.'); return; }
  const email = (($('#authEmail') || {}).value || '').trim();
  const pass = ($('#authPass') || {}).value || '';
  Cloud.email = email; Cloud.error = '';
  const buttons = document.querySelectorAll('#accountBox button');
  buttons.forEach(b => { b.disabled = true; });
  try {
    if (kind === 'google') await api.signInGoogle();
    else if (kind === 'signin'){ if (!email || !pass) throw { code: !email ? 'auth/missing-email' : 'auth/missing-password' }; await api.signInEmail(email, pass); }
    else if (kind === 'signup'){ if (!email) throw { code: 'auth/missing-email' }; if (pass.length < 6) throw { code: 'auth/weak-password' }; await api.signUpEmail(email, pass); }
    else if (kind === 'reset'){
      if (!email) throw { code: 'auth/missing-email' };
      await api.resetPassword(email);
      authNote('Un e-mail pour choisir un nouveau mot de passe a été envoyé à ' + email + '.', true);
    }
  } catch(e){
    authNote(authMessage(e));
  } finally {
    buttons.forEach(b => { if (document.contains(b)) b.disabled = false; });
  }
}
function accountHint(){
  if (Cloud.status !== 'ready' || Cloud.user || state.accountDismissed) return '';
  return '<div class="install"><p>Crée un compte pour sauvegarder ta progression en ligne et la retrouver sur tous tes appareils.</p><div class="row-actions">' +
    '<button type="button" class="btn primary" data-action="go-account">Me connecter</button>' +
    '<button type="button" class="btn text" data-action="dismiss-account">Plus tard</button></div></div>';
}


/* ---------- review reminders (web push, see cloud.js and tools/send-reminders.mjs) ---------- */
const Push = { support: 'checking', refreshed: false, busy: false };
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
async function detectPush(){
  if (isIOS() && !isStandalone()){ Push.support = 'ios-install'; refreshCloudUi(); return; }
  const api = Cloud.api();
  if (!api){ Push.support = 'unsupported'; refreshCloudUi(); return; }
  try { Push.support = await api.notifSupport(); } catch(e){ Push.support = 'unsupported'; }
  refreshCloudUi();
}
function deviceToken(){ return lsGet(K_PUSH) || ''; }
function pushOn(){
  const t = deviceToken(); const n = Cloud.notif || {};
  return !!(t && n.tokens && n.tokens[t] && typeof Notification !== 'undefined' && Notification.permission === 'granted');
}
function reminderHour(){ const h = Number((Cloud.notif || {}).hour); return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 19; }
function refreshPushToken(){
  if (Push.refreshed || !Cloud.user || !deviceToken() || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  Push.refreshed = true;
  const api = Cloud.api(); if (!api) return;
  api.refreshNotifications(deviceToken()).then(t => { if (t) lsSet(K_PUSH, t); }).catch(() => {});
}
function notifHtml(){
  if (Cloud.status === 'disabled') return '';
  const head = '<span class="label">Rappels de révision</span>';
  if (!Cloud.user) return head + '<p class="hint">Connecte-toi pour recevoir un rappel quand des cartes t’attendent.</p>';
  if (Push.support === 'checking') return head + '<p class="hint">Vérification…</p>';
  if (Push.support === 'ios-install') return head + '<p class="hint">Sur iPhone, installe d’abord l’app sur l’écran d’accueil (bouton Partager, puis « Sur l’écran d’accueil »), puis ouvre-la depuis son icône pour activer les rappels.</p>';
  if (Push.support !== 'ok') return head + '<p class="hint">Ce navigateur ne permet pas de recevoir des notifications.</p>';
  if (Notification.permission === 'denied') return head + '<p class="hint">Les notifications sont bloquées pour cette app. Autorise-les dans les réglages du navigateur ou du téléphone, puis reviens ici.</p>';
  const on = pushOn(), hour = reminderHour();
  let options = '';
  for (let h = 7; h <= 22; h++) options += '<option value="' + h + '"' + (h === hour ? ' selected' : '') + '>' + h + ' h</option>';
  return head +
    '<p class="hint">' + (on
      ? 'Tu reçois un rappel chaque jour vers ' + hour + ' h, seulement s’il y a des cartes à réviser. Il peut arriver avec quelques minutes de retard.'
      : 'Reçois une notification chaque jour à l’heure de ton choix, seulement s’il y a des cartes à réviser.') + '</p>' +
    '<label class="field"><span class="label">Heure du rappel</span><select id="notifHour">' + options + '</select></label>' +
    (on ? '<button type="button" class="btn ghost big" data-action="notif-off">Désactiver les rappels sur cet appareil</button>'
        : '<button type="button" class="btn primary big" data-action="notif-on">Activer les rappels</button>') +
    '<p class="err" id="notifMsg" hidden></p>';
}
function notifNote(msg, ok){ const el = $('#notifMsg'); if (!el) { if (msg) toast(msg); return; } el.textContent = msg; el.hidden = !msg; el.classList.toggle('ok', !!ok); }
function reminderSettings(hour){
  const s = { hour, dirs: state.dir, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Paris' };
  /* Activated after today's reminder time: start tomorrow. */
  if (new Date().getHours() >= hour) s.lastSent = dayKey(Date.now());
  return s;
}
function enableReminders(){
  const api = Cloud.api(); if (!api || Push.busy) return;
  const hour = Number(($('#notifHour') || {}).value) || reminderHour();
  let asked;
  try { asked = Notification.requestPermission(); } catch(e){ asked = Promise.resolve(Notification.permission); }
  Push.busy = true;
  Promise.resolve(asked).then(perm => {
    if (perm !== 'granted'){ Push.busy = false; refreshCloudUi(); notifNote('Autorisation refusée : les rappels ne peuvent pas être activés.'); return; }
    notifNote('Activation…', true);
    return api.enableNotifications(reminderSettings(hour)).then(token => {
      lsSet(K_PUSH, token); Push.busy = false;
      Cloud.notif = Object.assign({}, Cloud.notif, { enabled: true, hour, tokens: Object.assign({}, (Cloud.notif || {}).tokens, { [token]: {} }) });
      refreshCloudUi(); toast('Rappels activés, chaque jour vers ' + hour + ' h');
    });
  }).catch(e => { Push.busy = false; refreshCloudUi(); notifNote('Impossible d’activer les rappels' + (e && e.code ? ' (' + e.code + ')' : '') + '.'); });
}
function disableReminders(){
  const api = Cloud.api(); if (!api) return;
  const token = deviceToken();
  api.disableNotifications(token).catch(() => {}).finally(() => {
    lsSet(K_PUSH, '');
    if (Cloud.notif && Cloud.notif.tokens && token){ const t = Object.assign({}, Cloud.notif.tokens); delete t[token]; Cloud.notif = Object.assign({}, Cloud.notif, { tokens: t }); }
    refreshCloudUi(); toast('Rappels désactivés sur cet appareil');
  });
}
function changeReminderHour(hour){
  if (!pushOn()) return;
  const api = Cloud.api(); if (!api) return;
  const s = { hour };
  if (new Date().getHours() < hour && (Cloud.notif || {}).lastSent === dayKey(Date.now())) s.lastSent = '';
  api.updateNotifSettings(s).then(() => toast('Rappel chaque jour vers ' + hour + ' h')).catch(() => {});
}

/* ---------- class leaderboard ---------- */
function recPoints(h){
  if (h.type === 'review') return Math.max(0, (h.answers || 0) - (h.fails || 0));
  if (h.type === 'exam' || h.type === 'grammar') return (h.correct || 0) * 2;
  return 0;
}
function recSecs(h){
  if (typeof h.secs === 'number') return h.secs;
  if (h.type === 'review') return (h.answers || 0) * 8;
  if (h.type === 'browse') return (h.seen || 0) * 5;
  return (h.total || 0) * 10;
}
function weekKey(t){ const d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime()); }
function myLbStats(){
  const wk = weekKey(Date.now());
  let ws = 0, wp = 0, ts = 0, tp = 0;
  for (const h of Store.history){
    const sec = recSecs(h), pts = recPoints(h);
    ts += sec; tp += pts;
    if (h.at && weekKey(h.at) === wk){ ws += sec; wp += pts; }
  }
  return { week: wk, weekSecs: Math.min(604800, Math.round(ws)), weekPoints: Math.min(100000, wp), totalSecs: Math.round(ts), totalPoints: tp };
}
function fmtDuration(secs){
  secs = Math.round(secs || 0);
  if (secs < 60) return secs + ' s';
  const m = Math.round(secs / 60);
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
}
const LB = { list: null, at: 0, loading: false, error: '', timer: null,
  period: lsGet(LS + 'lb-period') || 'week', metric: lsGet(LS + 'lb-metric') || 'secs' };
/* Every signed-in student is in the leaderboard by default; leaving it is done in the settings. */
function defaultLbName(){
  const u = Cloud.user || {};
  let n = (u.name || '').trim().split(/\s+/)[0] || (u.email || '').split('@')[0].split(/[._\-0-9]+/).filter(Boolean)[0] || '';
  n = n.slice(0, 20);
  if (n.length < 2){ const id = String(u.uid || ''); let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 90; n = 'Élève ' + (h + 10); }
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function lbName(){ return (Cloud.profile && Cloud.profile.lbName) || defaultLbName(); }
function lbJoined(){ return !!(Cloud.user && Cloud.profileLoaded && !(Cloud.profile && Cloud.profile.lbOptIn === false)); }
function ensureLbProfile(){
  /* First time a signed-in student is seen: give them a pseudo and tell them once. */
  const api = Cloud.api();
  if (!api || !lbJoined() || (Cloud.profile && Cloud.profile.lbName)) return;
  const name = defaultLbName();
  Cloud.profile = Object.assign({}, Cloud.profile, { lbOptIn: true, lbName: name });
  api.saveProfile(Cloud.profile).then(() => {
    scheduleLeaderboard();
    toast('Tu apparais dans le classement sous le pseudo « ' + name + ' ». Tu peux le changer dans les réglages.');
  }).catch(() => {});
}
function scheduleLeaderboard(){
  if (!lbJoined()) return;
  clearTimeout(LB.timer);
  LB.timer = setTimeout(pushLeaderboard, 2500);
}
function pushLeaderboard(){
  clearTimeout(LB.timer);
  const api = Cloud.api();
  if (!api || !lbJoined()) return Promise.resolve();
  return api.saveLeaderboard(Object.assign({ name: lbName(), updatedAt: Date.now() }, myLbStats())).catch(() => {});
}
function loadLeaderboard(){
  const api = Cloud.api(); if (!api || LB.loading || !Cloud.user) return;
  LB.loading = true; LB.error = '';
  pushLeaderboard().then(() => api.fetchLeaderboard()).then(list => { LB.list = list; LB.at = Date.now(); })
    .catch(e => { LB.error = e && e.code === 'permission-denied' ? 'Le classement n’est pas encore ouvert sur le serveur.' : 'Impossible de charger le classement (pas de connexion ?).'; })
    .finally(() => { LB.loading = false; if (state.tab === 'stats' && !state.session && !state.settings) renderStats(); });
}
function lbSection(){
  if (Cloud.status === 'disabled') return '';
  const head = '<div class="section" id="lbBox"><h2 class="h2">Classement de la classe</h2>';
  if (!Cloud.user) return head + '<p class="hint">Connecte-toi pour apparaître dans le classement et te mesurer à ta classe.</p><button type="button" class="btn ghost big" data-action="go-account">Me connecter</button></div>';
  if (!Cloud.profileLoaded) return head + '<p class="hint">Chargement du classement…</p></div>';
  if (!LB.loading && (!LB.list || Date.now() - LB.at > 60000) && !LB.error) setTimeout(loadLeaderboard, 0);
  const wk = weekKey(Date.now()); const meId = (Cloud.api() && Cloud.api().myId()) || '';
  const key = (LB.period === 'week' ? 'week' : 'total') + (LB.metric === 'secs' ? 'Secs' : 'Points');
  const rows = (LB.list || []).map(e => ({ id: e.id, name: e.name || 'Élève', v: (LB.period === 'week' && e.week !== wk) ? 0 : (Number(e[key]) || 0) }))
    .filter(r => r.v > 0 || r.id === meId).sort((a, b) => b.v - a.v);
  const meIdx = rows.findIndex(r => r.id === meId);
  const shown = rows.slice(0, 10);
  const fmt = v => LB.metric === 'secs' ? fmtDuration(v) : v + ' pts';
  const medal = i => ['🥇', '🥈', '🥉'][i] || String(i + 1);
  const line = (r, i) => '<li class="' + (r.id === meId ? 'me' : '') + '"><span class="rk">' + medal(i) + '</span><span class="nm">' + esc(r.name) + (r.id === meId ? ' <em>(toi)</em>' : '') + '</span><b>' + fmt(r.v) + '</b></li>';
  let list;
  if (LB.error) list = '<p class="hint">' + esc(LB.error) + '</p><button type="button" class="btn small" data-action="lb-refresh">Réessayer</button>';
  else if (!LB.list) list = '<p class="hint">Chargement du classement…</p>';
  else if (!rows.length) list = '<p class="hint">Personne n’a encore révisé sur cette période. À toi de lancer la course !</p>';
  else list = '<ol class="lb-list">' + shown.map(line).join('') + (meIdx >= 10 ? '<li class="gap">…</li>' + line(rows[meIdx], meIdx) : '') + '</ol>';
  return head +
    '<div class="field"><span class="label sr" id="lbPeriodL">Période</span>' + seg('lbperiod', LB.period, [['week', 'Cette semaine'], ['total', 'Depuis le début']], 'lbPeriodL') + '</div>' +
    '<div class="field"><span class="label sr" id="lbMetricL">Critère</span>' + seg('lbmetric', LB.metric, [['secs', 'Temps de révision'], ['points', 'Points']], 'lbMetricL') + '</div>' +
    list +
    '<p class="hint">' + (LB.metric === 'points' ? '1 point par carte réussie en révision, 2 points par bonne réponse en examen et en grammaire. ' : 'Temps passé à réviser, faire défiler, passer des examens ou faire de la grammaire. ') + 'Le classement de la semaine repart à zéro chaque lundi.</p>' +
    '<p class="hint">' + (lbJoined() ? 'Tu apparais sous le pseudo « ' + esc(lbName()) + ' ». ' : 'Tu n’apparais pas dans le classement. ') + '<button type="button" class="btn text inline" data-action="go-lb-settings">Modifier dans les réglages</button></p>' +
    '</div>';
}
function lbSettingsHtml(){
  if (!Cloud.user) return '';
  const joined = lbJoined();
  return '<div class="lb-settings" id="lbSettings"><span class="label">Classement de la classe</span>' +
    (joined
      ? '<p class="hint">Tu apparais dans le classement sous le pseudo « ' + esc(lbName()) + ' ». Seuls ton pseudo, ton temps de révision et tes points sont visibles par les élèves connectés.</p>' +
        '<form id="lbForm" class="stack-sm" novalidate>' +
          '<label class="sr" for="lbName">Pseudo</label><input id="lbName" maxlength="20" autocomplete="nickname" placeholder="Ton pseudo" value="' + esc(lbName()) + '">' +
          '<button type="submit" class="btn ghost big">Changer de pseudo</button>' +
        '</form>' +
        '<button type="button" class="btn text big" data-action="lb-leave">Ne pas apparaître dans le classement</button>'
      : '<p class="hint">Tu n’apparais pas dans le classement. Tu peux toujours le consulter dans l’onglet Progrès.</p>' +
        '<button type="button" class="btn primary big" data-action="lb-rejoin">Réapparaître dans le classement</button>') +
    '<p class="err" id="lbMsg" hidden></p></div>';
}
function joinLeaderboard(name){
  const api = Cloud.api(); if (!api || !Cloud.user) return;
  name = String(name || '').replace(/\s+/g, ' ').trim();
  const msg = $('#lbMsg');
  if (name.length < 2 || name.length > 20){ if (msg){ msg.textContent = 'Choisis un pseudo de 2 à 20 caractères.'; msg.hidden = false; } return; }
  Cloud.profile = Object.assign({}, Cloud.profile, { lbOptIn: true, lbName: name });
  api.saveProfile(Cloud.profile).then(() => pushLeaderboard()).then(() => { LB.list = null; toast('Ton pseudo est maintenant « ' + name + ' »'); refreshCloudUi(); })
    .catch(() => toast('Impossible d’enregistrer ton pseudo pour le moment.'));
}
function rejoinLeaderboard(){
  const api = Cloud.api(); if (!api || !Cloud.user) return;
  Cloud.profile = Object.assign({}, Cloud.profile, { lbOptIn: true, lbName: lbName() });
  api.saveProfile(Cloud.profile).then(() => pushLeaderboard()).then(() => { LB.list = null; toast('Tu es de retour dans le classement'); refreshCloudUi(); }).catch(() => {});
}
function leaveLeaderboard(){
  const api = Cloud.api(); if (!api) return;
  Cloud.profile = Object.assign({}, Cloud.profile, { lbOptIn: false });
  Promise.all([api.saveProfile(Cloud.profile), api.removeLeaderboard()]).then(() => { LB.list = null; toast('Tu n’apparais plus dans le classement'); refreshCloudUi(); }).catch(() => {});
}

/* ---------- vocabulary logic ---------- */
function weekOf(w){ return Number(w.week) || 1; }
function weeks(){ return [...new Set(state.words.map(weekOf))].sort((a, b) => a - b); }
function latestWeek(){ const ws = weeks(); return ws.length ? ws[ws.length - 1] : 1; }
function wordById(id){ return state.words.find(w => w.id === id); }
function sortWords(arr){ return arr.slice().sort((a, b) => (weekOf(a) - weekOf(b)) || ((a.createdAt || 0) - (b.createdAt || 0))); }
function activeDirs(){ return state.dir === 'both' ? DIRS : [state.dir]; }
function inScope(w){ return state.scope === 'all' || weekOf(w) === Number(state.scope); }
function cardState(w, d){ return w.srs && w.srs[d] ? w.srs[d] : null; }
function isDue(s, now){ return !s || (s.due || 0) <= now; }
function scopeLabel(){ return state.scope === 'all' ? 'toutes les semaines' : 'semaine ' + state.scope; }
function dirLabel(){ return state.dir === 'both' ? 'les deux sens' : DIR_LABEL[state.dir].toLowerCase(); }

function schedule(prev, r){
  const now = Date.now();
  const s = prev
    ? { ivl: prev.ivl || 0, ease: prev.ease || 2.5, reps: prev.reps || 0, lapses: prev.lapses || 0, due: prev.due || 0 }
    : { ivl: 0, ease: 2.5, reps: 0, lapses: 0, due: 0 };
  if (r === 'again'){
    if (s.reps > 0) s.lapses += 1;
    s.reps = 0; s.ivl = 0; s.ease = Math.max(1.3, +(s.ease - 0.2).toFixed(2)); s.due = now; s.last = now;
    return s;
  }
  let ivl;
  if (r === 'hard'){ ivl = s.reps === 0 ? 1 : Math.max(s.ivl + 1, Math.round(s.ivl * 1.2)); s.ease = Math.max(1.3, +(s.ease - 0.15).toFixed(2)); }
  else if (r === 'good'){ ivl = s.reps === 0 ? 2 : Math.max(s.ivl + 1, Math.round(s.ivl * s.ease)); }
  else { ivl = s.reps === 0 ? 4 : Math.max(s.ivl + 2, Math.round(s.ivl * s.ease * 1.3)); s.ease = +(s.ease + 0.15).toFixed(2); }
  ivl = Math.min(ivl, 3650);
  s.ivl = ivl; s.reps += 1; s.due = addDays(startOfDay(now), ivl); s.last = now;
  return s;
}

function dueStats(){
  const now = Date.now(); let due = 0, fresh = 0;
  for (const w of state.words){
    if (!inScope(w)) continue;
    for (const d of activeDirs()){ const s = cardState(w, d); if (!s){ due++; fresh++; } else if (isDue(s, now)) due++; }
  }
  return { due, fresh };
}
function nextDue(all){
  const now = Date.now(); const pick = w => all || inScope(w);
  let min = Infinity;
  for (const w of state.words){ if (!pick(w)) continue;
    for (const d of activeDirs()){ const s = cardState(w, d); if (s && s.due > now) min = Math.min(min, s.due); } }
  if (min === Infinity) return null;
  const day = startOfDay(min); let count = 0;
  for (const w of state.words){ if (!pick(w)) continue;
    for (const d of activeDirs()){ const s = cardState(w, d); if (s && s.due > now && startOfDay(s.due) === day) count++; } }
  return { day, count };
}
function forecast(n){
  const now = Date.now(); const today = startOfDay(now); const out = [];
  for (let i = 0; i < n; i++) out.push({ day: addDays(today, i), count: 0 });
  for (const w of state.words) for (const d of activeDirs()){
    const s = cardState(w, d);
    if (isDue(s, now)){ out[0].count++; continue; }
    const k = daysBetween(now, s.due);
    if (k >= 0 && k < n) out[k].count++;
  }
  return out;
}
function wordLevel(w){
  const ss = activeDirs().map(d => cardState(w, d));
  if (ss.every(s => !s)) return 'new';
  const minIvl = Math.min(...ss.map(s => s ? (s.ivl || 0) : 0));
  if (minIvl >= 21) return 'mastered';
  if (minIvl >= 7) return 'known';
  return 'learning';
}
function rowStatus(w){
  const now = Date.now();
  const ss = activeDirs().map(d => cardState(w, d));
  if (ss.every(s => !s)) return 'Nouveau';
  if (ss.some(s => isDue(s, now))) return 'À réviser aujourd’hui';
  const min = Math.min(...ss.map(s => s.due));
  return 'Prochaine révision ' + (daysBetween(now, min) === 1 ? 'demain' : 'le ' + fmtShort(min));
}
function trackText(s){
  if (!s) return 'pas encore révisé';
  if (isDue(s, Date.now())) return 'aujourd’hui';
  return fmtDay(s.due);
}

/* ---------- history ---------- */
/* Active time of a session: time between two interactions, capped at 90 s so a forgotten app does not count. */
function trackTime(s){
  if (!s) return;
  const now = Date.now();
  if (!s.tick){ s.tick = now; s.active = 0; return; }
  s.active += Math.min(Math.max(0, now - s.tick), 90000);
  s.tick = now;
}
function saveSessionRecord(s){
  if (!s) return;
  let rec = null;
  trackTime(s);
  const base = { at: s.startedAt, day: dayKey(s.startedAt), secs: Math.round((s.active || 0) / 1000) };
  if (s.kind === 'srs' && s.answers) rec = Object.assign({ type: 'review', answers: s.answers, fails: s.again, cards: s.done }, base);
  else if (s.kind === 'browse' && s.seen.size) rec = Object.assign({ type: 'browse', seen: s.seen.size }, base);
  else if (s.kind === 'exam' && s.finished && s.queue.length) rec = Object.assign({
    type: 'exam', format: s.format, total: s.queue.length, correct: s.correct,
    mistakes: s.mistakes.map(m => ({ id: m.id, dir: m.dir }))
  }, base);
  else if (s.kind === 'grammar' && s.finished && s.queue.length) rec = Object.assign({ type: 'grammar', lesson: s.lesson, total: s.queue.length, correct: s.correct }, base);
  if (!rec) return;
  const key = JSON.stringify(rec);
  if (key === s.lastSaved) return;
  s.lastSaved = key;
  Store.putHistory(s.histId, rec);
}
document.addEventListener('visibilitychange', () => {
  if (!state.session) return;
  if (document.visibilityState === 'hidden') saveSessionRecord(state.session);
  else state.session.tick = Date.now();
});

/* ---------- audio ---------- */
const TTS = {
  supported: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined',
  voice: null, voices: [], useLink: false, pref: lsGet(LS + 'voice') || ''
};
function voiceRank(v){ return (/natural|online|neural|premium|enhanced/i.test(v.name) ? 0 : 1) + (/^ar[-_]SA/i.test(v.lang) ? 0 : 0.5); }
function pickVoice(){
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    TTS.voices = vs.filter(v => /^ar([-_]|$)/i.test(v.lang)).sort((a, b) => voiceRank(a) - voiceRank(b));
    TTS.voice = TTS.voices.find(v => v.voiceURI === TTS.pref) || TTS.voices[0] || null;
    return vs.length;
  } catch(e){ TTS.voice = null; TTS.voices = []; return 0; }
}
if (TTS.supported){
  pickVoice();
  try { window.speechSynthesis.addEventListener('voiceschanged', () => { pickVoice(); if (state.settings && !state.session) renderSettings(); }); } catch(e){}
}
function gtUrl(text){ return 'https://translate.google.com/?sl=ar&tl=fr&op=translate&text=' + encodeURIComponent(text); }
function speakerHtml(w){
  if (!w.audio && TTS.useLink){
    return '<a class="icon-btn" href="' + esc(gtUrl(w.ar)) + '" target="_blank" rel="noopener" aria-label="Écouter sur Google Traduction">' + ICON.speaker + '</a>';
  }
  return '<button type="button" class="icon-btn" data-action="speak" data-id="' + esc(w.id) + '" aria-label="Écouter la prononciation">' + ICON.speaker + '</button>';
}
function audioFail(text, reason){
  $('#audioMsg').textContent = (reason === 'novoice'
    ? 'Ce mot n’a pas encore de prononciation intégrée, et aucune voix arabe n’est installée sur cet appareil.'
    : 'Ce mot n’a pas encore de prononciation intégrée, et cet appareil ne permet pas d’utiliser sa voix arabe.') +
    ' Tu peux l’écouter sur Google Traduction.';
  $('#audioLink').href = gtUrl(text);
  $('#audioHelp').hidden = false;
  TTS.useLink = true;
}
/* Audio files are fetched ahead of time and played from memory: this keeps
   playback instant, works offline and avoids range-request issues on Safari. */
const audioBlobs = new Map();
function prefetchAudio(w){
  if (!w || !w.audio || audioBlobs.has(w.audio)) return;
  audioBlobs.set(w.audio, null);
  fetch(w.audio).then(r => r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(b => { audioBlobs.set(w.audio, URL.createObjectURL(b)); })
    .catch(() => { audioBlobs.delete(w.audio); });
}
function prefetchQueue(list, from){
  for (let i = from; i < Math.min(list.length, from + 3); i++){ const w = wordById(list[i].id); if (w) prefetchAudio(w); }
}
let currentAudio = null;
function playWord(w, btn){
  if (w.audio){
    const fallback = () => { if (btn) btn.classList.remove('playing'); speakTts(w.ar, btn); };
    try {
      if (currentAudio){ currentAudio.pause(); currentAudio = null; }
      if (TTS.supported){ try { window.speechSynthesis.cancel(); } catch(e){} }
      const a = new Audio(audioBlobs.get(w.audio) || w.audio);
      currentAudio = a;
      if (btn) btn.classList.add('playing');
      a.onended = () => { if (btn) btn.classList.remove('playing'); };
      a.onerror = fallback;
      const pr = a.play();
      if (pr && typeof pr.catch === 'function') pr.catch(err => { if (!err || err.name !== 'AbortError') fallback(); });
    } catch(e){ fallback(); }
    return;
  }
  speakTts(w.ar, btn);
}
function speakTts(text, btn, force){
  if (!TTS.supported || (TTS.useLink && !force)){ audioFail(text, TTS.supported ? null : 'nosupport'); return; }
  const synth = window.speechSynthesis;
  const count = pickVoice();
  if (!TTS.voice && count){ audioFail(text, 'novoice'); return; }
  let started = false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TTS.voice ? TTS.voice.lang : 'ar-SA';
  if (TTS.voice) u.voice = TTS.voice;
  u.rate = 0.8;
  u.onstart = () => { started = true; if (btn) btn.classList.add('playing'); };
  u.onend = () => { if (btn) btn.classList.remove('playing'); };
  u.onerror = (ev) => {
    if (btn) btn.classList.remove('playing');
    const code = ev && ev.error;
    if (!started && code !== 'interrupted' && code !== 'canceled') audioFail(text);
  };
  try {
    if (synth.speaking || synth.pending) synth.cancel();
    if (synth.paused) synth.resume();
    synth.speak(u);
  } catch(e){ audioFail(text); return; }
  setTimeout(() => { if (!started && !synth.speaking) audioFail(text); }, 2500);
}
function deviceVoiceStatus(){
  if (!TTS.supported) return 'Non disponible';
  if (TTS.voice) return TTS.voice.name;
  return 'Aucune voix arabe trouvée';
}
/* Once the app is loaded, fetch every audio file quietly so the service
   worker keeps them for offline use. */
function warmAudioCache(){
  if (!('serviceWorker' in navigator) || !navigator.onLine) return;
  const conn = navigator.connection;
  if (conn && conn.saveData) return;
  const files = [...new Set(state.words.map(w => w.audio).filter(Boolean))];
  let i = 0;
  const next = () => { if (i >= files.length) return; fetch(files[i++]).catch(() => {}).finally(() => setTimeout(next, 150)); };
  setTimeout(next, 3000);
}

/* ---------- install prompt ---------- */
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvent = e;
  if (state.loaded && !state.session && state.tab === 'review' && !state.setup && !state.settings && !state.detailId) renderReview();
});
window.addEventListener('appinstalled', () => { installEvent = null; state.installDismissed = true; lsSet(LS + 'install-dismissed', '1'); });
function installHint(){
  if (isStandalone() || state.installDismissed || !isTouch()) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const text = installEvent
    ? 'Installe l’app sur ton téléphone pour l’ouvrir en un geste, même hors connexion.'
    : ios
      ? 'Installe l’app : dans Safari, touche le bouton Partager puis « Sur l’écran d’accueil ». Ouvre-la ensuite toujours depuis son icône, c’est là que ta progression est gardée.'
      : 'Installe l’app : dans le menu du navigateur, choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
  return '<div class="install"><p>' + text + '</p><div class="row-actions">' +
    (installEvent ? '<button type="button" class="btn primary" data-action="install">Installer</button>' : '') +
    '<button type="button" class="btn text" data-action="dismiss-install">Plus tard</button></div></div>';
}

/* ---------- rendering ---------- */
const view = $('#view');
function applyDyn(root){
  root.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
  root.querySelectorAll('[data-h]').forEach(el => { el.style.height = el.dataset.h + '%'; });
  root.querySelectorAll('[data-font]').forEach(el => { el.style.fontFamily = el.dataset.font + ', serif'; });
}
function setView(html){ view.innerHTML = html; applyDyn(view); }
function notes(){ return state.banner ? '<p class="note">' + esc(state.banner) + '</p>' : ''; }
function seg(name, current, options, labelId){
  return '<div class="seg seg-' + options.length + '" role="radiogroup" aria-labelledby="' + labelId + '">' +
    options.map(([v, l]) => '<button type="button" role="radio" aria-checked="' + (String(current) === String(v)) + '" data-action="opt" data-name="' + name + '" data-value="' + v + '">' + l + '</button>').join('') +
    '</div>';
}
function sessionTop(right){
  return '<div class="session-top"><button type="button" class="btn text" data-action="quit">Terminer</button><span class="count">' + right + '</span></div>';
}
function progressBar(pct){ return '<div class="progress" aria-hidden="true"><span data-w="' + Math.max(0, Math.min(100, Math.round(pct))) + '"></span></div>'; }
function emptyVocab(){
  return '<p class="lead">Le vocabulaire n’est pas encore disponible. Reviens un peu plus tard.</p>';
}

function render(){
  document.body.classList.toggle('in-session', !!state.session);
  document.querySelectorAll('.tabs button').forEach(b => {
    if (b.dataset.tab === state.tab && !state.settings) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (!state.loaded){ setView('<p class="loading">Chargement du vocabulaire…</p>'); return; }
  if (state.session) return renderSession();
  if (state.settings) return renderSettings();
  if (state.setup) return renderSetup();
  if (state.detailId) return renderDetail();
  if (state.lessonId) return renderLesson();
  if (state.tab === 'review') renderReview();
  else if (state.tab === 'list') renderListShell();
  else if (state.tab === 'grammar') renderGrammar();
  else renderStats();
}

/* Review home */
function renderReview(){
  if (!state.words.length){ setView('<section class="stack"><h1 class="h1">Réviser</h1>' + notes() + emptyVocab() + '</section>'); return; }
  const ws = weeks();
  if (state.scope !== 'all' && !ws.includes(Number(state.scope))) state.scope = 'all';
  const shownWeek = state.scope === 'all' ? latestWeek() : Number(state.scope);
  const weekWords = sortWords(state.words.filter(w => weekOf(w) === shownWeek));
  const { due, fresh } = dueStats();
  const nd = nextDue();
  const status1 = due > 0
    ? plural(due, 'carte', 'cartes') + ' à réviser aujourd’hui' + (fresh ? ' (' + fresh + (fresh > 1 ? ' nouvelles' : ' nouvelle') + ')' : '') + '.'
    : 'Rien à réviser aujourd’hui.';
  const status2 = nd ? (due > 0 ? 'Ensuite : ' : 'Prochaine révision : ') + fmtDay(nd.day) + ', ' + plural(nd.count, 'carte', 'cartes') + '.' : '';
  const extra = weekWords.length > 10 ? '<p class="sheet-more">et ' + (weekWords.length - 10) + ' autres</p>' : '';

  setView('<section class="stack">' +
    '<h1 class="h1">Réviser</h1>' + notes() + (installHint() || accountHint()) +
    '<div class="sheet">' +
      '<p class="sheet-meta"><span>Semaine ' + shownWeek + '</span><span>' + plural(weekWords.length, 'mot', 'mots') + '</span></p>' +
      '<p class="hero-words ar" lang="ar" dir="rtl">' + weekWords.slice(0, 10).map(w => '<span>' + esc(w.ar) + '</span>').join('') + '</p>' + extra +
    '</div>' +
    '<div><p class="lead">' + esc(status1) + '</p>' +
      '<div class="status-line">' + (status2 ? '<p class="lead muted">' + esc(status2) + '</p>' : '') +
      '<button type="button" class="btn text" data-action="go-planning">Voir le planning</button></div></div>' +
    '<label class="field"><span class="label">Mots à réviser</span><select id="scopeSel">' +
      '<option value="all"' + (state.scope === 'all' ? ' selected' : '') + '>Toutes les semaines</option>' +
      ws.slice().reverse().map(n => '<option value="' + n + '"' + (String(state.scope) === String(n) ? ' selected' : '') + '>Semaine ' + n + '</option>').join('') +
    '</select></label>' +
    '<div class="field"><span class="label" id="dirLabel">Sens des cartes</span>' +
      seg('dir', state.dir, [['arfr', 'Arabe → FR'], ['frar', 'FR → Arabe'], ['both', 'Les deux']], 'dirLabel') + '</div>' +
    '<div class="modes">' +
      '<button type="button" class="mode" data-action="start-srs"' + (due ? '' : ' disabled') + '>' +
        '<span class="mode-text"><b>Révision du jour</b><span>Les cartes prévues aujourd’hui, avec évaluation. Planifie les prochaines révisions.</span></span>' +
        (due ? '<span class="badge">' + due + '</span>' : '<span class="badge zero">à jour</span>') + '</button>' +
      '<button type="button" class="mode" data-action="setup" data-mode="browse">' +
        '<span class="mode-text"><b>Défilement</b><span>Tous les mots à la suite, sans évaluation.</span></span>' + ICON.chevron + '</button>' +
      '<button type="button" class="mode" data-action="setup" data-mode="exam">' +
        '<span class="mode-text"><b>Examen</b><span>Un test noté, en QCM ou en réponse écrite.</span></span>' + ICON.chevron + '</button>' +
    '</div>' +
    '</section>');
}

/* Setup screens */
function renderSetup(){
  const n = state.words.filter(inScope).length;
  if (!n){ state.setup = null; renderReview(); return; }
  if (state.setup === 'browse'){
    const o = state.browseOpts;
    setView('<section class="stack">' +
      '<button type="button" class="btn text" data-action="setup-back">Retour</button>' +
      '<h1 class="h1">Défilement</h1>' +
      '<p class="lead">' + plural(n, 'mot', 'mots') + ', ' + esc(scopeLabel()) + ', ' + esc(dirLabel()) + '.</p>' +
      '<div class="field"><span class="label" id="orderLabel">Ordre</span>' + seg('order', o.order, [['order', 'Dans l’ordre'], ['shuffle', 'Mélangé']], 'orderLabel') + '</div>' +
      '<div class="field"><span class="label" id="facesLabel">Affichage</span>' + seg('faces', o.faces, [['one', 'Une face à la fois'], ['both', 'Les deux faces']], 'facesLabel') + '</div>' +
      '<button type="button" class="btn primary big" data-action="start-browse">Commencer</button>' +
      '<p class="hint">Touche la carte pour la retourner, puis passe à la suivante. Tu peux aussi glisser vers la gauche ou la droite.</p>' +
      '</section>');
    return;
  }
  const o = state.examOpts;
  const cards = n * activeDirs().length;
  const counts = [10, 20].filter(c => c < cards).map(c => [String(c), String(c)]);
  counts.push(['all', 'Toutes (' + cards + ')']);
  const current = (o.count === 'all' || Number(o.count) >= cards) ? 'all' : String(o.count);
  setView('<section class="stack">' +
    '<button type="button" class="btn text" data-action="setup-back">Retour</button>' +
    '<h1 class="h1">Examen</h1>' +
    '<p class="lead">' + plural(cards, 'question', 'questions') + ', ' + esc(scopeLabel()) + ', ' + esc(dirLabel()) + '.</p>' +
    '<div class="field"><span class="label" id="formatLabel">Format</span>' + seg('format', o.format, [['qcm', 'QCM'], ['written', 'Réponse écrite']], 'formatLabel') + '</div>' +
    (counts.length > 1 ? '<div class="field"><span class="label" id="countLabel">Nombre de questions</span>' + seg('count', current, counts, 'countLabel') + '</div>' : '') +
    '<button type="button" class="btn primary big" data-action="start-exam">Commencer l’examen</button>' +
    '<p class="hint">' + (o.format === 'qcm' ? 'Choisis la bonne réponse parmi quatre propositions.' : 'Écris la réponse. Les voyelles et les accents ne comptent pas.') + ' L’examen ne change pas le planning de révision.</p>' +
    '</section>');
}

/* Spaced repetition session */
function spreadPairs(q){
  for (let i = 1; i < q.length; i++){
    if (q[i].id === q[i - 1].id){
      for (let j = i + 1; j < q.length; j++){ if (q[j].id !== q[i - 1].id){ [q[i], q[j]] = [q[j], q[i]]; break; } }
    }
  }
  return q;
}
function startSrs(){
  const now = Date.now(); const q = [];
  for (const w of sortWords(state.words)){
    if (!inScope(w)) continue;
    for (const d of activeDirs()) if (isDue(cardState(w, d), now)) q.push({ id: w.id, dir: d });
  }
  if (!q.length){ toast('Rien à réviser dans cette sélection.'); return; }
  spreadPairs(shuffle(q));
  state.session = { kind: 'srs', queue: q, idx: 0, revealed: false, done: 0, again: 0, answers: 0, startedAt: Date.now(), histId: newId('h') };
  render(); scrollTop();
}

function arBlock(w){
  return '<div class="ar-word"><p class="ar big" lang="ar" dir="rtl">' + esc(w.ar) + '</p>' + speakerHtml(w) + '</div>';
}
function frBlock(w){ return '<p class="fr big">' + esc(w.fr) + '</p>'; }
function details(w){
  const rows = [['Racine', w.root, 'ar'], ['Pluriel', w.plural, 'ar'], ['Exemple', w.example, 'auto'], ['Note', w.note, 'auto']].filter(r => r[1]);
  if (!rows.length) return '';
  return '<dl class="details">' + rows.map(([k, v, t]) =>
    '<div><dt>' + k + '</dt><dd ' + (t === 'ar' ? 'class="ar" lang="ar" dir="rtl"' : 'dir="auto"') + '>' + esc(v) + '</dd></div>').join('') + '</dl>';
}
function ratingButtons(w, card){
  const prev = cardState(w, card.dir);
  const opts = [['again', 'À revoir'], ['hard', 'Difficile'], ['good', 'Bien'], ['easy', 'Facile']];
  return '<div class="rate">' + opts.map(([r, l], i) => {
    const hint = r === 'again' ? 'maintenant' : fmtIvl(schedule(prev, r).ivl);
    return '<button type="button" class="rate-btn ' + r + '" data-action="rate" data-r="' + r + '" aria-keyshortcuts="' + (i + 1) + '"><b>' + l + '</b><small>' + hint + '</small></button>';
  }).join('') + '</div>';
}
function renderSession(){
  const s = state.session;
  if (!s.tick){ s.tick = Date.now(); s.active = 0; }
  if (s.kind === 'browse') return renderBrowse();
  if (s.kind === 'exam') return renderExam();
  if (s.kind === 'grammar') return renderGrammarQ();
  while (s.idx < s.queue.length && !wordById(s.queue[s.idx].id)) s.queue.splice(s.idx, 1);
  if (s.idx >= s.queue.length) return renderSrsEnd();
  const card = s.queue[s.idx]; const w = wordById(card.id);
  const left = s.queue.length - s.idx;
  const front = card.dir === 'arfr' ? arBlock(w) : frBlock(w);
  const back = card.dir === 'arfr' ? frBlock(w) : arBlock(w);
  setView('<section class="session">' +
    sessionTop(plural(left, 'carte restante', 'cartes restantes')) +
    progressBar(s.done / (s.done + left) * 100) +
    '<div class="sheet card' + (s.revealed ? ' still' : '') + '"' + (s.revealed ? '' : ' data-action="reveal"') + '>' +
      '<p class="sheet-meta"><span>Semaine ' + weekOf(w) + '</span><span>' + (card.dir === 'arfr' ? 'Que veut dire ce mot ?' : 'Comment dit-on en arabe ?') + '</span></p>' +
      '<div class="face front">' + front + '</div>' +
      (s.revealed ? '<div class="face back">' + back + details(w) + '</div>' : '') +
    '</div>' +
    '<div class="answer-bar">' + (s.revealed ? ratingButtons(w, card) : '<button type="button" class="btn primary big" data-action="reveal">Afficher la réponse</button>') + '</div>' +
    '</section>');
  prefetchQueue(s.queue, s.idx);
}
function renderSrsEnd(){
  const s = state.session; const nd = nextDue();
  setView('<section class="session stack">' +
    '<div class="sheet card end">' +
      '<p class="end-ar" lang="ar" dir="rtl">أَحْسَنْتَ</p>' +
      '<h2 class="h2">Séance terminée</h2>' +
      '<p>' + plural(s.done, 'carte révisée', 'cartes révisées') + '.</p>' +
      (nd ? '<p class="muted">Prochaine révision ' + esc(fmtDay(nd.day)) + ' : ' + plural(nd.count, 'carte', 'cartes') + '.</p>' : '') +
    '</div>' +
    '<button type="button" class="btn primary big" data-action="quit">Retour</button>' +
    '</section>');
}
function reveal(){
  const s = state.session; if (!s || s.kind !== 'srs' || s.revealed || s.idx >= s.queue.length) return;
  s.revealed = true; renderSession();
}
function rate(r){
  const s = state.session; if (!s || s.kind !== 'srs' || !s.revealed || s.idx >= s.queue.length) return;
  const card = s.queue[s.idx]; const w = wordById(card.id);
  if (w) Store.setSrs(w.id, card.dir, schedule(cardState(w, card.dir), r));
  s.answers++;
  if (r === 'again'){ s.again++; s.queue.splice(Math.min(s.queue.length, s.idx + 4), 0, card); }
  else s.done++;
  s.idx++; s.revealed = false;
  if (s.answers % 5 === 0 || s.idx >= s.queue.length) saveSessionRecord(s);
  renderSession();
}

/* Browse session */
function startBrowse(){
  const list = sortWords(state.words.filter(inScope));
  if (!list.length){ toast('Aucun mot dans cette sélection.'); return; }
  const q = list.map(w => ({ id: w.id, dir: state.dir === 'both' ? (Math.random() < 0.5 ? 'arfr' : 'frar') : state.dir }));
  if (state.browseOpts.order === 'shuffle') shuffle(q);
  state.session = { kind: 'browse', queue: q, idx: 0, flipped: false, both: state.browseOpts.faces === 'both', ended: false,
    seen: new Set([q[0].id]), startedAt: Date.now(), histId: newId('h') };
  state.setup = null;
  render(); scrollTop();
}
function renderBrowse(){
  const s = state.session;
  while (!s.ended && s.idx < s.queue.length && !wordById(s.queue[s.idx].id)) s.queue.splice(s.idx, 1);
  if (s.ended || s.idx >= s.queue.length){ s.ended = true; return renderBrowseEnd(); }
  const c = s.queue[s.idx]; const w = wordById(c.id);
  const showBack = s.both || s.flipped;
  const front = c.dir === 'arfr' ? arBlock(w) : frBlock(w);
  const back = c.dir === 'arfr' ? frBlock(w) : arBlock(w);
  const last = s.idx === s.queue.length - 1;
  setView('<section class="session">' +
    sessionTop((s.idx + 1) + ' sur ' + s.queue.length) +
    progressBar((s.idx + 1) / s.queue.length * 100) +
    '<div class="sheet card' + (s.both ? ' still' : '') + '"' + (s.both ? '' : ' data-action="flip"') + '>' +
      '<p class="sheet-meta"><span>Semaine ' + weekOf(w) + '</span><span>' + (c.dir === 'arfr' ? 'Que veut dire ce mot ?' : 'Comment dit-on en arabe ?') + '</span></p>' +
      '<div class="face front">' + front + '</div>' +
      (showBack ? '<div class="face back">' + back + details(w) + '</div>' : '') +
      (s.both ? '' : '<p class="flip-hint' + (s.flipped ? ' quiet' : '') + '">' + ICON.flip + (s.flipped ? 'Touche pour cacher' : 'Touche pour retourner') + '</p>') +
    '</div>' +
    '<div class="nav2">' +
      '<button type="button" class="btn ghost big" data-action="prev"' + (s.idx === 0 ? ' disabled' : '') + '>Précédent</button>' +
      '<button type="button" class="btn primary big" data-action="next">' + (last ? 'Terminer la série' : 'Suivant') + '</button>' +
    '</div>' +
    '</section>');
  prefetchQueue(s.queue, s.idx);
}
function renderBrowseEnd(){
  const s = state.session;
  setView('<section class="session stack">' +
    '<div class="sheet card end">' +
      '<p class="end-ar" lang="ar" dir="rtl">أَحْسَنْتَ</p>' +
      '<h2 class="h2">Série terminée</h2>' +
      '<p>' + plural(s.seen.size, 'mot parcouru', 'mots parcourus') + '.</p>' +
    '</div>' +
    '<div class="actions">' +
      '<button type="button" class="btn primary big" data-action="restart-browse">Recommencer</button>' +
      '<button type="button" class="btn ghost big" data-action="quit">Retour</button>' +
    '</div>' +
    '</section>');
}
function flip(){ const s = state.session; if (!s || s.kind !== 'browse' || s.both || s.ended) return; s.flipped = !s.flipped; renderSession(); }
function browseMove(delta){
  const s = state.session; if (!s || s.kind !== 'browse' || s.ended) return;
  const ni = s.idx + delta;
  if (ni < 0) return;
  if (ni >= s.queue.length){ s.ended = true; saveSessionRecord(s); renderSession(); scrollTop(); return; }
  s.idx = ni; s.flipped = false; s.seen.add(s.queue[ni].id);
  if (s.seen.size % 10 === 0) saveSessionRecord(s);
  renderSession();
}

/* Exam */
function answerOf(w, dir){ return dir === 'arfr' ? w.fr : w.ar; }
function buildChoices(c){
  const w = wordById(c.id); const right = answerOf(w, c.dir);
  const seen = new Set([norm(right)]);
  const pool = shuffle(state.words.filter(x => x.id !== w.id)).sort((a, b) => (inScope(b) ? 1 : 0) - (inScope(a) ? 1 : 0));
  const choices = [{ text: right, ok: true }];
  for (const x of pool){
    if (choices.length >= 4) break;
    const t = answerOf(x, c.dir); const k = norm(t);
    if (!t || seen.has(k)) continue;
    seen.add(k); choices.push({ text: t, ok: false });
  }
  return shuffle(choices);
}
function startExam(override){
  const o = state.examOpts;
  let q;
  if (override) q = override.filter(c => wordById(c.id)).map(c => ({ id: c.id, dir: c.dir }));
  else {
    q = [];
    for (const w of state.words){ if (!inScope(w)) continue; for (const d of activeDirs()) q.push({ id: w.id, dir: d }); }
    spreadPairs(shuffle(q));
    if (o.count !== 'all') q = q.slice(0, Number(o.count) || 10);
  }
  if (!q.length){ toast('Aucun mot dans cette sélection.'); return; }
  const format = (override && state.session && state.session.format) || o.format;
  if (format === 'qcm'){
    q.forEach(c => { c.choices = buildChoices(c); });
    if (q.some(c => c.choices.length < 2)){ toast('Il faut au moins deux mots différents pour un QCM.'); return; }
  }
  state.session = { kind: 'exam', format, queue: q, idx: 0, answered: false, picked: -1, typed: '', result: null,
    correct: 0, mistakes: [], finished: false, startedAt: Date.now(), histId: newId('h') };
  state.setup = null;
  render(); scrollTop();
  focusExamInput();
}
function focusExamInput(){ const i = $('#examInput'); if (i) i.focus(); }
function cleanFr(s){
  return norm(s).replace(/[’`]/g, "'").replace(/\b(l|d|qu|s)'/g, ' ')
    .replace(/\b(le|la|les|un|une|des|du|de|se)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function cleanAr(s){
  return norm(s).replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u064A ]/g, '').replace(/\s+/g, ' ').trim();
}
function checkTyped(input, w, dir){
  if (dir === 'arfr'){
    const a = cleanFr(input); if (!a) return false;
    const variants = [w.fr, w.fr.replace(/\(.*?\)/g, '')].concat(w.fr.split(/[,;\/()]|\bou\b/));
    return variants.map(cleanFr).filter(Boolean).includes(a);
  }
  const a = cleanAr(input); if (!a) return false;
  const b = cleanAr(w.ar);
  const noAl = x => x.replace(/^ال/, '');
  return a === b || noAl(a) === noAl(b);
}
function renderExam(){
  const s = state.session;
  while (!s.finished && s.idx < s.queue.length && !wordById(s.queue[s.idx].id)) s.queue.splice(s.idx, 1);
  if (s.finished || s.idx >= s.queue.length){
    if (!s.finished){ s.finished = true; saveSessionRecord(s); }
    return renderExamEnd();
  }
  const q = s.queue[s.idx]; const w = wordById(q.id);
  const arAnswer = q.dir === 'frar';
  const prompt = q.dir === 'arfr' ? arBlock(w) : frBlock(w);
  const last = s.idx === s.queue.length - 1;
  const nextBtn = '<button type="button" class="btn primary big" id="nextQ" data-action="next-q">' + (last ? 'Voir le résultat' : 'Question suivante') + '</button>';
  let answer = '';
  if (s.format === 'qcm'){
    answer = '<div class="choices">' + q.choices.map((c, i) => {
      let cls = 'choice';
      if (s.answered){ if (c.ok) cls += ' right'; else if (i === s.picked) cls += ' wrong'; }
      return '<button type="button" class="' + cls + '" data-action="pick" data-i="' + i + '"' + (s.answered ? ' aria-disabled="true"' : '') + ' aria-keyshortcuts="' + (i + 1) + '">' +
        '<span class="key">' + (i + 1) + '</span>' +
        '<span class="txt' + (arAnswer ? ' ar" lang="ar" dir="rtl' : '') + '">' + esc(c.text) + '</span></button>';
    }).join('') + '</div>';
    if (s.answered){
      const ok = q.choices[s.picked] && q.choices[s.picked].ok;
      answer += '<p class="feedback ' + (ok ? 'ok' : 'ko') + '">' + (ok ? 'Juste' : 'Faux. La bonne réponse est encadrée.') + '</p>' +
        '<div class="after">' + nextBtn + '</div>';
    }
  } else if (!s.answered){
    answer = '<form id="examForm" class="exam-form" autocomplete="off" novalidate>' +
      '<label class="sr" for="examInput">Ta réponse</label>' +
      '<input id="examInput" name="answer"' + (arAnswer ? ' class="input-ar" lang="ar" dir="rtl" placeholder="اكتب هنا"' : ' placeholder="Ta réponse en français" autocapitalize="off"') + ' spellcheck="false" autocorrect="off" autocomplete="off">' +
      '<button type="submit" class="btn primary big">Valider</button></form>';
  } else {
    const expected = arAnswer ? '<span class="ar" lang="ar" dir="rtl">' + esc(w.ar) + '</span>' : '<b>' + esc(w.fr) + '</b>';
    answer = s.result
      ? '<p class="feedback ok">Juste' + (s.overridden ? ', compté comme juste' : '') + '</p><p class="expected">' + expected + '</p>'
      : '<p class="feedback ko">Pas tout à fait' + (s.typed ? ' : tu as écrit « ' + esc(s.typed) + ' »' : '') + '.</p><p class="expected">Réponse attendue : ' + expected + '</p>';
    answer += '<div class="after">' + nextBtn + (s.result ? '' : '<button type="button" class="btn ghost big" data-action="override">Compter comme juste</button>') + '</div>';
  }
  setView('<section class="session">' +
    sessionTop('Question ' + (s.idx + 1) + ' sur ' + s.queue.length) +
    progressBar(s.idx / s.queue.length * 100) +
    '<div class="sheet card still compact">' +
      '<p class="sheet-meta"><span>Semaine ' + weekOf(w) + '</span><span>' + (q.dir === 'arfr' ? 'Que veut dire ce mot ?' : 'Comment dit-on en arabe ?') + '</span></p>' +
      '<div class="face front">' + prompt + '</div>' +
    '</div>' + answer +
    '</section>');
  prefetchQueue(s.queue, s.idx);
}
function pick(i){
  const s = state.session; if (!s || s.kind !== 'exam' || s.format !== 'qcm' || s.answered) return;
  const q = s.queue[s.idx]; if (!q.choices[i]) return;
  s.answered = true; s.picked = i;
  if (q.choices[i].ok) s.correct++; else s.mistakes.push(q);
  renderSession();
  const n = $('#nextQ'); if (n) n.focus({ preventScroll: true });
}
function submitExam(e){
  e.preventDefault();
  const s = state.session; if (!s || s.kind !== 'exam' || s.answered) return;
  const value = e.target.elements.answer.value.trim();
  if (!value){ e.target.elements.answer.focus(); return; }
  const q = s.queue[s.idx]; const w = wordById(q.id); if (!w) return;
  s.answered = true; s.typed = value; s.result = checkTyped(value, w, q.dir);
  if (s.result) s.correct++; else s.mistakes.push(q);
  renderSession();
  const n = $('#nextQ'); if (n) n.focus({ preventScroll: true });
}
function override(){
  const s = state.session; if (!s || s.kind !== 'exam' || !s.answered || s.result) return;
  const q = s.queue[s.idx];
  s.result = true; s.overridden = true; s.correct++;
  s.mistakes = s.mistakes.filter(m => m !== q);
  renderSession();
  const n = $('#nextQ'); if (n) n.focus({ preventScroll: true });
}
function nextQ(){
  const s = state.session; if (!s || s.kind !== 'exam' || !s.answered) return;
  s.idx++; s.answered = false; s.picked = -1; s.typed = ''; s.result = null; s.overridden = false;
  if (s.idx >= s.queue.length){ s.finished = true; saveSessionRecord(s); }
  renderSession(); scrollTop();
  focusExamInput();
}
function renderExamEnd(){
  const s = state.session;
  const total = s.queue.length; const pct = total ? Math.round(s.correct / total * 100) : 0;
  const praise = pct >= 90 ? ['مُمْتَازٌ', 'Excellent'] : pct >= 70 ? ['جَيِّدٌ جِدًّا', 'Très bien'] : pct >= 50 ? ['جَيِّدٌ', 'Bien'] : ['حَاوِلْ مَرَّةً أُخْرَى', 'Essaie encore'];
  const mistakes = s.mistakes.filter(m => wordById(m.id));
  setView('<section class="session stack">' +
    '<div class="sheet card end">' +
      '<p class="end-ar praise" lang="ar" dir="rtl">' + praise[0] + '</p>' +
      '<p class="score">' + s.correct + ' / ' + total + '</p>' +
      '<p>' + praise[1] + ', ' + pct + ' % de bonnes réponses.</p>' +
    '</div>' +
    (mistakes.length ? '<h2 class="h2">À retravailler</h2><ul class="rows">' + mistakes.map(m => {
      const w = wordById(m.id);
      return '<li class="row"><span class="row-fr"><span>' + esc(w.fr) + '</span><small>' + DIR_LABEL[m.dir] + '</small></span><span class="row-ar ar" lang="ar" dir="rtl">' + esc(w.ar) + '</span></li>';
    }).join('') + '</ul>' : '') +
    '<div class="actions">' +
      (mistakes.length ? '<button type="button" class="btn primary big" data-action="retry-mistakes">Refaire les erreurs</button>' : '') +
      '<button type="button" class="btn ' + (mistakes.length ? 'ghost' : 'primary') + ' big" data-action="quit">Retour</button>' +
    '</div>' +
    '</section>');
}

/* Vocabulary list and word detail */
function renderListShell(){
  setView('<section class="stack">' +
    '<h1 class="h1">Vocabulaire</h1>' + notes() +
    '<p class="lead" id="listSummary"></p>' +
    '<label class="search"><span class="sr">Chercher un mot</span><input id="searchInput" type="search" placeholder="Chercher en arabe ou en français" autocomplete="off" value="' + esc(state.search) + '"></label>' +
    '<div id="listItems"></div>' +
    '</section>');
  renderListItems();
}
function renderListItems(){
  const box = $('#listItems'); if (!box) return;
  const ws = weeks();
  $('#listSummary').textContent = state.words.length ? plural(state.words.length, 'mot', 'mots') + ' sur ' + plural(ws.length, 'semaine', 'semaines') + '.' : '';
  if (!state.words.length){ box.innerHTML = emptyVocab(); return; }
  const q = norm(state.search.trim());
  let html = '', shown = 0;
  for (const wk of ws.slice().reverse()){
    const items = sortWords(state.words.filter(w => weekOf(w) === wk))
      .filter(w => !q || [w.ar, w.fr, w.root, w.plural, w.example, w.note].some(f => norm(f).includes(q)));
    if (!items.length) continue;
    shown += items.length;
    html += '<section class="week"><div class="week-head"><h2 class="h2">Semaine ' + wk + '</h2><span class="muted">' + plural(items.length, 'mot', 'mots') + '</span>' +
      '<button type="button" class="btn small" data-action="review-week" data-week="' + wk + '">Réviser</button></div>' +
      '<ul class="rows">' + items.map(w =>
        '<li><button type="button" class="row" data-action="detail" data-id="' + esc(w.id) + '">' +
          '<span class="row-fr"><span>' + esc(w.fr) + '</span><small>' + esc(rowStatus(w)) + '</small></span>' +
          '<span class="row-ar ar" lang="ar" dir="rtl">' + esc(w.ar) + '</span>' +
        '</button></li>').join('') + '</ul></section>';
  }
  box.innerHTML = shown ? html : '<p class="muted">Aucun mot ne correspond à « ' + esc(state.search.trim()) + ' ».</p>';
}
function renderDetail(){
  const w = wordById(state.detailId);
  if (!w){ state.detailId = null; return render(); }
  setView('<section class="stack">' +
    '<button type="button" class="btn text" data-action="close-detail">Retour</button>' +
    '<div class="sheet card still compact detail-card">' +
      '<p class="sheet-meta"><span>Semaine ' + weekOf(w) + '</span></p>' +
      '<div class="face front">' + arBlock(w) + frBlock(w) + '</div>' +
      details(w) +
    '</div>' +
    '<div class="track"><span class="label">Prochaines révisions</span><ul>' +
      DIRS.map(d => '<li><span>' + (d === 'arfr' ? 'Arabe → FR' : 'FR → arabe') + '</span><span>' + esc(trackText(cardState(w, d))) + '</span></li>').join('') +
    '</ul></div>' +
    '</section>');
  prefetchAudio(w);
}

/* Stats */
function renderStats(){
  if (!state.words.length){ setView('<section class="stack"><h1 class="h1">Progrès</h1>' + notes() + emptyVocab() + '</section>'); return; }
  const now = Date.now();
  const act = {};
  for (const h of state.history){
    if (!h.day) continue;
    const n = h.type === 'review' ? (h.answers || 0) : h.type === 'browse' ? (h.seen || 0) : (h.type === 'exam' || h.type === 'grammar') ? (h.total || 0) : 0;
    act[h.day] = (act[h.day] || 0) + n;
  }
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!act[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (act[dayKey(d.getTime())]){ streak++; d.setDate(d.getDate() - 1); }
  const todayN = act[dayKey(now)] || 0;
  let ans = 0, fails = 0;
  for (const h of state.history) if (h.type === 'review' && (h.at || 0) >= now - 30 * DAY){ ans += h.answers || 0; fails += h.fails || 0; }
  const success = ans ? Math.round((1 - fails / ans) * 100) : null;

  const days = [];
  for (let i = 13; i >= 0; i--){ const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - i); const k = dayKey(x.getTime()); days.push({ n: act[k] || 0, label: x.getDate(), today: i === 0 }); }
  const maxN = Math.max(1, ...days.map(x => x.n));

  const counts = { new: 0, learning: 0, known: 0, mastered: 0 };
  for (const w of state.words) counts[wordLevel(w)]++;
  const total = state.words.length;

  const fc = forecast(7); const maxF = Math.max(1, ...fc.map(x => x.count));
  const nd = nextDue(true);
  const later = nd && daysBetween(now, nd.day) >= 7 ? '<p class="hint">Ensuite : ' + esc(fmtDay(nd.day)) + ', ' + plural(nd.count, 'carte', 'cartes') + '.</p>' : '';

  const ws = weeks();
  const exams = state.history.filter(h => h.type === 'exam' && h.total).sort((a, b) => (b.at || 0) - (a.at || 0));
  const avg = exams.length ? Math.round(exams.reduce((acc, h) => acc + h.correct / h.total, 0) / exams.length * 100) : null;

  setView('<section class="stack">' +
    '<h1 class="h1">Progrès</h1>' + notes() +
    '<div class="statrow">' +
      '<div><span class="stat-n">' + streak + '</span><span class="stat-l">' + (streak > 1 ? 'jours d’affilée' : 'jour d’affilée') + '</span></div>' +
      '<div><span class="stat-n">' + todayN + '</span><span class="stat-l">' + (todayN > 1 ? 'cartes travaillées aujourd’hui' : 'carte travaillée aujourd’hui') + '</span></div>' +
      '<div><span class="stat-n">' + (success == null ? '–' : success + ' %') + '</span><span class="stat-l">de réussite en révision sur 30 jours</span></div>' +
    '</div>' +

    lbSection() +
    '<div class="section"><h2 class="h2">Niveau des mots</h2>' +
      '<div class="levelbar" role="img" aria-label="' + LEVELS.map(l => counts[l.id] + ' ' + l.label.toLowerCase()).join(', ') + '">' +
        LEVELS.map(l => counts[l.id] ? '<span class="lv-' + l.id + '" data-w="' + (counts[l.id] / total * 100).toFixed(2) + '"></span>' : '').join('') + '</div>' +
      '<ul class="legend">' + LEVELS.map(l => '<li><span class="sw lv-' + l.id + '"></span>' + l.label + '<b>' + counts[l.id] + '</b></li>').join('') + '</ul>' +
      '<p class="hint">Un mot est acquis quand il revient dans 7 jours ou plus, maîtrisé à partir de 3 semaines' + (state.dir === 'both' ? ', dans les deux sens' : '') + '.</p>' +
    '</div>' +

    '<div class="section" id="forecast"><h2 class="h2">Prochaines révisions</h2>' +
      '<ul class="hbars">' + fc.map((x, i) =>
        '<li><span>' + (i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : esc(fmtWeekday(x.day))) + '</span>' +
        '<span class="track-bar"><span data-w="' + (x.count / maxF * 100).toFixed(1) + '"></span></span><b>' + x.count + '</b></li>').join('') + '</ul>' +
      later +
    '</div>' +

    '<div class="section"><h2 class="h2">Activité des 14 derniers jours</h2>' +
      '<div class="chart" role="img" aria-label="Cartes travaillées par jour">' + days.map(x =>
        '<div><span class="n">' + (x.n || '') + '</span><span class="bar' + (x.today ? ' today' : '') + '" data-h="' + (x.n ? Math.max(3, x.n / maxN * 85) : 0) + '"></span></div>').join('') + '</div>' +
      '<div class="chart-labels" aria-hidden="true">' + days.map(x => '<span>' + x.label + '</span>').join('') + '</div>' +
      '<p class="hint">Révisions, défilement, examens et grammaire confondus.</p>' +
    '</div>' +

    '<div class="section"><h2 class="h2">Par semaine</h2>' +
      '<ul class="hbars">' + ws.slice().reverse().map(wk => {
        const list = state.words.filter(w => weekOf(w) === wk);
        const ok = list.filter(w => ['known', 'mastered'].includes(wordLevel(w))).length;
        return '<li><span>Semaine ' + wk + '</span><span class="track-bar"><span data-w="' + (ok / list.length * 100).toFixed(1) + '"></span></span><b>' + ok + '/' + list.length + '</b></li>';
      }).join('') + '</ul>' +
      '<p class="hint">Mots acquis ou maîtrisés sur le total de la semaine.</p>' +
    '</div>' +

    '<div class="section"><h2 class="h2">Examens</h2>' +
      (exams.length
        ? '<p class="lead">' + plural(exams.length, 'examen passé', 'examens passés') + ', moyenne de ' + avg + ' %.</p>' +
          '<ul class="exam-list">' + exams.slice(0, 6).map(h =>
            '<li><span>' + esc(fmtShort(h.at)) + ', ' + (h.format === 'qcm' ? 'QCM' : 'réponse écrite') + '</span><b>' + h.correct + ' / ' + h.total + '</b></li>').join('') + '</ul>'
        : '<p class="hint">Aucun examen pour l’instant. Lance-en un depuis l’onglet Réviser.</p>') +
    '</div>' +
    grammarStats() +
    '</section>');
}


/* ---------- grammar (lessons, rule questions, generated exercises) ---------- */
let grammarLoading = null;
function loadGrammar(force){
  if (grammarLoading) return grammarLoading;
  grammarLoading = (async () => {
    try {
      const r = await fetch('grammar.json' + (force ? '?t=' + Date.now() : ''), { cache: force ? 'reload' : 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!data || !Array.isArray(data.lessons)) throw new Error('format');
      state.grammar = data; state.grammarError = '';
      lsSet(LS + 'grammar-cache-v1', JSON.stringify(data));
    } catch(e){
      if (!state.grammar){ try { state.grammar = JSON.parse(lsGet(LS + 'grammar-cache-v1') || 'null'); } catch(e2){ state.grammar = null; } }
      if (!state.grammar) state.grammarError = String((e && e.message) || e);
    } finally {
      grammarLoading = null;
    }
  })();
  return grammarLoading;
}
function afterGrammarLoad(){
  refreshGrammarBadge();
  if (state.tab === 'grammar' && !state.session && !state.settings && !state.lessonId) render();
  maybeAnnounceGrammar();
}
const K_GRAMMAR = LS + 'grammar-cache-v1';
const K_NEWGRAM = LS + 'new-grammar-v1';
const K_GRAMVISIT = LS + 'grammar-visited-v1';
const POSS = [
  { id: '1',  pron: 'ي', end: '\u0650\u064A', tile: 'ـِي', label: 'mon, ma, mes', ctx: '' },
  { id: '2m', pron: 'كَ', end: '\u064F\u0643\u064E', tile: 'ـُكَ', label: 'ton, ta, tes (garçon)', ctx: ' (à un garçon)' },
  { id: '2f', pron: 'كِ', end: '\u064F\u0643\u0650', tile: 'ـُكِ', label: 'ton, ta, tes (fille)', ctx: ' (à une fille)' },
  { id: '2d', pron: 'كُمَا', end: '\u064F\u0643\u064F\u0645\u064E\u0627', tile: 'ـُكُمَا', label: 'votre, vos (à deux)', ctx: ' (à deux personnes)' },
  { id: '2p', pron: 'كُمْ', end: '\u064F\u0643\u064F\u0645\u0652', tile: 'ـُكُمْ', label: 'votre, vos (à trois ou plus)', ctx: ' (à trois personnes ou plus)' }
];
const PERS = [
  { id: '3m', label: 'il', who: 'il (l’absent)', tile: 'ـَ' },
  { id: '3f', label: 'elle', who: 'elle (l’absente)', tile: 'ـَتْ' },
  { id: '2m', label: 'tu (garçon)', who: 'tu, garçon (l’interlocuteur)', tile: 'ـْتَ' },
  { id: '2f', label: 'tu (fille)', who: 'tu, fille (l’interlocutrice)', tile: 'ـْتِ' },
  { id: '1',  label: 'je', who: 'je (le locuteur)', tile: 'ـْتُ' }
];
const HARAKA_RE = /[\u064B-\u0652]/g;

function stripEnd(ar){ return String(ar).replace(/[\u064B-\u0652]+$/, ''); }
function splitLast(word){
  /* Split a word before its last letter so the ending can be highlighted. */
  let i = word.length - 1;
  while (i > 0 && /[\u064B-\u0652]/.test(word[i])) i--;
  return [word.slice(0, i), word.slice(i)];
}
function highlight(base, end){
  return '<span class="w"><span>' + esc(base) + '</span><span class="hl">' + esc(end) + '</span></span>';
}
function arWrap(text){
  /* Escape text and isolate Arabic runs so they display in the right order inside French sentences. */
  return esc(text).replace(/[\u0600-\u06FF\u0640]+(?:[ \u00A0]+[\u0600-\u06FF\u0640]+)*/g, m => '<bdi class="ari" lang="ar" dir="rtl">' + m + '</bdi>');
}
function frNoun(w){
  const m = String(w.fr || '').trim().match(/^(un|une)\s+(.+)$/i);
  if (!m) return null;
  return { noun: m[2].replace(/\s*\(.*\)\s*$/, ''), fem: m[1].toLowerCase() === 'une', plural: w.fr_plural || '' };
}
function frPoss(n, pid, plural){
  const vowel = /^[aeiouyhàâäéèêëîïôöûü]/i.test(n.noun);
  const fem = n.fem && !vowel;
  const det = plural
    ? { '1': 'mes', '2m': 'tes', '2f': 'tes', '2d': 'vos', '2p': 'vos' }[pid]
    : { '1': fem ? 'ma' : 'mon', '2m': fem ? 'ta' : 'ton', '2f': fem ? 'ta' : 'ton', '2d': 'votre', '2p': 'votre' }[pid];
  return det + ' ' + (plural ? n.plural : n.noun);
}
function possCtx(pid){ return (POSS.find(p => p.id === pid) || {}).ctx || ''; }
function verbStem(ar){ return String(ar).replace(/\u064E$/, ''); }
function conjugate(v){
  if (v.forms) return v.forms;
  const stem = verbStem(v.ar);
  const last = stem.replace(HARAKA_RE, '').slice(-1);
  if (last === 'ت'){
    const s = stem.slice(0, stem.lastIndexOf('ت'));
    return { '3m': v.ar, '3f': stem + '\u064E\u062A\u0652', '2m': s + '\u062A\u0651\u064E', '2f': s + '\u062A\u0651\u0650', '1': s + '\u062A\u0651\u064F', merged: true };
  }
  return { '3m': v.ar, '3f': stem + '\u064E\u062A\u0652', '2m': stem + '\u0652\u062A\u064E', '2f': stem + '\u0652\u062A\u0650', '1': stem + '\u0652\u062A\u064F' };
}
function verbInf(v){ return String(v.fr || '').replace(/\s*\(.*\)\s*$/, '').trim(); }
function pcLabel(v, pid){
  const t = (v.pc || {})[pid]; if (!t) return '';
  return t + (pid === '2m' ? ' (garçon)' : pid === '2f' ? ' (fille)' : '');
}
function pickOthers(all, keep, n){ return shuffle(all.filter(x => x !== keep)).slice(0, n); }
const PARTICLES = ['فِي', 'عَلَى', 'عَنْ', 'مِنْ', 'إِلَى'];
const SUN_LETTERS = 'تثدذرزسشصضطظلن';
function withAl(stem){
  /* Add the article ال ; a "sun" letter takes a chadda (الدَّارِ), a "moon" letter does not (الكِتَابِ). */
  const first = stem[0];
  return SUN_LETTERS.includes(first) ? 'ال' + first + '\u0651' + stem.slice(1) : 'ال' + stem;
}
function frDef(n){
  const vowel = /^[aeiouyhàâäéèêëîïôöûü]/i.test(n.noun);
  return (vowel ? 'l’' : n.fem ? 'la ' : 'le ') + n.noun;
}

function grammarLessons(){ return (state.grammar && state.grammar.lessons) || []; }
function grammarNouns(){ return state.words.filter(w => w.type === 'nom' && frNoun(w)); }
function grammarVerbs(){ return state.words.filter(w => w.type === 'verbe').concat((state.grammar && state.grammar.verbs) || []); }

function buildGrammarPool(lesson){
  const want = id => lesson === 'all' || lesson === id;
  const rules = ((state.grammar && state.grammar.rules) || []).filter(r => want(r.lesson)).map(r => ({
    kind: 'rule', key: 'rule:' + r.q, prompt: r.q,
    choices: shuffle([{ text: r.a, ok: true, ar: !!r.ar }].concat(r.wrong.map(t => ({ text: t, ok: false, ar: !!r.ar })))),
    why: r.why || ''
  }));
  const app = [];
  if (want('pronoms')){
    for (const w of grammarNouns()){
      const n = frNoun(w); const stem = stripEnd(w.ar);
      const [b, l] = splitLast(stem);
      for (const p of POSS){
        const form = stem + p.end, fr = frPoss(n, p.id);
        const reveal = { base: b, end: l + p.end, fr: fr + p.ctx };
        app.push({ kind: 'poss-build', key: 'pb:' + w.id + p.id, word: w.id,
          prompt: 'Comment dit-on « ' + fr + ' »' + p.ctx + ' ?',
          choices: shuffle([{ text: form, ok: true, ar: true }].concat(pickOthers(POSS, p, 3).map(o => ({ text: stem + o.end, ok: false, ar: true })))),
          why: p.pron + ' = ' + p.label + '.', reveal });
        app.push({ kind: 'poss-mean', key: 'pm:' + w.id + p.id, word: w.id, promptAr: form, prompt: 'Que veut dire ce mot ?',
          choices: shuffle([{ text: fr + p.ctx, ok: true }].concat(pickOthers(POSS, p, 3).map(o => ({ text: frPoss(n, o.id) + o.ctx, ok: false })))),
          why: p.pron + ' = ' + p.label + '.', reveal });
        app.push({ kind: 'poss-tiles', key: 'pt:' + w.id + p.id, word: w.id, tiles: true, stem,
          prompt: 'Complète pour dire « ' + fr + ' »' + p.ctx + '.',
          choices: POSS.map(o => ({ text: o.tile, ok: o === p, ar: true })),
          why: p.pron + ' = ' + p.label + '.', reveal });
      }
      if (w.plural && n.plural){
        const pstem = stripEnd(w.plural); const [pb, pl] = splitLast(pstem);
        for (const p of POSS){
          const form = pstem + p.end, fr = frPoss(n, p.id, true);
          app.push({ kind: 'poss-plural', key: 'pp:' + w.id + p.id, word: w.id, promptAr: form, prompt: 'Que veut dire ce mot ? (' + w.plural + ' est le pluriel de ' + w.ar + ')',
            choices: shuffle([{ text: fr + p.ctx, ok: true }].concat([frNoun(w) && frPoss(n, p.id, false) + p.ctx].concat(pickOthers(POSS, p, 2).map(o => frPoss(n, o.id, true) + o.ctx)).map(t => ({ text: t, ok: false })))),
            why: 'Le nom est au pluriel, donc le pronom s’accorde : ' + fr + '.', reveal: { base: pb, end: pl + p.end, fr: fr + p.ctx } });
        }
      }
    }
  }
  if (want('nom')){
    const nouns = grammarNouns();
    const others = grammarVerbs().map(v => v.ar).concat(PARTICLES);
    for (const w of nouns){
      const n = frNoun(w); const stem = stripEnd(w.ar); const [b, l] = splitLast(stem);
      const def = frDef(n); const al = 'بِ' + withAl(stem);
      const [ab, alast] = splitLast(al);
      const inWhy = 'Après بِ, le nom indéfini se termine par « -in » (ـٍ).';
      const alWhy = 'Avec ال, le nom perd son tanwîn : il se termine par « -i » (ـِ) et non « -in ».';
      app.push({ kind: 'prep-build', key: 'nb:' + w.id, word: w.id, prompt: 'Comment dit-on « avec ' + w.fr + ' » ?',
        choices: shuffle([{ text: 'بِ' + stem + '\u064D', ok: true, ar: true }, { text: 'بِ' + stem + '\u064C', ok: false, ar: true }, { text: 'بِ' + stem + '\u064B\u0627', ok: false, ar: true }, { text: stem + '\u064D', ok: false, ar: true }]),
        why: inWhy, reveal: { pre: 'بِ', base: b, end: l + '\u064D', fr: 'avec ' + w.fr } });
      app.push({ kind: 'prep-tiles', key: 'nt:' + w.id, word: w.id, tiles: true, stem: 'بِ' + stem, prompt: 'Complète pour dire « avec ' + w.fr + ' ».',
        choices: [['ـٍ', true], ['ـٌ', false], ['ـً', false], ['ـْ', false]].map(([t, ok]) => ({ text: t, ok, ar: true })),
        why: inWhy, reveal: { pre: 'بِ', base: b, end: l + '\u064D', fr: 'avec ' + w.fr } });
      const tw = [['\u064C', '« -un »'], ['\u064B\u0627', '« -an »'], ['\u064D', '« -in »']][Math.floor(Math.random() * 3)];
      app.push({ kind: 'noun-spot', key: 'ns:' + w.id, word: w.id, prompt: 'Lequel de ces mots est forcément un nom ?',
        choices: shuffle([{ text: stem + tw[0], ok: true, ar: true }].concat(pickOthers(others, null, 3).map(t => ({ text: t, ok: false, ar: true })))),
        why: stem + tw[0] + ' porte un tanwîn : seuls les noms le portent.', reveal: { base: b, end: l + tw[0], fr: w.fr } });
      app.push({ kind: 'tanwin-sound', key: 'nw:' + w.id, word: w.id, promptAr: stem + tw[0], prompt: 'Comment entend-on la fin de ce mot ?',
        choices: shuffle(['« -un »', '« -an »', '« -in »', '« -u »'].map(t => ({ text: t, ok: t === tw[1] }))),
        why: 'ـٌ se lit « -un », ـً « -an » et ـٍ « -in » : c’est le tanwîn.', reveal: { base: b, end: l + tw[0], fr: w.fr } });
      app.push({ kind: 'al-build', key: 'na:' + w.id, word: w.id, prompt: 'Comment dit-on « avec ' + def + ' » ?',
        choices: shuffle([{ text: al + '\u0650', ok: true, ar: true }, { text: al + '\u064D', ok: false, ar: true }, { text: 'بِ' + stem + '\u064D', ok: false, ar: true }, { text: al + '\u064F', ok: false, ar: true }]),
        why: alWhy, reveal: { base: ab, end: alast + '\u0650', fr: 'avec ' + def } });
      app.push({ kind: 'al-mean', key: 'nm:' + w.id, word: w.id, promptAr: al + '\u0650', prompt: 'Que veut dire ce mot ?',
        choices: shuffle([{ text: 'avec ' + def, ok: true }, { text: 'avec ' + w.fr, ok: false }, { text: 'dans ' + def, ok: false }, { text: def.replace(/^./, c => c.toUpperCase()), ok: false }]),
        why: alWhy, reveal: { base: ab, end: alast + '\u0650', fr: 'avec ' + def } });
    }
  }
  if (want('passe')){
    for (const v of grammarVerbs()){
      const forms = conjugate(v); const inf = verbInf(v);
      for (const p of PERS){
        const form = forms[p.id];
        const [b, l] = splitLast(verbStem(v.ar));
        const end = p.id === '3m' ? l + '\u064E' : forms.merged ? form.slice(b.length) : l + p.tile.replace('ـ', '');
        const reveal = { base: b, end, fr: pcLabel(v, p.id) || (p.label + ' : ' + inf) };
        app.push({ kind: 'conj-build', key: 'cb:' + v.id + p.id, word: v.id,
          prompt: 'Conjugue « ' + v.ar + ' » (' + inf + ') au passé avec « ' + p.label + ' ».',
          choices: shuffle([{ text: form, ok: true, ar: true }].concat(pickOthers(PERS, p, 3).map(o => ({ text: forms[o.id], ok: false, ar: true })))),
          why: p.id === '3m' ? 'La forme de base correspond à « il ».' : 'Terminaison ' + p.tile + ' pour « ' + p.label + ' ».', reveal });
        app.push({ kind: 'conj-who', key: 'cw:' + v.id + p.id, word: v.id, promptAr: form, prompt: 'Qui a fait l’action ?',
          choices: shuffle([{ text: p.who, ok: true }].concat(pickOthers(PERS, p, 3).map(o => ({ text: o.who, ok: false })))),
          why: p.id === '3m' ? 'La forme de base correspond à « il ».' : 'Terminaison ' + p.tile + ' pour « ' + p.label + ' ».', reveal });
        if (v.pc){
          app.push({ kind: 'conj-mean', key: 'cm:' + v.id + p.id, word: v.id, promptAr: form, prompt: 'Que veut dire ce mot ?',
            choices: shuffle([{ text: pcLabel(v, p.id), ok: true }].concat(pickOthers(PERS, p, 3).map(o => ({ text: pcLabel(v, o.id), ok: false })))),
            why: p.id === '3m' ? 'La forme de base correspond à « il ».' : 'Terminaison ' + p.tile + ' pour « ' + p.label + ' ».', reveal });
        }
        if (!forms.merged){
          app.push({ kind: 'conj-tiles', key: 'ct:' + v.id + p.id, word: v.id, tiles: true, stem: verbStem(v.ar),
            prompt: 'Complète pour dire « ' + (pcLabel(v, p.id) || (p.label + ' : ' + inf)) + ' ».',
            choices: PERS.map(o => ({ text: o.tile, ok: o === p, ar: true })),
            why: p.id === '3m' ? 'La forme de base correspond à « il ».' : 'Terminaison ' + p.tile + ' pour « ' + p.label + ' ».', reveal });
        }
      }
    }
  }
  return { rules, app };
}
function sampleGrammar(lesson, count){
  const { rules, app } = buildGrammarPool(lesson);
  const total = Math.min(count, rules.length + app.length);
  const nRules = Math.min(rules.length, Math.round(total * 0.3));
  const picked = shuffle(rules.slice()).slice(0, nRules);
  const pool = shuffle(app.slice()); const used = new Set();
  for (const q of pool){
    if (picked.length >= total) break;
    if (used.has(q.kind + q.word) && pool.length > total * 2) continue;
    used.add(q.kind + q.word); picked.push(q);
  }
  for (const q of shuffle(app.slice())){ if (picked.length >= total) break; if (!picked.includes(q)) picked.push(q); }
  const out = shuffle(picked);
  for (let i = 1; i < out.length; i++){
    if (out[i].word && out[i].word === out[i - 1].word){
      for (let j = i + 1; j < out.length; j++){ if (out[j].word !== out[i - 1].word){ [out[i], out[j]] = [out[j], out[i]]; break; } }
    }
  }
  return out;
}

function startGrammar(lesson, override){
  const o = state.grammarOpts;
  const L = lesson || o.lesson;
  const queue = override || sampleGrammar(L, o.count === 'all' ? 999 : Number(o.count) || 10);
  if (!queue.length){ toast('Pas encore d’exercices pour cette leçon.'); return; }
  state.session = { kind: 'grammar', lesson: L, queue, idx: 0, answered: false, picked: -1, correct: 0, mistakes: [], finished: false, startedAt: Date.now(), histId: newId('h') };
  state.lessonId = null;
  render(); scrollTop();
}
function revealHtml(r){
  if (!r) return '';
  return '<div class="reveal"><p class="ar reveal-ar" lang="ar" dir="rtl">' + rowHtml(r) + '</p><p class="reveal-fr">' + esc(r.fr) + '</p></div>';
}
function renderGrammarQ(){
  const s = state.session;
  if (s.finished || s.idx >= s.queue.length){
    if (!s.finished){ s.finished = true; saveSessionRecord(s); }
    return renderGrammarEnd();
  }
  const q = s.queue[s.idx];
  const last = s.idx === s.queue.length - 1;
  let top = '';
  if (q.tiles) top = '<p class="ar big tiles-stem" lang="ar" dir="rtl"><span>' + esc(q.stem) + 'ـ</span><span class="slot">' + (s.answered ? esc(q.choices[s.picked].text) : '؟') + '</span></p>';
  else if (q.promptAr) top = '<p class="ar big" lang="ar" dir="rtl">' + esc(q.promptAr) + '</p>';
  const label = q.kind === 'rule' ? 'Règle' : q.kind.startsWith('poss') ? 'Pronoms' : q.kind.startsWith('conj') ? 'Conjugaison' : 'Le nom';
  const choices = '<div class="' + (q.tiles ? 'tiles' : 'choices') + '">' + q.choices.map((c, i) => {
    let cls = q.tiles ? 'tile' : 'choice';
    if (s.answered){ if (c.ok) cls += ' right'; else if (i === s.picked) cls += ' wrong'; }
    const txt = '<span class="txt' + (c.ar ? ' ar" lang="ar" dir="rtl' : '') + '">' + (c.ar ? esc(c.text) : arWrap(c.text)) + '</span>';
    return '<button type="button" class="' + cls + '" data-action="gpick" data-i="' + i + '"' + (s.answered ? ' aria-disabled="true"' : '') + '>' + (q.tiles ? '' : '<span class="key">' + (i + 1) + '</span>') + txt + '</button>';
  }).join('') + '</div>';
  let after = '';
  if (s.answered){
    const ok = q.choices[s.picked] && q.choices[s.picked].ok;
    after = '<p class="feedback ' + (ok ? 'ok' : 'ko') + '">' + (ok ? 'Juste' : 'Pas tout à fait') + (q.why ? ' : ' + arWrap(q.why) : '') + '</p>' +
      revealHtml(q.reveal) +
      '<div class="after"><button type="button" class="btn primary big" id="nextQ" data-action="gnext">' + (last ? 'Voir le résultat' : 'Question suivante') + '</button></div>';
  }
  setView('<section class="session">' +
    sessionTop('Question ' + (s.idx + 1) + ' sur ' + s.queue.length) +
    progressBar(s.idx / s.queue.length * 100) +
    '<div class="sheet card still compact gram-card">' +
      '<p class="sheet-meta"><span>' + label + '</span><span></span></p>' +
      '<div class="face front">' + top + '<p class="gram-q">' + arWrap(q.prompt) + '</p></div>' +
    '</div>' + choices + after +
    '</section>');
}
function gpick(i){
  const s = state.session; if (!s || s.kind !== 'grammar' || s.answered) return;
  const q = s.queue[s.idx]; if (!q.choices[i]) return;
  s.answered = true; s.picked = i;
  if (q.choices[i].ok) s.correct++; else s.mistakes.push(q);
  renderSession();
  const n = $('#nextQ'); if (n) n.focus({ preventScroll: true });
}
function gnext(){
  const s = state.session; if (!s || s.kind !== 'grammar' || !s.answered) return;
  s.idx++; s.answered = false; s.picked = -1;
  if (s.idx >= s.queue.length){ s.finished = true; saveSessionRecord(s); }
  renderSession(); scrollTop();
}
function renderGrammarEnd(){
  const s = state.session;
  const total = s.queue.length; const pct = total ? Math.round(s.correct / total * 100) : 0;
  const praise = pct >= 90 ? ['مُمْتَازٌ', 'Excellent'] : pct >= 70 ? ['جَيِّدٌ جِدًّا', 'Très bien'] : pct >= 50 ? ['جَيِّدٌ', 'Bien'] : ['حَاوِلْ مَرَّةً أُخْرَى', 'Essaie encore'];
  setView('<section class="session stack">' +
    '<div class="sheet card end">' +
      '<p class="end-ar praise" lang="ar" dir="rtl">' + praise[0] + '</p>' +
      '<p class="score">' + s.correct + ' / ' + total + '</p>' +
      '<p>' + praise[1] + ', ' + pct + ' % de bonnes réponses.</p>' +
    '</div>' +
    (s.mistakes.length ? '<h2 class="h2">À retravailler</h2><ul class="mistakes">' + s.mistakes.map(q =>
      '<li><span class="mq">' + (q.promptAr ? '<bdi class="ari" lang="ar" dir="rtl">' + esc(q.promptAr) + '</bdi> ' : '') + arWrap(q.prompt) + '</span>' +
      '<span class="ma">' + arWrap((q.choices.find(c => c.ok) || {}).text || '') + '</span></li>').join('') + '</ul>' : '') +
    '<div class="actions">' +
      (s.mistakes.length ? '<button type="button" class="btn primary big" data-action="gretry">Refaire les erreurs</button>' : '') +
      '<button type="button" class="btn ' + (s.mistakes.length ? 'ghost' : 'primary') + ' big" data-action="quit">Retour</button>' +
    '</div>' +
    '</section>');
}

function lessonLabel(id){ const l = grammarLessons().find(x => x.id === id); return l ? l.title : 'toutes les leçons'; }
function renderGrammar(){
  const lessons = grammarLessons();
  if (!lessons.length){
    let body;
    if (state.grammar) body = '<p class="lead">Les leçons de grammaire ne sont pas encore disponibles.</p>';
    else if (state.grammarError) body = '<p class="lead">Impossible de charger les leçons de grammaire.</p>' +
      '<button type="button" class="btn primary big" data-action="greload">Réessayer</button>' +
      '<p class="hint">Vérifie ta connexion. Si le problème continue, ferme complètement l’app puis rouvre-la.</p>';
    else { body = '<p class="loading">Chargement des leçons…</p>'; loadGrammar(true).then(afterGrammarLoad); }
    setView('<section class="stack"><h1 class="h1">Grammaire</h1>' + notes() + body + '</section>');
    return;
  }
  const o = state.grammarOpts;
  if (o.lesson !== 'all' && !lessons.some(l => l.id === o.lesson)) o.lesson = 'all';
  const lastRun = state.history.filter(h => h.type === 'grammar' && h.total).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  const lessonOpts = lessons.map(l => [l.id, l.title.replace(/^Les? /, '').replace(/^./, c => c.toUpperCase())]).concat([['all', 'Toutes les leçons']]);
  const lessonCtl = lessonOpts.length <= 3
    ? seg('glesson', o.lesson, lessonOpts, 'gLessonLabel')
    : '<select id="gLessonSel">' + lessonOpts.map(([v, l]) => '<option value="' + v + '"' + (o.lesson === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
  setView('<section class="stack">' +
    '<h1 class="h1">Grammaire</h1>' + notes() +
    '<div class="sheet gram-hero"><p class="sheet-meta"><span>' + plural(lessons.length, 'leçon', 'leçons') + '</span><span>' + esc(lessons.map(l => 'semaine ' + l.week).filter((v, i, a) => a.indexOf(v) === i).join(', ')) + '</span></p>' +
      '<p class="ar gram-hero-ar" lang="ar" dir="rtl">' + highlight('دَرَ', 'سْتُ') + ' ' + highlight('كِتَا', 'بُكَ') + '</p></div>' +
    '<h2 class="h2">S’entraîner</h2>' +
    '<p class="hint">Des questions sur les règles et des exercices construits avec le vocabulaire du cours. Ils s’enrichissent à chaque nouvelle semaine.</p>' +
    (lessonOpts.length <= 3 ? '<div class="field"><span class="label" id="gLessonLabel">Leçon</span>' + lessonCtl + '</div>' : '<label class="field"><span class="label">Leçon</span>' + lessonCtl + '</label>') +
    '<div class="field"><span class="label" id="gCountLabel">Nombre de questions</span>' + seg('gcount', String(o.count), [['10', '10'], ['20', '20']], 'gCountLabel') + '</div>' +
    '<button type="button" class="btn primary big" data-action="gstart">Commencer les exercices</button>' +
    (lastRun ? '<p class="hint">Dernier entraînement : ' + lastRun.correct + ' / ' + lastRun.total + ', ' + esc(fmtShort(lastRun.at)) + '.</p>' : '') +
    '<h2 class="h2">Leçons</h2>' +
    '<div class="modes">' + lessons.map(l =>
      '<button type="button" class="mode" data-action="lesson" data-id="' + esc(l.id) + '"><span class="mode-text"><b>' + esc(l.title) + (isSpotlit(l) ? ' <span class="new-chip">Nouveau</span>' : '') + '</b><span>' + arWrap(l.subtitle) + ', semaine ' + l.week + '</span></span>' + ICON.chevron + '</button>').join('') +
    '</div>' +
    '</section>');
}
function rowHtml(r){
  if (r.plain) return esc((r.pre || '') + (r.base || '') + (r.end || ''));
  return '<span class="w">' + (r.pre ? '<span class="hl">' + esc(r.pre) + '</span>' : '') + '<span>' + esc(r.base || '') + '</span>' + (r.end ? '<span class="hl">' + esc(r.end) + '</span>' : '') + '</span>';
}
function lessonRows(rows){
  return '<ul class="lesson-rows">' + rows.map((r, i) =>
    '<li><div class="lr-ar"><p class="ar" lang="ar" dir="rtl">' + rowHtml(r) + '</p>' +
      (r.audio ? '<button type="button" class="icon-btn" data-action="lplay" data-src="' + esc(r.audio) + '" aria-label="Écouter">' + ICON.speaker + '</button>' : '') + '</div>' +
      '<div class="lr-fr"><b>' + esc(r.fr) + '</b><span>' + arWrap(r.label || '') + '</span></div></li>').join('') + '</ul>';
}
function lessonBlock(b){
  if (b.type === 'h') return '<h2 class="h2 lesson-h">' + arWrap(b.text) + '</h2>';
  if (b.type === 'text') return '<p class="lesson-text">' + arWrap(b.text) + '</p>';
  if (b.type === 'note') return '<p class="note rule-note">' + arWrap(b.text) + '</p>';
  if (b.type === 'rows') return '<div class="sheet lesson-sheet">' + lessonRows(b.rows || []) + '</div>';
  if (b.type === 'quote') return '<figure class="quote"><p class="ar quote-ar" lang="ar" dir="rtl">' + esc(b.ar) + '</p>' +
    '<figcaption>' + (b.audio ? '<button type="button" class="icon-btn" data-action="lplay" data-src="' + esc(b.audio) + '" aria-label="Écouter">' + ICON.speaker + '</button>' : '') +
    '<span>' + arWrap(b.fr || '') + '</span></figcaption></figure>';
  return '';
}
function renderLesson(){
  const l = grammarLessons().find(x => x.id === state.lessonId);
  if (!l){ state.lessonId = null; return render(); }
  setView('<section class="stack">' +
    '<button type="button" class="btn text" data-action="lesson-back">Retour</button>' +
    '<h1 class="h1">' + esc(l.title) + '</h1>' +
    '<p class="hint">' + arWrap(l.subtitle) + ', semaine ' + l.week + '</p>' +
    '<p class="lead">' + arWrap(l.intro) + '</p>' +
    (l.blocks ? l.blocks.map(lessonBlock).join('') : '<div class="sheet lesson-sheet">' + lessonRows(l.rows || []) + '</div>') +
    (l.extra && l.extra.length ? '<h2 class="h2">Au pluriel</h2><div class="sheet lesson-sheet">' + lessonRows(l.extra) + '</div>' : '') +
    (l.notes || []).map(n => '<p class="note rule-note">' + arWrap(n) + '</p>').join('') +
    (l.legend ? '<p class="hint">' + esc(l.legend) + '</p>' : '') +
    '<button type="button" class="btn primary big" data-action="lesson-train" data-id="' + esc(l.id) + '">S’entraîner sur cette leçon</button>' +
    '</section>');
}
function playSrc(src, btn){
  try {
    if (currentAudio){ currentAudio.pause(); currentAudio = null; }
    const a = new Audio(src); currentAudio = a;
    if (btn) btn.classList.add('playing');
    a.onended = () => { if (btn) btn.classList.remove('playing'); };
    a.onerror = () => { if (btn) btn.classList.remove('playing'); toast('Audio indisponible.'); };
    const p = a.play(); if (p && p.catch) p.catch(() => { if (btn) btn.classList.remove('playing'); });
  } catch(e){}
}

/* "New" announcement, shown once */
function maybeAnnounceGrammar(){
  if (lsGet(K_NEWGRAM) === '1' || !grammarLessons().length || state.session) return;
  if ($('#newFeature')) return;
  const letters = ['ي', 'كَ', 'كِ', 'كُمَا', 'كُمْ', 'ـَتْ', 'ـْتَ', 'ـْتِ', 'ـْتُ', 'دَرَسَ', 'كِتَابِي', 'ي', 'كُمْ', 'ـْتُ'];
  const el = document.createElement('div');
  el.id = 'newFeature'; el.className = 'nf'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'nfTitle');
  el.innerHTML = '<div class="nf-letters" aria-hidden="true">' + letters.map(t => '<span lang="ar" dir="rtl">' + t + '</span>').join('') + '</div>' +
    '<div class="nf-card">' +
      '<span class="nf-chip">Nouveau</span>' +
      '<p class="nf-ar" lang="ar" dir="rtl">قَوَاعِدُ</p>' +
      '<h2 class="nf-title" id="nfTitle">La grammaire arrive dans l’app</h2>' +
      '<p class="nf-text">Les leçons sur les pronoms et le passé, des questions sur les règles et des exercices construits avec ton vocabulaire.</p>' +
      '<button type="button" class="btn primary big" data-action="nf-open">Découvrir</button>' +
      '<button type="button" class="btn text big" data-action="nf-close">Plus tard</button>' +
    '</div>';
  el.querySelectorAll('.nf-letters span').forEach((s, i) => {
    s.style.left = (4 + (i * 37) % 92) + '%';
    s.style.animationDelay = ((i * 0.37) % 2.6).toFixed(2) + 's';
    s.style.animationDuration = (5 + (i % 4)).toFixed(1) + 's';
    s.style.fontSize = (22 + (i * 7) % 26) + 'px';
  });
  document.body.appendChild(el);
  lsSet(K_NEWGRAM, '1');
  const btn = el.querySelector('[data-action="nf-open"]'); if (btn) btn.focus({ preventScroll: true });
}
function closeAnnouncement(open){
  const el = $('#newFeature');
  if (el){ el.classList.add('closing'); setTimeout(() => el.remove(), 260); }
  if (open){ switchTab('grammar'); }
}
function spotlight(){
  const sp = state.grammar && state.grammar.spotlight;
  return sp && sp.until && dayKey(Date.now()) <= sp.until ? sp : null;
}
function isSpotlit(l){
  const sp = spotlight();
  return !!(sp && l && (sp.lesson === l.id || (sp.lessons || []).includes(l.id) || (sp.week && Number(sp.week) === Number(l.week))));
}
function refreshGrammarBadge(){
  const b = document.querySelector('.tabs button[data-tab="grammar"]');
  if (!b) return;
  const sp = spotlight();
  b.classList.toggle('spotlight', !!sp);
  b.classList.toggle('has-new', !!sp || (lsGet(K_GRAMVISIT) !== '1' && grammarLessons().length > 0));
}

function grammarStats(){
  const runs = state.history.filter(h => h.type === 'grammar' && h.total).sort((a, b) => (b.at || 0) - (a.at || 0));
  if (!grammarLessons().length) return '';
  if (!runs.length) return '<div class="section"><h2 class="h2">Grammaire</h2><p class="hint">Aucun exercice pour l’instant. Lance-toi depuis l’onglet Grammaire.</p></div>';
  const avg = Math.round(runs.reduce((a, h) => a + h.correct / h.total, 0) / runs.length * 100);
  return '<div class="section"><h2 class="h2">Grammaire</h2>' +
    '<p class="lead">' + plural(runs.length, 'entraînement', 'entraînements') + ', moyenne de ' + avg + ' %.</p>' +
    '<ul class="exam-list">' + runs.slice(0, 6).map(h => '<li><span>' + esc(fmtShort(h.at)) + ', ' + esc(lessonLabel(h.lesson)) + '</span><b>' + h.correct + ' / ' + h.total + '</b></li>').join('') + '</ul></div>';
}

/* Settings */
function audioSettings(){
  const opts = TTS.voices.length > 1
    ? '<label class="field"><span class="label">Voix arabe de l’appareil</span><select id="voiceSel">' +
      TTS.voices.map(v => '<option value="' + esc(v.voiceURI) + '"' + (TTS.voice && v.voiceURI === TTS.voice.voiceURI ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select></label>'
    : '';
  return '<div class="field"><span class="label">Prononciation</span>' +
    '<p class="hint">Les mots du cours ont une prononciation intégrée. S’il en manque une, l’app utilise la voix arabe de l’appareil si elle existe.</p>' +
    '<div class="track"><ul><li><span>Voix de cet appareil</span><span>' + esc(deviceVoiceStatus()) + '</span></li></ul></div>' +
    opts +
    (TTS.supported ? '<button type="button" class="btn ghost big" data-action="test-voice">Tester la voix de l’appareil</button>' : '') +
    '</div>';
}
function renderSettings(){
  const updated = Store.meta && Store.meta.updated ? ' Vocabulaire mis à jour le ' + esc(fmtLong(new Date(Store.meta.updated + 'T12:00:00').getTime())) + '.' : '';
  setView('<section class="stack">' +
    '<div class="head-row"><h1 class="h1">Réglages</h1><button type="button" class="btn text" data-action="close-settings">Fermer</button></div>' +
    (Cloud.status === 'disabled' ? '' : '<div class="field" id="accountBox">' + accountHtml() + '</div><div class="field" id="notifBox">' + notifHtml() + '</div>') +
    '<div class="field"><span class="label" id="fontLabel">Police de l’arabe</span>' +
      '<div class="font-list" role="radiogroup" aria-labelledby="fontLabel">' + FONTS.map(f =>
        '<button type="button" class="font-opt" role="radio" aria-checked="' + (state.font === f.id) + '" data-action="font" data-value="' + f.id + '">' +
          '<span class="font-meta"><b>' + f.name + '</b><span>' + f.desc + '</span></span>' +
          '<span class="font-sample" lang="ar" dir="rtl" data-font="' + esc(f.family) + '">كَاتِبٌ</span></button>').join('') +
      '</div></div>' +
    '<div class="field"><span class="label" id="sizeLabel">Taille de l’arabe</span>' + seg('size', state.arSize, [['normal', 'Normale'], ['large', 'Grande']], 'sizeLabel') + '</div>' +
    '<div class="sheet preview"><p class="sheet-meta"><span>Aperçu</span></p><p class="ar" lang="ar" dir="rtl">كَتَبَ كَاتِبٌ كِتَابٌ</p></div>' +
    audioSettings() +
    '<div class="field"><span class="label">Ma progression</span>' +
      '<p class="hint">' + (Cloud.user ? 'Tu peux aussi garder une copie de ta progression dans un fichier.' : 'Sans compte, ta progression est enregistrée sur cet appareil uniquement. Avant de changer de téléphone, sauvegarde-la, puis restaure le fichier sur le nouveau.') + '</p>' +
      '<div class="actions">' +
        '<button type="button" class="btn ghost big" data-action="export">Sauvegarder ma progression</button>' +
        '<label class="btn ghost big" for="importFile">Restaurer une sauvegarde</label>' +
        '<input type="file" id="importFile" class="sr" accept=".json,application/json">' +
        '<button type="button" class="btn danger big" data-action="reset">' + (state.confirmReset ? (Cloud.user ? 'Confirmer : tout effacer, aussi en ligne' : 'Confirmer : tout effacer') : 'Effacer ma progression') + '</button>' +
      '</div></div>' +
    '<p class="about">Version ' + APP_VERSION + '.' + updated + '</p>' +
    '</section>');
}
function exportProgress(){
  const data = { app: 'vocabulaire-arabe', format: 1, exportedAt: new Date().toISOString(), progress: Store.progress, history: Store.history };
  const name = 'progression-vocabulaire-arabe-' + dayKey(Date.now()) + '.json';
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  if (isTouch()){
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })){
        navigator.share({ files: [file], title: 'Ma progression' }).catch(() => {});
        return;
      }
    } catch(e){}
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('Sauvegarde téléchargée');
}
function importProgress(file){
  const reader = new FileReader();
  reader.onload = () => {
    let data = null;
    try { data = JSON.parse(reader.result); } catch(e){}
    if (!data || data.app !== 'vocabulaire-arabe' || typeof data.progress !== 'object'){
      toast('Ce fichier n’est pas une sauvegarde de l’app.'); return;
    }
    const n = Store.merge(data);
    toast(n ? 'Progression restaurée pour ' + plural(n, 'mot', 'mots') + '.' : 'Rien de plus récent dans cette sauvegarde.');
    render();
  };
  reader.onerror = () => toast('Impossible de lire ce fichier.');
  reader.readAsText(file);
}

/* ---------- events ---------- */
function switchTab(t){
  if (state.session) return;
  state.tab = t; state.setup = null; state.settings = false; state.detailId = null; state.lessonId = null;
  if (t === 'grammar'){ lsSet(K_GRAMVISIT, '1'); refreshGrammarBadge(); if (!state.grammar) state.grammarError = ''; }
  render(); scrollTop();
}
function setOpt(name, value){
  if (name === 'dir'){ state.dir = value; lsSet(LS + 'dir', value); if (pushOn()){ const api = Cloud.api(); if (api) api.updateNotifSettings({ dirs: value }).catch(() => {}); } }
  else if (name === 'order' || name === 'faces'){ state.browseOpts[name] = value; lsSet(LS + 'browse', JSON.stringify(state.browseOpts)); }
  else if (name === 'format'){ state.examOpts.format = value; lsSet(LS + 'exam', JSON.stringify(state.examOpts)); }
  else if (name === 'count'){ state.examOpts.count = value === 'all' ? 'all' : Number(value); lsSet(LS + 'exam', JSON.stringify(state.examOpts)); }
  else if (name === 'size'){ state.arSize = value; lsSet(LS + 'size', value); applyLook(); }
  else if (name === 'lbperiod' || name === 'lbmetric'){ LB[name === 'lbperiod' ? 'period' : 'metric'] = value; lsSet(LS + name.replace('lb', 'lb-'), value); }
  else if (name === 'glesson' || name === 'gcount'){ state.grammarOpts[name === 'glesson' ? 'lesson' : 'count'] = name === 'gcount' ? Number(value) : value; lsSet(LS + 'gopts', JSON.stringify(state.grammarOpts)); }
  render();
}
function quitSession(){
  const s = state.session; if (s) saveSessionRecord(s);
  state.session = null; render(); scrollTop();
}

let suppressClick = false;
document.addEventListener('click', e => {
  if (suppressClick){ e.preventDefault(); return; }
  if (state.session && state.session.tick) trackTime(state.session);
  const link = e.target.closest('a');
  if (link){ if (link.id === 'audioLink') $('#audioHelp').hidden = true; return; }
  const t = e.target.closest('[data-action], [data-tab]');
  if (!t) return;
  if (t.dataset.tab){ switchTab(t.dataset.tab); return; }
  switch (t.dataset.action){
    case 'opt': setOpt(t.dataset.name, t.dataset.value); break;
    case 'start-srs': startSrs(); break;
    case 'setup': state.setup = t.dataset.mode; render(); scrollTop(); break;
    case 'setup-back': state.setup = null; render(); scrollTop(); break;
    case 'start-browse': startBrowse(); break;
    case 'restart-browse': state.session = null; startBrowse(); break;
    case 'start-exam': startExam(); break;
    case 'retry-mistakes': { const s = state.session; if (s && s.mistakes.length) startExam(s.mistakes.slice()); break; }
    case 'reveal': reveal(); break;
    case 'rate': rate(t.dataset.r); break;
    case 'flip': flip(); break;
    case 'prev': browseMove(-1); break;
    case 'next': browseMove(1); break;
    case 'pick': pick(Number(t.dataset.i)); break;
    case 'override': override(); break;
    case 'next-q': nextQ(); break;
    case 'quit': quitSession(); break;
    case 'speak': { const w = wordById(t.dataset.id); if (w) playWord(w, t); break; }
    case 'test-voice': speakTts('كِتَابٌ', t, true); break;
    case 'close-audio': $('#audioHelp').hidden = true; break;
    case 'settings': if (!state.session){ state.settings = true; state.confirmReset = false; render(); scrollTop(); } break;
    case 'close-settings': state.settings = false; render(); scrollTop(); break;
    case 'font': state.font = t.dataset.value; lsSet(LS + 'font', state.font); applyLook(); renderSettings(); break;
    case 'export': exportProgress(); break;
    case 'reset':
      if (!state.confirmReset){ state.confirmReset = true; renderSettings(); break; }
      state.confirmReset = false; Store.reset(); toast('Progression effacée'); renderSettings(); break;
    case 'install': if (installEvent){ installEvent.prompt(); installEvent.userChoice.finally(() => { installEvent = null; render(); }); } break;
    case 'dismiss-install': state.installDismissed = true; lsSet(LS + 'install-dismissed', '1'); render(); break;
    case 'dismiss-account': state.accountDismissed = true; lsSet(LS + 'account-dismissed', '1'); render(); break;
    case 'go-account': { state.settings = true; state.confirmReset = false; render(); const el = $('#accountBox'); if (el) el.scrollIntoView({ block: 'start' }); break; }
    case 'auth-google': authAction('google'); break;
    case 'notif-on': enableReminders(); break;
    case 'gstart': startGrammar(); break;
    case 'lb-refresh': LB.error = ''; LB.list = null; loadLeaderboard(); renderStats(); break;
    case 'lb-leave': leaveLeaderboard(); break;
    case 'lb-rejoin': rejoinLeaderboard(); break;
    case 'go-lb-settings': { state.settings = true; state.confirmReset = false; render(); const el = $('#lbSettings'); if (el){ el.scrollIntoView({ block: 'center' }); const i = $('#lbName'); if (i) i.focus({ preventScroll: true }); } break; }
    case 'greload': state.grammarError = ''; renderGrammar(); break;
    case 'gpick': gpick(Number(t.dataset.i)); break;
    case 'gnext': gnext(); break;
    case 'gretry': { const s = state.session; if (s && s.mistakes.length){ const q = s.mistakes.map(m => Object.assign({}, m, { choices: shuffle(m.choices.slice()) })); startGrammar(s.lesson, q); } break; }
    case 'lesson': state.lessonId = t.dataset.id; render(); scrollTop(); break;
    case 'lesson-back': state.lessonId = null; render(); scrollTop(); break;
    case 'lesson-train': startGrammar(t.dataset.id); break;
    case 'lplay': playSrc(t.dataset.src, t); break;
    case 'nf-open': closeAnnouncement(true); break;
    case 'nf-close': closeAnnouncement(false); break;
    case 'notif-off': disableReminders(); break;
    case 'auth-signup': authAction('signup'); break;
    case 'auth-reset': authAction('reset'); break;
    case 'auth-signout': { Cloud.flush(); const api = Cloud.api(); if (api) api.signOut().then(() => toast('Déconnecté. Ta progression reste aussi sur cet appareil.')).catch(() => {}); break; }
    case 'go-planning': {
      state.tab = 'stats'; state.setup = null; state.detailId = null; render();
      const el = $('#forecast'); if (el) el.scrollIntoView({ block: 'start' });
      break;
    }
    case 'detail': state.detailId = t.dataset.id; render(); scrollTop(); break;
    case 'close-detail': state.detailId = null; render(); break;
    case 'review-week': state.scope = Number(t.dataset.week); state.tab = 'review'; state.setup = null; state.detailId = null; render(); scrollTop(); break;
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'scopeSel'){ state.scope = e.target.value === 'all' ? 'all' : Number(e.target.value); renderReview(); }
  else if (e.target.id === 'notifHour'){ changeReminderHour(Number(e.target.value)); }
  else if (e.target.id === 'gLessonSel'){ state.grammarOpts.lesson = e.target.value; lsSet(LS + 'gopts', JSON.stringify(state.grammarOpts)); }
  else if (e.target.id === 'voiceSel'){ TTS.pref = e.target.value; lsSet(LS + 'voice', TTS.pref); pickVoice(); renderSettings(); }
  else if (e.target.id === 'importFile' && e.target.files && e.target.files[0]){ importProgress(e.target.files[0]); e.target.value = ''; }
});
document.addEventListener('input', e => {
  if (e.target.id === 'searchInput'){ state.search = e.target.value; renderListItems(); }
});
document.addEventListener('submit', e => {
  if (e.target.id === 'examForm') submitExam(e);
  else if (e.target.id === 'authForm'){ e.preventDefault(); authAction('signin'); }
  else if (e.target.id === 'lbForm'){ e.preventDefault(); joinLeaderboard(($('#lbName') || {}).value); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#newFeature')){ closeAnnouncement(false); return; }
  const s = state.session; if (!s) return;
  if (s.tick) trackTime(s);
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const onButton = e.target.closest && e.target.closest('button, a');
  if (s.kind === 'srs'){
    if (s.idx >= s.queue.length) return;
    if (!s.revealed){ if ((e.key === ' ' || e.key === 'Enter') && !onButton){ e.preventDefault(); reveal(); } return; }
    const map = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
    if (map[e.key]){ e.preventDefault(); rate(map[e.key]); }
  } else if (s.kind === 'browse'){
    if (s.ended) return;
    if (e.key === 'ArrowRight'){ e.preventDefault(); browseMove(1); }
    else if (e.key === 'ArrowLeft'){ e.preventDefault(); browseMove(-1); }
    else if (e.key === ' ' && !onButton){ e.preventDefault(); flip(); }
  } else if (s.kind === 'grammar'){
    if (s.finished || s.idx >= s.queue.length) return;
    if (!s.answered && /^[1-5]$/.test(e.key)){ e.preventDefault(); gpick(Number(e.key) - 1); }
    else if (s.answered && e.key === 'Enter' && !onButton){ e.preventDefault(); gnext(); }
  } else if (s.kind === 'exam'){
    if (s.finished) return;
    if (s.format === 'qcm' && !s.answered && /^[1-4]$/.test(e.key)){ e.preventDefault(); pick(Number(e.key) - 1); }
  }
});

let touch = null;
view.addEventListener('touchstart', e => {
  const s = state.session;
  if (!s || s.kind !== 'browse' || s.ended){ touch = null; return; }
  const t = e.changedTouches[0]; touch = { x: t.clientX, y: t.clientY };
}, { passive: true });
view.addEventListener('touchend', e => {
  if (!touch) return;
  const t = e.changedTouches[0]; const dx = t.clientX - touch.x; const dy = t.clientY - touch.y; touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5){
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
    if (state.session) trackTime(state.session);
    browseMove(dx < 0 ? 1 : -1);
  }
}, { passive: true });

/* ---------- start ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist){ navigator.storage.persist().catch(() => {}); }

setTimeout(() => { if (Cloud.status === 'loading'){ Cloud.status = 'unavailable'; refreshCloudUi(); } }, 15000);

Store.loadLocal();
render();
Store.loadWords().then(() => {
  state.loaded = true;
  render();
  refreshGrammarBadge();
  setTimeout(maybeAnnounceGrammar, 600);
  warmAudioCache();
});
})();
