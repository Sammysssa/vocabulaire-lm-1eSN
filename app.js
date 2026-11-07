/* Vocabulaire arabe — application de révision.
   Le vocabulaire vient de words.json ; la progression de chaque élève reste dans son navigateur. */
(function(){
'use strict';

const APP_VERSION = '1.12.0';
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
  pen: '<svg class="pen" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
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
  if (days < 365){ const m = Math.round(days / 30 * 10) / 10; return String(m).replace('.', ',') + ' mois'; }
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
  reviseMode: ['grammar', 'conj'].includes(lsGet(LS + 'revise-mode')) ? lsGet(LS + 'revise-mode') : 'vocab',
  gramSection: lsGet(LS + 'gsection') === 'conjugaison' ? 'conjugaison' : 'grammaire', conjVerb: null,
  grammarOpts: lsJson(LS + 'gopts', { lesson: 'all', count: 10, num: 'all' }),
  practice: null, devoirs: null, devoirsOpen: null,
  trOpts: lsJson(LS + 'tr', { src: 'cours', count: 5 }),
  blankOpts: lsJson(LS + 'blank', { week: 'last', timer: '10' })
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
      type: w.type || '', pc: w.pc || null, fr_plural: w.fr_plural || '', added: w.added || '', trans: !!w.trans,
      pres: w.pres || '', pr: w.pr && typeof w.pr === 'object' ? w.pr : null
    }));
    this.rebuild();
    await Promise.all([loadGrammar(), loadDevoirs()]);
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
    else if (d.type === 'user'){ this.onUser(d.user); Reports.admin = false; Reports.list = null; if (d.user) setTimeout(checkAdmin, 500); }
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
  if (state.lessonId || state.conjVerb) return;
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
  /* A sentence written on paper takes longer than a quiz question. */
  if (h.type === 'translation') return (h.correct || 0) * 3 + (h.close || 0) * 2 + Math.max(0, (h.total || 0) - (h.correct || 0) - (h.close || 0));
  if (h.type === 'blank') return 5 + (h.correct || 0);
  return 0;
}
function recSecs(h){
  if (typeof h.secs === 'number') return h.secs;
  if (h.type === 'review') return (h.answers || 0) * 8;
  if (h.type === 'browse') return (h.seen || 0) * 5;
  return (h.total || 0) * 10;
}
/* The class week runs from Monday 19:00 to the next Monday 19:00, Paris time.
   Its key is the date of the Monday it starts on (YYYY-MM-DD). */
const WEEK_TZ = 'Europe/Paris', WEEK_START_HOUR = 19;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function parisParts(t){
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: WEEK_TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
  const p = {}; parts.forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second, dow: WEEKDAYS.indexOf(p.weekday) };
}
function weekKey(t){
  const p = parisParts(t);
  let back = p.dow;
  if (p.dow === 0 && p.h < WEEK_START_HOUR) back = 7;
  return new Date(Date.UTC(p.y, p.m - 1, p.d - back)).toISOString().slice(0, 10);
}
function parisTime(y, m, d, h){
  /* Timestamp of a Paris wall-clock time (handles summer and winter time). */
  let guess = Date.UTC(y, m - 1, d, h);
  for (let i = 0; i < 2; i++){
    const p = parisParts(guess);
    guess -= Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Date.UTC(y, m - 1, d, h);
  }
  return guess;
}
function weekEnd(t){
  const [y, m, d] = weekKey(t).split('-').map(Number);
  return parisTime(y, m, d + 7, WEEK_START_HOUR);
}
function fmtCountdown(ms){
  const min = Math.max(0, Math.round(ms / 60000));
  const dd = Math.floor(min / 1440), hh = Math.floor((min % 1440) / 60), mm = min % 60;
  if (dd) return dd + ' j ' + hh + ' h';
  if (hh) return hh + ' h ' + String(mm).padStart(2, '0');
  return mm + ' min';
}
/* "Nouveau" sticker: content added during the current class week (until Monday 19:00). */
function isNewItem(x){
  if (!x || !x.added) return false;
  const t = Date.parse(x.added);
  return !isNaN(t) && weekKey(t) === weekKey(Date.now());
}
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
  const end = weekEnd(Date.now());
  const endTxt = '<p class="lb-end">Fin de la semaine : ' + esc(new Date(end).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: WEEK_TZ })) + ' à 19 h, dans ' + fmtCountdown(end - Date.now()) + '</p>';
  return head + (LB.period === 'week' ? endTxt : '') +
    '<div class="field"><span class="label sr" id="lbPeriodL">Période</span>' + seg('lbperiod', LB.period, [['week', 'Cette semaine'], ['total', 'Depuis le début']], 'lbPeriodL') + '</div>' +
    '<div class="field"><span class="label sr" id="lbMetricL">Critère</span>' + seg('lbmetric', LB.metric, [['secs', 'Temps de révision'], ['points', 'Points']], 'lbMetricL') + '</div>' +
    list +
    '<p class="hint">' + (LB.metric === 'points' ? '1 point par carte réussie en révision, 2 points par bonne réponse en examen et en grammaire. ' : 'Temps passé à réviser, faire défiler, passer des examens ou faire de la grammaire. ') + 'Le classement de la semaine s’arrête chaque lundi à 19 h (heure de Paris), puis repart à zéro.</p>' +
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

/* ---------- error reports ---------- */
const Reports = { ctx: null, admin: false, list: null, loading: false, showDone: false };
function reportLink(action, label){
  return '<button type="button" class="btn text report-link" data-action="' + action + '">' + (label || 'Signaler une erreur') + '</button>';
}
function openReport(ctx){
  Reports.ctx = ctx;
  closeReport();
  const el = document.createElement('div');
  el.id = 'reportSheet'; el.className = 'rp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'rpTitle');
  const signedIn = !!(Cloud.user && Cloud.api());
  el.innerHTML = '<div class="rp-card">' +
    '<h2 class="h2" id="rpTitle">Signaler une erreur</h2>' +
    (ctx.question ? '<div class="rp-block"><span class="label">' + esc(ctx.questionLabel || 'Question') + '</span><p>' + arWrap(ctx.question) + '</p></div>' : '') +
    (ctx.answer ? '<div class="rp-block rp-answer"><span class="label">' + esc(ctx.answerLabel || 'Correction de l’app') + '</span><p>' + arWrap(ctx.answer) + '</p>' + (ctx.why ? '<p class="hint">' + arWrap(ctx.why) + '</p>' : '') + '</div>' : '') +
    (ctx.given ? '<div class="rp-block"><span class="label">Ta réponse</span><p>' + arWrap(ctx.given) + '</p></div>' : '') +
    (signedIn
      ? '<p class="rp-ask">' + (ctx.answer ? 'Relis bien la correction ci-dessus. Si elle est fausse (traduction, voyelles, audio, question…), explique ce qui ne va pas :' : 'Explique ce qui ne va pas (texte, voyelles, audio…) :') + '</p>' +
        '<label class="sr" for="rpText">Ce qui ne va pas</label><textarea id="rpText" rows="3" maxlength="1000" placeholder="Exemple : la traduction devrait être…"></textarea>' +
        '<p class="err" id="rpMsg" hidden></p>' +
        '<button type="button" class="btn primary big" data-action="rp-send">Envoyer le signalement</button>' +
        '<button type="button" class="btn ghost big" data-action="rp-close">' + (ctx.answer ? 'La correction est juste, annuler' : 'Annuler') + '</button>'
      : '<p class="rp-ask">Connecte-toi pour signaler une erreur : ton signalement sera transmis à l’auteur de l’app.</p>' +
        '<button type="button" class="btn primary big" data-action="rp-login">Me connecter</button>' +
        '<button type="button" class="btn ghost big" data-action="rp-close">Annuler</button>') +
    '</div>';
  document.body.appendChild(el);
  const t = $('#rpText'); if (t) t.focus({ preventScroll: true });
}
function closeReport(){ const el = $('#reportSheet'); if (el) el.remove(); }
function sendReport(){
  const ctx = Reports.ctx; const api = Cloud.api(); if (!ctx || !api) return;
  const text = (($('#rpText') || {}).value || '').trim();
  const msg = $('#rpMsg');
  if (text.length < 5){ if (msg){ msg.textContent = 'Explique l’erreur en quelques mots pour que l’auteur puisse la corriger.'; msg.hidden = false; } return; }
  const btn = document.querySelector('[data-action="rp-send"]'); if (btn) btn.disabled = true;
  const cut = (v, n) => String(v || '').slice(0, n);
  api.sendReport({ name: cut(lbName(), 40), kind: cut(ctx.kind, 60), ref: cut(ctx.ref, 60), question: cut(ctx.question, 600), answer: cut(ctx.answer, 600), given: cut(ctx.given, 300), comment: cut(text, 1000), app: APP_VERSION })
    .then(() => { closeReport(); toast('Merci ! Ton signalement a été envoyé.'); })
    .catch(() => { if (btn) btn.disabled = false; if (msg){ msg.textContent = 'Envoi impossible pour le moment. Réessaie plus tard.'; msg.hidden = false; } });
}
function reportFromSession(){
  const s = state.session; if (!s) return;
  if (s.kind === 'grammar'){
    const q = s.queue[s.idx]; if (!q) return;
    const ok = q.choices.find(c => c.ok) || {};
    const picked = q.choices[s.picked] || {};
    return openReport({ kind: 'grammaire', ref: q.key, question: (q.promptAr ? q.promptAr + ' : ' : (q.stem ? (q.prefix ? '… ـ' + q.stem : q.stem + 'ـ …') + ' : ' : '')) + q.prompt, answer: ok.text || '', why: q.why || '', given: picked.ok ? '' : (picked.text || '') });
  }
  if (s.kind === 'translation'){
    const it = s.queue[s.idx]; if (!it) return;
    return openReport({ kind: 'traduction', ref: it.key, questionLabel: 'Phrase', question: it.fr, answerLabel: 'Correction de l’app', answer: it.ar, why: (it.notes || []).join(' ') });
  }
  if (s.kind === 'exam'){
    const q = s.queue[s.idx]; const w = q && wordById(q.id); if (!w) return;
    const expected = q.dir === 'arfr' ? w.fr : w.ar;
    const given = s.format === 'qcm' ? ((q.choices[s.picked] || {}).ok ? '' : (q.choices[s.picked] || {}).text) : (s.result ? '' : s.typed);
    return openReport({ kind: 'examen', ref: w.id + ':' + q.dir, question: (q.dir === 'arfr' ? w.ar : w.fr) + ' (' + DIR_LABEL[q.dir].toLowerCase() + ')', answer: expected, given: given || '' });
  }
  const card = s.queue[s.idx]; const w = card && wordById(card.id); if (!w) return;
  return reportWord(w);
}
function reportWord(w){
  openReport({ kind: 'vocabulaire', ref: w.id, questionLabel: 'Mot', question: w.ar, answerLabel: 'Traduction et détails affichés', answer: w.fr + (w.root ? ' (racine ' + w.root + ')' : '') + (w.plural ? ', pluriel ' + w.plural : ''), why: 'Pense aussi à vérifier les voyelles et la prononciation.' });
}
function reportLesson(l){
  openReport({ kind: 'leçon', ref: l.id, questionLabel: 'Fiche', question: l.title + ' (semaine ' + l.week + ')' });
}
/* ---------- "Demander une explication": opens an AI assistant with the context already written ---------- */
const ASK_TARGETS = [
  { label: 'Claude', url: q => 'https://claude.ai/new?q=' + encodeURIComponent(q) },
  { label: 'ChatGPT', url: q => 'https://chatgpt.com/?q=' + encodeURIComponent(q) }
];
const Ask = { prompt: '' };
const ASK_FRAME = 'J’apprends l’arabe en première année, niveau débutant. Réponds en français, simplement, sans aller au-delà de ce niveau. Écris toujours l’arabe avec toutes ses voyelles (harakat). Si tu n’es pas sûr de quelque chose, dis-le.';
function askLink(action, label, id){
  return '<button type="button" class="btn text ask-link" data-action="' + action + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + '>' + (label || 'Demander une explication') + '</button>';
}
function askPrompt(lines, request){
  const cut = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  return [ASK_FRAME, ''].concat(lines.filter(l => l && l[1]).map(([k, v, n]) => k + ' : ' + cut(v, n || 300)), ['', request]).join('\n');
}
function openAsk(prompt){
  Ask.prompt = prompt;
  closeAsk();
  const el = document.createElement('div');
  el.id = 'askSheet'; el.className = 'rp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'askTitle');
  el.innerHTML = '<div class="rp-card">' +
    '<h2 class="h2" id="askTitle">Demander une explication</h2>' +
    '<p class="rp-ask">Ta question est prête, avec la bonne réponse et la règle. Choisis ton assistant : il s’ouvre avec le texte déjà écrit. Sinon, colle-le : il est aussi copié.</p>' +
    ASK_TARGETS.map(t => '<a class="btn primary big ask-go" href="' + esc(t.url(prompt)) + '" target="_blank" rel="noopener" data-ask="go">' + esc(t.label) + '</a>').join('') +
    '<button type="button" class="btn ghost big" data-action="ask-copy">Copier le texte</button>' +
    '<details class="ask-preview"><summary>Voir le texte envoyé</summary><p>' + arWrap(prompt).replace(/\n/g, '<br>') + '</p></details>' +
    '<p class="hint ask-warn">Les IA peuvent se tromper en arabe, surtout sur les voyelles. En cas de doute, c’est le cours qui a raison : demande au professeur.</p>' +
    '<button type="button" class="btn text" data-action="ask-close">Fermer</button>' +
    '</div>';
  document.body.appendChild(el);
}
function closeAsk(){ const el = $('#askSheet'); if (el) el.remove(); }
function copyAsk(silent){
  const done = () => { if (!silent) toast('Texte copié'); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(Ask.prompt).then(done).catch(() => {});
  } catch(e){}
}
function askFromSession(){
  const s = state.session; if (!s) return;
  if (s.kind === 'grammar'){
    const q = s.queue[s.idx]; if (!q) return;
    const ok = q.choices.find(c => c.ok) || {}, picked = q.choices[s.picked] || {};
    const wrong = s.answered && !picked.ok;
    const shown = (q.promptAr ? q.promptAr + ' : ' : q.tiles ? (q.prefix ? '…' + q.stem : (q.before || '') + q.stem + '…') + ' : ' : '') + q.prompt;
    return openAsk(askPrompt([
      ['Leçon', s.lesson && s.lesson !== 'all' ? lessonLabel(s.lesson) : ''],
      ['Exercice', shown], ['Bonne réponse', ok.text], ['Ma réponse', wrong ? picked.text : ''],
      ['Explication donnée par l’app', q.why]
    ], 'Explique-moi pourquoi c’est la bonne réponse' + (wrong ? ' et pourquoi la mienne est fausse' : '') + ', puis donne-moi deux autres exemples du même type, avec leur traduction.'));
  }
  if (s.kind === 'exam'){
    const q = s.queue[s.idx]; const w = q && wordById(q.id); if (!w) return;
    const given = s.format === 'qcm' ? ((q.choices[s.picked] || {}).ok ? '' : (q.choices[s.picked] || {}).text) : (s.result ? '' : s.typed);
    return askWord(w, given);
  }
  if (s.kind === 'translation'){
    const it = s.queue[s.idx]; if (!it) return;
    return openAsk(askPrompt([
      ['Phrase à traduire en arabe', it.fr], ['Correction', it.ar], ['Explications données par l’app', (it.notes || []).join(' ')]
    ], 'Explique-moi cette traduction mot par mot : le verbe, le sujet, le complément et leurs terminaisons. Puis donne-moi deux phrases du même type à traduire, avec la correction tout à la fin.'));
  }
  const card = s.queue[s.idx]; const w = card && wordById(card.id); if (w) askWord(w);
}
function askWord(w, given){
  openAsk(askPrompt([
    ['Mot', w.ar + ' = ' + w.fr], ['Racine', w.root], ['Pluriel', w.plural], ['Ma réponse', given]
  ], (given ? 'Je me suis trompé sur ce mot. ' : '') + 'Aide-moi à le retenir : explique sa racine, donne-moi une astuce de mémorisation et deux phrases très simples qui l’utilisent, avec leur traduction.'));
}
function askLesson(l){
  const texts = [l.intro].concat((l.blocks || []).filter(b => b.type === 'note' || b.type === 'text').map(b => b.text), l.notes || []);
  openAsk(askPrompt([
    ['Leçon', l.title + ' (' + l.subtitle + ')'], ['Ce que dit la fiche', texts.join(' '), 1100]
  ], 'Explique-moi cette leçon avec des mots simples, puis pose-moi trois petites questions, une par une, pour vérifier que j’ai compris.'));
}

/* Admin view (accounts listed in the Firestore "admins" collection) */
function checkAdmin(){
  const api = Cloud.api(); if (!api || !Cloud.user){ Reports.admin = false; return; }
  api.isAdmin().then(a => { Reports.admin = a; if (a){ loadReports(); if (location.hash === '#reports' && !state.session){ state.settings = true; render(); const el = $('#reportsBox'); if (el) el.scrollIntoView({ block: 'start' }); } } refreshCloudUi(); });
}
function loadReports(){
  const api = Cloud.api(); if (!api || Reports.loading) return;
  Reports.loading = true;
  api.fetchReports().then(list => { Reports.list = list; }).catch(() => { Reports.list = Reports.list || []; })
    .finally(() => { Reports.loading = false; const b = $('#reportsBox'); if (b) b.innerHTML = reportsHtml(); });
}
function reportsHtml(){
  const list = (Reports.list || []).filter(r => Reports.showDone || r.status !== 'done');
  const open = (Reports.list || []).filter(r => r.status !== 'done').length;
  return '<span class="label">Signalements d’erreurs ' + (open ? '<span class="new-chip">' + open + '</span>' : '') + '</span>' +
    (Reports.list == null ? '<p class="hint">Chargement…</p>' :
      !list.length ? '<p class="hint">' + (Reports.showDone ? 'Aucun signalement.' : 'Aucun signalement en attente.') + '</p>' :
      '<ul class="rp-list">' + list.map(r =>
        '<li class="' + (r.status === 'done' ? 'done' : '') + '">' +
          '<p class="rp-meta">' + esc(new Date(r.at || 0).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + ', ' + esc(r.kind || '') + ', ' + esc(r.name || 'élève') + '</p>' +
          '<p>' + arWrap(r.question || '') + '</p>' +
          (r.answer ? '<p class="rp-ans">Correction affichée : ' + arWrap(r.answer) + '</p>' : '') +
          (r.given ? '<p class="rp-ans">Réponse de l’élève : ' + arWrap(r.given) + '</p>' : '') +
          '<p class="rp-comment">« ' + arWrap(r.comment || '') + ' »</p>' +
          '<div class="rp-actions">' + (r.status === 'done' ? '' : '<button type="button" class="btn small" data-action="rp-done" data-id="' + esc(r.id) + '">Traité</button>') +
          '<button type="button" class="btn text" data-action="rp-del" data-id="' + esc(r.id) + '">Supprimer</button></div></li>').join('') + '</ul>') +
    '<button type="button" class="btn text" data-action="rp-toggle">' + (Reports.showDone ? 'Masquer les signalements traités' : 'Afficher aussi les signalements traités') + '</button>';
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

/* Spaced repetition.
   - Failed card ("À revoir"): back to zero (no mastery) and shown again in the session.
   - Just-failed card (relearning): short steps, Difficile = 10 min, Bien = 1 j, Facile = 2 j.
   - Otherwise Difficile < Bien < Facile, always three different durations. */
function isRelearning(s){ return !!(s && (s.reps || 0) === 0 && (s.relearn || (s.lapses || 0) > 0)); }
function schedule(prev, r){
  const now = Date.now();
  const s = prev
    ? { ivl: prev.ivl || 0, ease: prev.ease || 2.5, reps: prev.reps || 0, lapses: prev.lapses || 0, due: prev.due || 0, relearn: !!prev.relearn }
    : { ivl: 0, ease: 2.5, reps: 0, lapses: 0, due: 0, relearn: false };
  s.last = now;
  if (r === 'again'){
    if (s.reps > 0 || s.ivl > 0) s.lapses += 1;
    s.reps = 0; s.ivl = 0; s.relearn = true;
    s.ease = Math.max(1.3, +(s.ease - 0.2).toFixed(2));
    s.due = now;
    return s;
  }
  if (isRelearning(s)){
    if (r === 'hard'){ s.due = now + 10 * 60000; s.relearn = true; return s; }
    s.ivl = r === 'good' ? 1 : 2; s.reps = 1; s.relearn = false;
    if (r === 'easy') s.ease = +(s.ease + 0.1).toFixed(2);
    s.due = addDays(startOfDay(now), s.ivl);
    return s;
  }
  let hard, good, easy;
  if (s.reps === 0){ hard = 1; good = 2; easy = 4; }
  else {
    hard = Math.max(s.ivl + 1, Math.round(s.ivl * 1.2));
    good = Math.max(hard + 1, Math.round(s.ivl * s.ease));
    easy = Math.max(good + 1, Math.round(s.ivl * s.ease * 1.3));
  }
  const ivl = Math.min(3650, r === 'hard' ? hard : r === 'good' ? good : easy);
  if (r === 'hard') s.ease = Math.max(1.3, +(s.ease - 0.15).toFixed(2));
  if (r === 'easy') s.ease = +(s.ease + 0.15).toFixed(2);
  s.ivl = ivl; s.reps += 1; s.relearn = false;
  s.due = addDays(startOfDay(now), ivl);
  return s;
}
function intervalLabel(prev, r){
  if (r === 'again') return 'maintenant';
  const ns = schedule(prev, r);
  return ns.ivl === 0 ? '10 min' : fmtIvl(ns.ivl);
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
  else if (s.kind === 'translation' && s.marks.length){ const c = trCounts(s); rec = Object.assign({ type: 'translation', src: s.src, total: s.marks.length, correct: c.ok, close: c.close }, base); }
  else if (s.kind === 'blank' && s.finished && s.items.length) rec = Object.assign({ type: 'blank', week: s.week, total: s.items.length, correct: Object.keys(s.checked).length }, base);
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
/* ---------- offline use ----------
   The service worker keeps the app, the vocabulary and the lessons. Here we also fetch every audio file
   (words, lessons, conjugator, sentences) and the fonts, so that everything works on a plane.
   Progress is always written on the device first; Firestore keeps the pending writes (persistent cache)
   and sends them when the connection comes back, and the next start merges both sides anyway. */
const FONT_FILES = ['amiri-arabic-400-normal', 'atkinson-hyperlegible-latin-400-normal', 'atkinson-hyperlegible-latin-700-normal',
  'atkinson-hyperlegible-latin-ext-400-normal', 'atkinson-hyperlegible-latin-ext-700-normal', 'noto-naskh-arabic-arabic-400-normal',
  'scheherazade-new-arabic-400-normal'].map(f => 'fonts/' + f + '.woff2');
const Offline = { total: 0, cached: 0, busy: false, checked: false, failed: 0 };
function offlineFiles(){
  const set = new Set();
  const walk = x => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') for (const v of Object.values(x)){ if (typeof v === 'string' && /^audio\/[\w.-]+\.mp4$/.test(v)) set.add(v); else walk(v); }
  };
  state.words.forEach(w => { if (w.audio) set.add(w.audio); });
  walk(state.grammar);
  return [...set].concat(FONT_FILES);
}
function offlineSupported(){ return 'serviceWorker' in navigator && typeof caches !== 'undefined'; }
async function isCached(path){ try { return !!(await caches.match(new URL(path, location.href).href)); } catch(e){ return false; } }
async function offlineCheck(){
  if (!offlineSupported()) return;
  const files = offlineFiles();
  let n = 0;
  for (const f of files) if (await isCached(f)) n++;
  Offline.total = files.length; Offline.cached = n; Offline.checked = true;
  refreshOfflineUi();
}
/* Fetch what is missing (through the service worker, which stores it). manual = asked from the settings. */
async function offlineDownload(manual){
  if (!offlineSupported() || Offline.busy) return;
  if (!navigator.onLine){ if (manual) toast('Pas de connexion pour le moment.'); await offlineCheck(); return; }
  const conn = navigator.connection;
  if (!manual && conn && conn.saveData) return;
  if (!navigator.serviceWorker.controller){ try { await navigator.serviceWorker.ready; } catch(e){} }
  Offline.busy = true; Offline.failed = 0; refreshOfflineUi();
  for (let pass = 0; pass < 3; pass++){
    const files = offlineFiles(); const missing = [];
    for (const f of files) if (!(await isCached(f))) missing.push(f);
    Offline.total = files.length; Offline.cached = files.length - missing.length; Offline.checked = true; refreshOfflineUi();
    if (!missing.length || !navigator.onLine) break;
    let i = 0; Offline.failed = 0;
    const worker = async () => {
      while (i < missing.length){
        const f = missing[i++];
        try { const r = await fetch(f); if (r.ok){ await r.blob(); Offline.cached++; } else Offline.failed++; }
        catch(e){ Offline.failed++; }
        refreshOfflineUi();
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    /* A service worker update wipes the old caches: check again and fetch what disappeared. */
    await new Promise(r => setTimeout(r, 400));
  }
  Offline.busy = false;
  await offlineCheck();
  if (manual) toast(Offline.cached >= Offline.total ? 'Tout est prêt pour réviser sans connexion.' : 'Certains fichiers n’ont pas pu être téléchargés. Réessaie avec une meilleure connexion.');
}
function warmAudioCache(){ setTimeout(() => offlineDownload(false), 3000); }
function offlineHtml(){
  if (!offlineSupported()) return '<span class="label">Sans connexion</span><p class="hint">Ce navigateur ne permet pas d’utiliser l’app hors connexion. Installe-la sur l’écran d’accueil depuis Chrome ou Safari.</p>';
  const ready = Offline.checked && Offline.cached >= Offline.total && Offline.total > 0;
  const pct = Offline.total ? Math.round(Offline.cached / Offline.total * 100) : 0;
  const status = !Offline.checked ? 'Vérification…'
    : ready ? 'Prêt : tout est sur ce téléphone.'
    : Offline.busy ? 'Téléchargement : ' + Offline.cached + ' sur ' + Offline.total + ' fichiers…'
    : 'Pas encore prêt : ' + Offline.cached + ' sur ' + Offline.total + ' fichiers.';
  return '<span class="label">Sans connexion (avion, métro)</span>' +
    '<div class="offline-status' + (ready ? ' ready' : '') + '"><span class="dv-bar" aria-hidden="true"><span data-w="' + pct + '"></span></span><b>' + esc(status) + '</b></div>' +
    (ready || Offline.busy ? '' : '<button type="button" class="btn ' + (navigator.onLine ? 'primary' : 'ghost') + ' big" data-action="offline-dl"' + (navigator.onLine ? '' : ' disabled') + '>Tout télécharger maintenant</button>') +
    '<p class="hint">Sans réseau, tu peux réviser, passer un examen, faire la grammaire, la conjugaison, la traduction et la feuille blanche, avec la prononciation. ' +
      (Cloud.user ? 'Ta progression est enregistrée sur ce téléphone, puis envoyée automatiquement à ton compte dès que la connexion revient.' : 'Ta progression est enregistrée sur ce téléphone.') +
      ' L’alphabet, la dictée, le classement et « Demander une explication » ont besoin d’internet.</p>';
}
function refreshOfflineUi(){
  const box = $('#offlineBox'); if (box){ box.innerHTML = offlineHtml(); applyDyn(box); }
}
function refreshOnlineUi(){
  const pill = $('#offlinePill'); if (pill) pill.hidden = navigator.onLine;
}
window.addEventListener('offline', () => { refreshOnlineUi(); refreshOfflineUi(); softRefresh(); });
window.addEventListener('online', () => {
  refreshOnlineUi(); refreshOfflineUi(); softRefresh();
  const api = Cloud.api();
  if (api && Cloud.user && api.waitSync){
    api.waitSync().then(() => toast('Connexion retrouvée : ta progression est synchronisée.')).catch(() => {});
  }
  offlineDownload(false);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => { if (state.loaded) setTimeout(() => offlineDownload(false), 1500); });

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
function notes(){
  return (state.banner ? '<p class="note">' + esc(state.banner) + '</p>' : '') +
    (navigator.onLine ? '' : '<p class="note offline-note">Hors connexion : tout ce que tu fais est enregistré sur ce téléphone' + (Cloud.user ? ' et sera envoyé à ton compte dès que la connexion reviendra' : '') + '.</p>');
}
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
  if (state.tab !== 'reader' || !READERS[state.practice] || state.session || state.settings || state.setup || state.detailId || state.lessonId) hideReader();
  document.querySelectorAll('.tabs button').forEach(b => {
    if (b.dataset.tab === state.tab && !state.settings) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (!state.loaded){ setView('<p class="loading">Chargement du vocabulaire…</p>'); return; }
  if (state.session) return renderSession();
  if (state.settings) return renderSettings();
  if (state.setup) return renderSetup();
  if (state.detailId) return renderDetail();
  if (state.lessonId) return renderLesson();
  if (state.conjVerb && state.tab === 'grammar') return renderConjVerb();
  if (state.tab === 'review') renderReview();
  else if (state.tab === 'list') renderListShell();
  else if (state.tab === 'grammar') renderGrammar();
  else if (state.tab === 'reader') renderPractice();
  else renderStats();
}
/* Pratique : the Ataallam alphabet site and the dictation site, each kept alive in its own frame between tab switches. */
const READERS = {
  lettres: { url: 'https://lettres.elatarbiyah.fr/', frame: 'readerFrame' },
  dictee: { url: 'https://dictee-elatarbiyah.fr/', frame: 'dictFrame' }
};
const K_READER = LS + 'reader';
let readerWhich = READERS[lsGet(K_READER)] ? lsGet(K_READER) : 'lettres';
function placeReader(){
  const top = document.querySelector('.top');
  if (top) document.documentElement.style.setProperty('--reader-top', Math.round(top.getBoundingClientRect().bottom) + 'px');
}
function renderReader(){
  setView('<section class="reader-space" aria-hidden="true"></section>');
  const pane = $('#readerPane');
  placeReader();
  pane.hidden = false;
  $('#readerOffline').hidden = navigator.onLine;
  for (const [key, r] of Object.entries(READERS)){
    const frame = document.getElementById(r.frame); if (!frame) continue;
    const on = key === readerWhich;
    frame.hidden = !on;
    if (on && !frame.getAttribute('src') && navigator.onLine) frame.setAttribute('src', r.url);
  }
  pane.querySelectorAll('[data-action="reader"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === readerWhich)));
  const open = $('#readerOpen'); if (open) open.href = READERS[readerWhich].url;
}
function setReader(which){
  if (!READERS[which]) return;
  readerWhich = which; state.practice = which; lsSet(K_READER, which);
  if (state.tab === 'reader') renderReader();
}
function hideReader(){ const pane = $('#readerPane'); if (pane) pane.hidden = true; }
window.addEventListener('resize', placeReader);
window.addEventListener('online', () => { if (state.tab === 'reader' && READERS[state.practice] && !state.session && !state.settings) renderReader(); });

/* Review home */
function reviseSwitch(){
  return '<div class="field">' + seg('revmode', state.reviseMode, [['vocab', 'Vocabulaire'], ['grammar', 'Grammaire'], ['conj', 'Conjugaison']], 'revModeL') + '<span class="sr" id="revModeL">Que réviser ?</span></div>';
}
function renderReview(){
  if (state.reviseMode === 'grammar' || state.reviseMode === 'conj'){
    const sec = state.reviseMode === 'conj' ? 'conjugaison' : 'grammaire';
    const lessons = sectionLessons(sec);
    if (!grammarLessons().length && !state.grammar && !state.grammarError) loadGrammar(true).then(afterGrammarLoad);
    setView('<section class="stack"><h1 class="h1">Réviser</h1>' + notes() + devoirsHtml() + reviseSwitch() +
      (grammarLessons().length
        ? '<div class="sheet gram-hero"><p class="sheet-meta"><span>' + plural(lessons.length, 'leçon', 'leçons') + '</span><span>' + (sec === 'conjugaison' ? plural(conjVerbs().length, 'verbe', 'verbes') : '') + '</span></p>' +
            '<p class="ar gram-hero-ar" lang="ar" dir="rtl">' + sectionHero(sec) + '</p></div>' +
          grammarTrainHtml(sec) +
          '<button type="button" class="btn ghost big" data-action="go-grammar" data-sec="' + sec + '">' + (sec === 'conjugaison' ? 'Revoir les leçons et le conjugueur' : 'Revoir les fiches de leçons') + '</button>'
        : '<p class="loading">Chargement des leçons…</p>') +
      '</section>');
    return;
  }
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
    '<h1 class="h1">Réviser</h1>' + notes() + (installHint() || accountHint()) + devoirsHtml() + blankNudge() + reviseSwitch() +
    '<div class="sheet">' +
      '<p class="sheet-meta"><span>Semaine ' + shownWeek + (weekWords.some(isNewItem) ? ' <span class="new-chip">Nouveau</span>' : '') + '</span><span>' + plural(weekWords.length, 'mot', 'mots') + '</span></p>' +
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
    '<p class="hint">' + (o.format === 'qcm' ? 'Choisis la bonne réponse parmi quatre propositions.' : 'Écris la réponse. Les voyelles et les accents ne comptent pas.') + ' Un mot raté repart à zéro et revient dans la révision du jour.</p>' +
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
    const hint = intervalLabel(prev, r);
    return '<button type="button" class="rate-btn ' + r + '" data-action="rate" data-r="' + r + '" aria-keyshortcuts="' + (i + 1) + '"><b>' + l + '</b><small>' + hint + '</small></button>';
  }).join('') + '</div>';
}
function renderSession(){
  const s = state.session;
  if (!s.tick){ s.tick = Date.now(); s.active = 0; }
  if (s.kind === 'browse') return renderBrowse();
  if (s.kind === 'exam') return renderExam();
  if (s.kind === 'grammar') return renderGrammarQ();
  if (s.kind === 'translation') return renderTranslation();
  if (s.kind === 'blank') return renderBlank();
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
    '<div class="answer-bar">' + (s.revealed ? ratingButtons(w, card) + reportLink('report-q', 'Signaler une erreur sur ce mot') : '<button type="button" class="btn primary big" data-action="reveal">Afficher la réponse</button>') + '</div>' +
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
  const ns = w ? schedule(cardState(w, card.dir), r) : null;
  if (w) Store.setSrs(w.id, card.dir, ns);
  s.answers++;
  if (r === 'again'){ s.again++; s.queue.splice(Math.min(s.queue.length, s.idx + 4), 0, card); }
  else if (ns && ns.ivl === 0){ s.queue.splice(Math.min(s.queue.length, s.idx + 6), 0, card); }
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
    '</div>' + (showBack ? reportLink('report-q', 'Signaler une erreur sur ce mot') : '') +
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
        '<div class="after">' + nextBtn + askLink('ask-q') + reportLink('report-q') + '</div>';
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
    answer += '<div class="after">' + nextBtn + (s.result ? '' : '<button type="button" class="btn ghost big" data-action="override">Compter comme juste</button>') + askLink('ask-q') + reportLink('report-q') + '</div>';
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
  if (q.choices[i].ok) s.correct++; else { s.mistakes.push(q); resetFailed(q); }
  renderSession();
  const n = $('#nextQ'); if (n) n.focus({ preventScroll: true });
}
/* A word missed in an exam loses its mastery and comes back in today's review. */
function resetFailed(q){
  const w = wordById(q.id); if (!w) return;
  const prev = cardState(w, q.dir);
  q.prevSrs = prev ? Object.assign({}, prev) : null;
  Store.setSrs(w.id, q.dir, schedule(prev, 'again'));
}
function submitExam(e){
  e.preventDefault();
  const s = state.session; if (!s || s.kind !== 'exam' || s.answered) return;
  const value = e.target.elements.answer.value.trim();
  if (!value){ e.target.elements.answer.focus(); return; }
  const q = s.queue[s.idx]; const w = wordById(q.id); if (!w) return;
  s.answered = true; s.typed = value; s.result = checkTyped(value, w, q.dir);
  if (s.result) s.correct++; else { s.mistakes.push(q); resetFailed(q); }
  renderSession();
  const n = $('#nextQ'); if (n) n.focus({ preventScroll: true });
}
function override(){
  const s = state.session; if (!s || s.kind !== 'exam' || !s.answered || s.result) return;
  const q = s.queue[s.idx];
  s.result = true; s.overridden = true; s.correct++;
  s.mistakes = s.mistakes.filter(m => m !== q);
  if (q.prevSrs) Store.setSrs(q.id, q.dir, q.prevSrs);
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
    html += '<section class="week"><div class="week-head"><h2 class="h2">Semaine ' + wk + (items.some(isNewItem) ? ' <span class="new-chip">Nouveau</span>' : '') + '</h2><span class="muted">' + plural(items.length, 'mot', 'mots') + '</span>' +
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
    '</ul></div>' + askLink('ask-word', 'Demander de l’aide pour retenir ce mot', w.id) + '<button type="button" class="btn text report-link" data-action="report-word" data-id="' + esc(w.id) + '">Signaler une erreur sur ce mot</button>' +
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
    const n = h.type === 'review' ? (h.answers || 0) : h.type === 'browse' ? (h.seen || 0) : (h.type === 'exam' || h.type === 'grammar' || h.type === 'translation' || h.type === 'blank') ? (h.total || 0) : 0;
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
      '<p class="hint">Révisions, défilement, examens, grammaire et exercices sur feuille confondus.</p>' +
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
  { id: '1',   pron: 'ي', end: '\u0650\u064A', tile: 'ـِي', label: 'mon, ma, mes', ctx: '' },
  { id: '2m',  pron: 'كَ', end: '\u064F\u0643\u064E', tile: 'ـُكَ', label: 'ton, ta, tes (garçon)', ctx: ' (à un garçon)' },
  { id: '2f',  pron: 'كِ', end: '\u064F\u0643\u0650', tile: 'ـُكِ', label: 'ton, ta, tes (fille)', ctx: ' (à une fille)' },
  { id: '2d',  pron: 'كُمَا', end: '\u064F\u0643\u064F\u0645\u064E\u0627', tile: 'ـُكُمَا', label: 'votre, vos (à deux)', ctx: ' (à deux personnes)' },
  { id: '2p',  pron: 'كُمْ', end: '\u064F\u0643\u064F\u0645\u0652', tile: 'ـُكُمْ', label: 'votre, vos (à trois ou plus)', ctx: ' (à trois personnes ou plus)' },
  { id: '3m',  pron: 'هُ', end: '\u064F' + 'هُ', tile: 'ـُهُ', label: 'son, sa, ses (à lui)', ctx: ' (à lui)' },
  { id: '3f',  pron: 'هَا', end: '\u064F' + 'هَا', tile: 'ـُهَا', label: 'son, sa, ses (à elle)', ctx: ' (à elle)' },
  { id: '3mp', pron: 'هُمْ', end: '\u064F' + 'هُمْ', tile: 'ـُهُمْ', label: 'leur, leurs (à eux)', ctx: ' (à eux)' },
  { id: '3fp', pron: 'هُنَّ', end: '\u064F' + 'هُنَّ', tile: 'ـُهُنَّ', label: 'leur, leurs (à elles)', ctx: ' (à elles)' },
  { id: '2fp', pron: 'كُنَّ', end: '\u064F' + 'كُنَّ', tile: 'ـُكُنَّ', label: 'votre, vos (à des filles)', ctx: ' (à des filles)' },
  { id: '1p',  pron: 'نَا', end: '\u064F' + 'نَا', tile: 'ـُنَا', label: 'notre, nos', ctx: '' }
];
/* Which possessive pronouns each lesson works on. */
const POSS_SETS = {
  pronoms: ['1', '2m', '2f', '2d', '2p'],
  attaches: ['3m', '3f', '2m', '2f', '1', '3mp', '3fp', '2p', '2fp', '1p']
};
/* In the "pronoms attachés" lesson, كُمْ is opposed to كُنَّ rather than to كُمَا. */
const POSS_CTX = { attaches: { '2p': ' (à des garçons ou à un groupe mixte)', '2fp': ' (à des filles)' } };
/* The same pronouns attached to a verb (object): « le, la, me… ». With a verb, "me" is ـنِي. */
const OBJ = {
  '3m':  { suf: 'هُ', fr: 'le', tag: '' },
  '3f':  { suf: 'هَا', fr: 'la', tag: '' },
  '2m':  { suf: 'كَ', fr: 'te', tag: ' (garçon)' },
  '2f':  { suf: 'كِ', fr: 'te', tag: ' (fille)' },
  '1':   { suf: 'نِي', fr: 'me', tag: '' },
  '3mp': { suf: 'هُمْ', fr: 'les', tag: ' (eux)' },
  '3fp': { suf: 'هُنَّ', fr: 'les', tag: ' (elles)' },
  '2p':  { suf: 'كُمْ', fr: 'vous', tag: ' (garçons ou groupe mixte)' },
  '2fp': { suf: 'كُنَّ', fr: 'vous', tag: ' (filles)' },
  '1p':  { suf: 'نَا', fr: 'nous', tag: '' }
};
const PERS = [
  { id: '3m',  n: 's', label: 'il', who: 'il (l’absent)', pron: 'هُوَ', v: '\u064E', suf: '' },
  { id: '3f',  n: 's', label: 'elle', who: 'elle (l’absente)', pron: 'هِيَ', v: '\u064E', suf: 'تْ' },
  { id: '2m',  n: 's', label: 'tu (garçon)', who: 'tu, garçon (l’interlocuteur)', pron: 'أَنْتَ', v: '\u0652', suf: 'تَ' },
  { id: '2f',  n: 's', label: 'tu (fille)', who: 'tu, fille (l’interlocutrice)', pron: 'أَنْتِ', v: '\u0652', suf: 'تِ' },
  { id: '1',   n: 's', label: 'je', who: 'je (le locuteur)', pron: 'أَنَا', v: '\u0652', suf: 'تُ' },
  { id: '3md', n: 'd', label: 'ils (deux)', who: 'ils, eux deux (deux absents)', pron: 'هُمَا', v: '\u064E', suf: 'ا' },
  { id: '3fd', n: 'd', label: 'elles (deux)', who: 'elles deux (deux absentes)', pron: 'هُمَا', v: '\u064E', suf: 'تَا' },
  { id: '2d',  n: 'd', label: 'vous (deux)', who: 'vous deux, garçons ou filles (deux interlocuteurs)', pron: 'أَنْتُمَا', v: '\u0652', suf: 'تُمَا' },
  { id: '3mp', n: 'p', label: 'ils (trois ou plus)', who: 'ils, trois ou plus (les absents)', pron: 'هُمْ', v: '\u064F', suf: 'وا' },
  { id: '3fp', n: 'p', label: 'elles (trois ou plus)', who: 'elles, trois ou plus (les absentes)', pron: 'هُنَّ', v: '\u0652', suf: 'نَ' },
  { id: '2mp', n: 'p', label: 'vous (garçons ou mixte, trois ou plus)', who: 'vous, garçons ou groupe mixte, trois ou plus (les interlocuteurs)', pron: 'أَنْتُمْ', v: '\u0652', suf: 'تُمْ' },
  { id: '2fp', n: 'p', label: 'vous (filles, trois ou plus)', who: 'vous, filles, trois ou plus (les interlocutrices)', pron: 'أَنْتُنَّ', v: '\u0652', suf: 'تُنَّ' },
  { id: '1p',  n: 'p', label: 'nous', who: 'nous (les locuteurs, deux ou plus)', pron: 'نَحْنُ', v: '\u0652', suf: 'نَا' }
];
PERS.forEach(p => { p.tile = 'ـ' + p.v + p.suf; });
const HARAKA_RE = /[\u064B-\u0652]/g;

function stripEnd(ar){
  /* Remove the final vowel or tanwîn, but keep a chadda: نَبِيٌّ → نَبِيّ. */
  const t = String(ar); const m = /[\u064B-\u0652]+$/.exec(t);
  return m ? t.slice(0, m.index) + (m[0].includes('\u0651') ? '\u0651' : '') : t;
}
function splitLast(word){
  /* Split a word before its last letter so the ending can be highlighted. */
  let i = word.length - 1;
  while (i > 0 && /[\u064B-\u0652]/.test(word[i])) i--;
  return [word.slice(0, i), word.slice(i)];
}
function highlight(base, end){
  return '<span class="w">' + splitHtml([[base, ''], [end, 'hl']]) + '</span>';
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
    ? { '1': 'mes', '2m': 'tes', '2f': 'tes', '2d': 'vos', '2p': 'vos', '3m': 'ses', '3f': 'ses', '3mp': 'leurs', '3fp': 'leurs', '2fp': 'vos', '1p': 'nos' }[pid]
    : { '1': fem ? 'ma' : 'mon', '2m': fem ? 'ta' : 'ton', '2f': fem ? 'ta' : 'ton', '2d': 'votre', '2p': 'votre', '3m': fem ? 'sa' : 'son', '3f': fem ? 'sa' : 'son', '3mp': 'leur', '3fp': 'leur', '2fp': 'votre', '1p': 'notre' }[pid];
  return det + ' ' + (plural ? n.plural : n.noun);
}
/* A noun ending in ة takes a ت before a pronoun: دَجَاجَةٌ → دَجَاجَتُهُ. */
function attachStem(stem){ return stem.endsWith('ة') ? stem.slice(0, -1) + 'ت' : stem; }
/* Tanwîn « -an » is written with an extra alif, except after ة: كِتَابًا, دَجَاجَةً. */
function tanwinAn(stem){ return stem + (stem.endsWith('ة') ? '\u064B' : '\u064B\u0627'); }
function possCtx(pid, lesson){ const o = POSS_CTX[lesson] || {}; return pid in o ? o[pid] : (POSS.find(p => p.id === pid) || {}).ctx || ''; }
function verbStem(ar){ return String(ar).replace(/\u064E$/, ''); }
function conjParts(v, p){
  /* Past tense of a regular verb, split into base + ending (the ending is highlighted).
     A root ending with the first letter of the suffix merges with a chadda: سَكَتَ → سَكَتُّ, سَكَتُّمْ. */
  if (v.forms && v.forms[p.id]) return { base: v.forms[p.id], end: '' };
  const stem = verbStem(v.ar);
  const last = stem.replace(HARAKA_RE, '').slice(-1);
  if (p.v === '\u0652' && p.suf && p.suf[0] === last){
    return { base: stem.slice(0, stem.lastIndexOf(last)), end: p.suf[0] + '\u0651' + p.suf.slice(1), merged: true };
  }
  return { base: stem + p.v, end: p.suf };
}
function conjugate(v){
  const out = {};
  for (const p of PERS){
    const c = conjParts(v, p);
    out[p.id] = c.base + c.end;
    if (c.merged) out.merged = true;
  }
  return out;
}
function verbInf(v){ return String(v.fr || '').replace(/\s*\(.*\)\s*$/, '').trim(); }
const PC_PLURAL = { '3mp': 'ils ont ', '3fp': 'elles ont ', '2mp': 'vous avez ', '2fp': 'vous avez ', '1p': 'nous avons ' };
const PC_TAG = { '2m': ' (garçon)', '2f': ' (fille)', '3md': ' (eux deux)', '3fd': ' (elles deux)', '2d': ' (vous deux)',
  '3mp': ' (trois ou plus)', '3fp': ' (trois ou plus)', '2mp': ' (garçons ou mixte, trois ou plus)', '2fp': ' (filles, trois ou plus)' };
/* In French the dual reads like the plural: « ils ont écrit » (eux deux). */
const DUAL_SRC = { '3md': '3mp', '3fd': '3fp', '2d': '2mp' };
function pcText(v, pid){
  const pc = v.pc || {};
  if (pc[pid]) return pc[pid];
  if (DUAL_SRC[pid]) return pcText(v, DUAL_SRC[pid]);
  /* Plural not written yet: derive it from "il a …" (verbs with avoir only). */
  const m = PC_PLURAL[pid] && /^il a (.+)$/.exec(pc['3m'] || '');
  return m ? PC_PLURAL[pid] + m[1] : '';
}
function pcLabel(v, pid){
  const t = pcText(v, pid); if (!t) return '';
  return t + (PC_TAG[pid] || '');
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
function grammarExtraNouns(lid){ return ((state.grammar && state.grammar.nouns) || []).filter(n => frNoun(n) && (!n.lessons || n.lessons.includes(lid))); }
function lookupItem(id){
  const g = state.grammar || {};
  return state.words.find(w => w.id === id) || (g.verbs || []).find(v => v.id === id) || (g.nouns || []).find(n => n.id === id) || null;
}
function capFirst(t){ return t.charAt(0).toUpperCase() + t.slice(1); }

/* ---- pronouns attached to a verb (lesson "attaches") ---- */
/* Model verb, in the past (the present has not been taught yet): أَخْرَجَ = il a fait sortir. */
const MODEL_VERB = 'أَخْرَجَ';
const MODEL_VERB_FR = '(أَخْرَجَ = il a fait sortir)';
const CLASSE = { noun: 'classe', fem: true };
const OBJ_IDS = POSS_SETS.attaches;
/* After a kasra, هُ / هُمْ / هُنَّ become هِ / هِمْ / هِنَّ: مِنْ فَصْلِهِ. */
const GEN_HARMONY = { '3m': 'هِ', '3mp': 'هِمْ', '3fp': 'هِنَّ' };
function attLabel(pid){ return pid === '2p' ? 'votre, vos (garçons ou groupe mixte)' : (POSS.find(x => x.id === pid) || {}).label || ''; }
/* « il l’a fait sortir (lui) », « il m’a fait sortir », « il les a fait sortir (eux) »… */
const OBJ_ELIDED = { le: 'l’', la: 'l’', te: 't’', me: 'm’' };
const OBJ_PAST_TAG = { '3m': ' (lui)', '3f': ' (elle)' };
function objPast(pid){ const o = OBJ[pid]; return (OBJ_ELIDED[o.fr] || o.fr + ' ') + 'a fait sortir'; }
function objFr(pid){ return 'il ' + objPast(pid) + (OBJ_PAST_TAG[pid] || OBJ[pid].tag); }
function agreePP(pp, fem, pl){ return pp + (fem ? 'e' : '') + (pl && !/s$/.test(pp + (fem ? 'e' : '')) ? 's' : ''); }
function pastObjFr(v, pid){
  const m = /^il a (.+)$/.exec(pcText(v, '3m')); if (!m) return '';
  const pp = m[1];
  return { '3m': 'il l’a ' + agreePP(pp, false, false) + ' (lui)', '3f': 'il l’a ' + agreePP(pp, true, false) + ' (elle)',
    '3mp': 'il les a ' + agreePP(pp, false, true) + ' (eux)', '3fp': 'il les a ' + agreePP(pp, true, true) + ' (elles)' }[pid] || '';
}
function attachedVerbQuestions(app){
  const ids = OBJ_IDS;
  const form = pid => MODEL_VERB + OBJ[pid].suf;
  const whyOf = pid => 'ـ' + OBJ[pid].suf + ' collé au verbe = « ' + OBJ[pid].fr + ' »' + (pid === '1' ? ' (avec un verbe, on écrit ـنِي et non ـي).' : '.');
  for (const pid of ids){
    const others = n => pickOthers(ids, pid, n);
    const reveal = { base: MODEL_VERB, end: OBJ[pid].suf, fr: objFr(pid) };
    app.push({ kind: 'att-verb-mean', key: 'avm:' + pid, word: 'akhraj', promptAr: form(pid), prompt: 'Que veut dire ce mot ? ' + MODEL_VERB_FR,
      choices: shuffle([{ text: objFr(pid), ok: true }].concat(others(3).map(o => ({ text: objFr(o), ok: false })))), why: whyOf(pid), reveal });
    app.push({ kind: 'att-verb-build', key: 'avb:' + pid, word: 'akhraj', prompt: 'Comment dit-on « ' + objFr(pid) + ' » ?',
      choices: shuffle([{ text: form(pid), ok: true, ar: true }].concat((pid === '1' ? [MODEL_VERB.replace(/\u064E$/, '\u0650') + 'ي'].concat(others(2).map(form)) : others(3).map(form)).map(t => ({ text: t, ok: false, ar: true })))),
      why: whyOf(pid), reveal });
    const tiles = [pid].concat(others(3));
    app.push({ kind: 'att-verb-tiles', key: 'avt:' + pid, word: 'akhraj', tiles: true, stem: MODEL_VERB, prompt: 'Complète pour dire « ' + objFr(pid) + ' ».',
      choices: ids.filter(o => tiles.includes(o)).map(o => ({ text: 'ـ' + OBJ[o].suf, ok: o === pid, ar: true })).concat(pid === '1' ? [{ text: 'ـي', ok: false, ar: true }] : []),
      why: whyOf(pid), reveal });
    /* Same pronoun, noun or verb: possessive or object? */
    const P = POSS.find(x => x.id === pid);
    const onNoun = Math.random() < 0.5;
    const nounMeaning = attLabel(pid), verbMeaning = OBJ[pid].fr + OBJ[pid].tag;
    const otherMeanings = others(2).map(o => onNoun ? attLabel(o) : OBJ[o].fr + OBJ[o].tag);
    const kForm = onNoun ? 'كِتَابُ' + POSS.find(x => x.id === pid).end.slice(1) : form(pid);
    const kNoun = pid === '1' ? 'كِتَابِي' : kForm;
    app.push({ kind: 'att-kind', key: 'ak:' + pid + (onNoun ? 'n' : 'v'), word: 'kind', promptAr: onNoun ? kNoun : kForm,
      prompt: 'Que veut dire le pronom collé à ce ' + (onNoun ? 'nom (كِتَابٌ = un livre)' : 'verbe ' + MODEL_VERB_FR) + ' ?',
      choices: shuffle([{ text: onNoun ? nounMeaning : verbMeaning, ok: true }, { text: onNoun ? verbMeaning : nounMeaning, ok: false }].concat(otherMeanings.map(t => ({ text: t, ok: false })))),
      why: onNoun ? 'Avec un nom, le pronom est un possessif : ' + nounMeaning + '.' : 'Avec un verbe, le pronom est un complément : ' + verbMeaning + '.',
      reveal: onNoun ? { base: pid === '1' ? 'كِتَابِ' : 'كِتَابُ', end: pid === '1' ? 'ي' : POSS.find(x => x.id === pid).end.slice(1), fr: frPoss({ noun: 'livre', fem: false }, pid) } : reveal });
    /* The book's exercise, in the past: أَخْرَجَهُ مِنْ فَصْلِهِ */
    const gen = GEN_HARMONY[pid] || (pid === '1' ? 'ي' : POSS.find(x => x.id === pid).pron);
    const sentence = form(pid) + ' مِنْ فَصْلِ' + gen;
    const frS = id => 'Il ' + objPast(id) + ' de ' + frPoss(CLASSE, id) + (OBJ_PAST_TAG[id] || OBJ[id].tag) + '.';
    app.push({ kind: 'att-phrase', key: 'ap:' + pid, word: 'fasl', promptAr: sentence, prompt: 'Que veut dire cette phrase ? (فَصْلٌ = une classe)',
      choices: shuffle([{ text: frS(pid), ok: true }].concat(others(3).map(o => ({ text: frS(o), ok: false })))),
      why: 'Avec le verbe, ـ' + OBJ[pid].suf + ' = ' + OBJ[pid].fr + ' ; avec le nom, ' + frPoss(CLASSE, pid) + '.' + (GEN_HARMONY[pid] ? ' Après le kasra de فَصْلِ, ـهُ devient ـهِ.' : ''),
      reveal: { base: form(pid) + ' مِنْ فَصْلِ', end: gen, fr: frS(pid) } });
  }
  /* Vocabulary verbs (past) with "him / her / them" */
  for (const v of grammarVerbs().filter(x => x.trans)){
    const ids3 = ['3m', '3f', '3mp', '3fp'];
    if (!pastObjFr(v, '3m')) continue;
    for (const pid of ids3){
      const f = v.ar + OBJ[pid].suf;
      const reveal = { base: v.ar, end: OBJ[pid].suf, fr: pastObjFr(v, pid) };
      const why = 'ـ' + OBJ[pid].suf + ' collé au verbe = « ' + OBJ[pid].fr + ' »' + OBJ[pid].tag + '.';
      app.push({ kind: 'att-pverb-mean', key: 'apm:' + v.id + pid, word: v.id, promptAr: f, prompt: 'Que veut dire ce mot ? (' + v.ar + ' = ' + verbInf(v) + ')',
        choices: shuffle(ids3.map(o => ({ text: pastObjFr(v, o), ok: o === pid }))), why, reveal });
      app.push({ kind: 'att-pverb-build', key: 'apb:' + v.id + pid, word: v.id, prompt: 'Comment dit-on « ' + pastObjFr(v, pid) + ' » ?',
        choices: shuffle(ids3.map(o => ({ text: v.ar + OBJ[o].suf, ok: o === pid, ar: true }))), why, reveal });
    }
  }
}

/* ---- the verbal sentence (lesson "phrase"): verb, subject (ـُ / ـٌ), object (ـَ / ـً) ---- */
const CASE_MARK = { u: 'ُ', a: 'َ', i: 'ِ' };
function nounCase(w, def, c){
  const stem = stripEnd(w.ar);
  if (def) return withAl(stem) + CASE_MARK[c];
  return c === 'a' ? tanwinAn(stem) : stem + (c === 'u' ? 'ٌ' : 'ٍ');
}
function verbFor(v, fem, next){
  if (!fem) return v.ar;
  let f = conjugate(v)['3f'];
  if (next && next.startsWith('ال')) f = f.replace(/ْ$/, 'ِ');
  return f;
}
function frNounPhrase(n, def){ return def ? frDef(n) : (n.fem ? 'une ' : 'un ') + n.noun; }
function frSentence(sn, sd, v, on, od){
  return capFirst(frNounPhrase(sn, sd)) + ' ' + pcText(v, sn.fem ? '3f' : '3m').replace(/^(il|elle)\s+/, '') + (on ? ' ' + frNounPhrase(on, od) : '') + '.';
}
function phraseQuestions(app){
  const frames = (state.grammar && state.grammar.sentences) || [];
  frames.forEach((f, fi) => {
    const v = lookupItem(f.verb), sw = lookupItem(f.subj), ow = f.obj ? lookupItem(f.obj) : null;
    if (!v || !sw || (f.obj && !ow)) return;
    const sn = frNoun(sw), on = ow ? frNoun(ow) : null;
    if (!sn || (ow && !on) || !pcText(v, sn.fem ? '3f' : '3m')) return;
    const combos = ow ? [[true, true], [false, false], [true, false], [false, true]] : [[true, null], [false, null]];
    const word = 'ph' + fi;
    for (const [sd, od] of combos){
      const id = fi + (sd ? 'D' : 'I') + (ow ? (od ? 'D' : 'I') : '');
      const S = nounCase(sw, sd, 'u'), O = ow ? nounCase(ow, od, 'a') : '';
      const V = verbFor(v, sn.fem, S);
      const words = [{ ar: V, role: 'v' }, { ar: S, role: 's' }].concat(ow ? [{ ar: O, role: 'o' }] : []);
      const fr = frSentence(sn, sd, v, on, od);
      const reveal = { svo: words, fr };
      const sWhy = sd ? 'Le sujet a ال : une seule damma (ـُ).' : 'Le sujet n’a pas ال : tanwîn ـٌ (« -un »).';
      const oStem = ow ? stripEnd(ow.ar) : '';
      const oWhy = ow ? (od ? 'Le complément a ال : une seule fatha (ـَ).' : 'Le complément n’a pas ال : tanwîn ـً (« -an »)' + (oStem.endsWith('ة') ? ', sans alif après ة.' : ', écrit avec un alif.')) : '';
      app.push({ kind: 'ph-subj', key: 'ps:' + id, word, tiles: true, sentence: true, before: V + ' ', stem: sd ? withAl(stripEnd(sw.ar)) : stripEnd(sw.ar), after: ow ? ' ' + O : '',
        prompt: 'Quelle terminaison pour le sujet ? « ' + fr + ' »',
        choices: ['ـُ', 'ـٌ', 'ـَ', 'ـً', 'ـِ'].map(t => ({ text: t, ok: t === (sd ? 'ـُ' : 'ـٌ'), ar: true })), why: sWhy, reveal });
      /* Build: French → Arabic, the distractors swap or break the endings */
      const wrongs = ow
        ? [[V, nounCase(sw, sd, 'a'), nounCase(ow, od, 'u')], [V, nounCase(sw, sd, 'a'), O], [V, S, nounCase(ow, od, 'u')], [V, nounCase(sw, !sd, 'u'), nounCase(ow, !od, 'a')]]
        : [[V, nounCase(sw, sd, 'a')], [V, nounCase(sw, sd, 'i')], [V, nounCase(sw, !sd, 'u')]].concat(sn.fem ? [[v.ar, S]] : []);
      const right = words.map(w => w.ar).join(' ');
      const wrongTexts = shuffle(wrongs.map(x => x.join(' ')).filter((t, i, a) => t !== right && a.indexOf(t) === i)).slice(0, 3);
      app.push({ kind: 'ph-build', key: 'pb:' + id, word, prompt: 'Comment dit-on « ' + fr + ' » ?',
        choices: shuffle([{ text: right, ok: true, ar: true }].concat(wrongTexts.map(t => ({ text: t, ok: false, ar: true })))),
        why: ow ? sWhy + ' ' + oWhy : sWhy, reveal });
      if (!ow) continue;
      app.push({ kind: 'ph-obj', key: 'po:' + id, word, tiles: true, sentence: true, before: V + ' ' + S + ' ', stem: od ? withAl(oStem) : oStem, after: '',
        prompt: 'Quelle terminaison pour le complément ? « ' + fr + ' »',
        choices: ['ـُ', 'ـٌ', 'ـَ', oStem.endsWith('ة') ? 'ـً' : 'ـًا', 'ـِ'].map((t, i) => ({ text: t, ok: od ? i === 2 : i === 3, ar: true })), why: oWhy, reveal });
      /* Meaning, sometimes with the object placed before the subject */
      const vos = Math.random() < 0.4;
      const V2 = vos ? verbFor(v, sn.fem, O) : V;
      const shown = vos ? [{ ar: V2, role: 'v' }, { ar: O, role: 'o' }, { ar: S, role: 's' }] : words;
      const cands = [frSentence(on, od, v, sn, sd), frSentence(sn, !sd, v, on, od), frSentence(sn, sd, v, on, !od), frSentence(on, !od, v, sn, !sd)];
      const meanWrong = [cands[0]].concat(shuffle(cands.slice(1))).filter((t, i, a) => t !== fr && a.indexOf(t) === i).slice(0, 3);
      app.push({ kind: 'ph-mean', key: 'pm:' + id + (vos ? 'r' : ''), word, promptAr: shown.map(w => w.ar).join(' '), prompt: 'Que veut dire cette phrase ?',
        choices: shuffle([{ text: fr, ok: true }].concat(meanWrong.map(t => ({ text: t, ok: false })))),
        why: S + ' porte ' + (sd ? 'la damma' : 'le tanwîn ـٌ') + ' : c’est le sujet' + (vos ? ', même placé en dernier.' : '.'),
        reveal: { svo: shown, fr } });
      const role = Math.random() < 0.5 ? 's' : 'o';
      app.push({ kind: 'ph-role', key: 'pr:' + id + role + (vos ? 'r' : ''), word, promptAr: shown.map(w => w.ar).join(' '),
        prompt: role === 's' ? 'Quel mot est le sujet (celui qui fait l’action) ?' : 'Quel mot est le complément (ce qui subit l’action) ?',
        choices: shuffle(shown.map(w => ({ text: w.ar, ok: w.role === role, ar: true }))),
        why: role === 's' ? S + ' porte ' + (sd ? 'une damma (ـُ)' : 'le tanwîn ـٌ') + ' : c’est le sujet.' : O + ' porte ' + (od ? 'une fatha (ـَ)' : 'le tanwîn ـً') + ' : c’est le complément.',
        reveal: { svo: shown, fr } });
    }
  });
}

/* ---- the present (lesson "present"): one of يَـ تَـ أَ نَـ, then the verb ---- */
const PRES_P = [
  { id: '3m', letter: 'ي', label: 'il', pron: 'هُوَ' },
  { id: '3f', letter: 'ت', label: 'elle', pron: 'هِيَ' },
  { id: '2m', letter: 'ت', label: 'tu (garçon)', pron: 'أَنْتَ' },
  { id: '2f', letter: 'ت', label: 'tu (fille)', pron: 'أَنْتِ', ina: true },
  { id: '1',  letter: 'أ', label: 'je', pron: 'أَنَا' },
  { id: '1p', letter: 'ن', label: 'nous', pron: 'نَحْنُ' }
];
const PRES_LETTERS = ['ي', 'ت', 'أ', 'ن'];
const PRES_WHO = { 'ي': 'il (l’absent)', 'ت': 'elle, ou tu (garçon)', 'أ': 'je', 'ن': 'nous', 'ina': 'tu (fille)' };
const VOWEL_NAME = { 'َ': 'une fatha (ـَ)', 'ُ': 'une damma (ـُ)', 'ِ': 'une kasra (ـِ)' };
function presOk(v){ return !!(v && v.pres && v.pr && /^ي[َُ]/.test(v.pres)); }
function presParts(v, pid){
  /* يَكْتُبُ = prefix يَ + كْتُبُ. The prefix letter changes with the person, its vowel stays (يُخْرِجُ → أُخْرِجُ).
     With أَنَا, the prefix أَ and a hamza starting the root merge: يَأْكُلُ → آكُلُ. */
  if (!presOk(v)) return null;
  const P = PRES_P.find(x => x.id === pid); if (!P) return null;
  const vowel = v.pres[1], rest = v.pres.slice(2);
  if (P.letter === 'أ' && rest.startsWith('أْ')) return { pre: 'آ', base: rest.slice(2), merged: true, vowel };
  /* Tu (fille): تَكْتُبِينَ, the final damma becomes ـِينَ. */
  if (P.ina) return { pre: P.letter + vowel, base: rest.replace(/\u064F$/, '\u0650'), end: 'ينَ', vowel };
  return { pre: P.letter + vowel, base: rest, vowel };
}
function presForm(v, pid){ const c = presParts(v, pid); return c ? c.pre + c.base + (c.end || '') : ''; }
function presFr(v, pid){ const pr = v.pr || {}; return pr[pid] || (pid === '2f' ? pr['2m'] || '' : ''); }
function presLabel(v, pid){ return presFr(v, pid) + (pid === '2m' ? ' (garçon)' : pid === '2f' ? ' (fille)' : ''); }
function presWhy(v, P, c){
  if (c.merged) return 'Avec أَنَا, le préfixe أَ et le أْ de la racine se fondent en آ : ' + c.pre + c.base + '.';
  if (P.ina) return 'Pour « tu (fille) » (أَنْتِ) : préfixe ' + c.pre + 'ـ et terminaison ـِينَ.';
  return 'Préfixe ' + c.pre + (P.letter === 'أ' ? '' : 'ـ') + ' pour « ' + P.label + ' » (' + P.pron + ').' + (P.letter === 'ت' ? ' تَـ sert aussi bien pour « elle » que pour « tu ».' : '');
}
function presentQuestions(app){
  for (const v of grammarVerbs().filter(presOk)){
    const inf = verbInf(v);
    const formOf = L => presForm(v, PRES_P.find(x => x.letter === L).id);
    const meaningOf = L => L === 'ت' ? v.pr['3f'] + ', ou ' + presLabel(v, '2m') : L === 'ina' ? presLabel(v, '2f') : v.pr[PRES_P.find(x => x.letter === L).id];
    const hint = ' (au passé : ' + v.ar + ')';
    for (const P of PRES_P){
      if (!presFr(v, P.id)) continue;
      const c = presParts(v, P.id); const form = presForm(v, P.id);
      const L = P.ina ? 'ina' : P.letter;
      const reveal = { pre: c.pre, base: c.base, end: c.end || '', fr: presLabel(v, P.id) };
      const why = presWhy(v, P, c);
      /* Four different forms to choose from; tu (fille) is opposed to elle / tu (garçon). */
      const set = P.ina ? ['ina', 'ت', 'ي', 'أ'] : PRES_LETTERS;
      const formL = x => x === 'ina' ? presForm(v, '2f') : formOf(x);
      app.push({ kind: 'pres-build', key: 'prb:' + v.id + P.id, word: v.id, prompt: 'Comment dit-on « ' + presLabel(v, P.id) + ' » ?' + hint,
        choices: shuffle(set.map(x => ({ text: formL(x), ok: x === L, ar: true }))), why, reveal });
      if (!c.merged){
        app.push({ kind: 'pres-tiles', key: 'prt:' + v.id + P.id, word: v.id, tiles: true, prefix: true, stem: c.base + (c.end || ''),
          prompt: 'Complète pour dire « ' + presLabel(v, P.id) + ' ».',
          choices: PRES_LETTERS.map(x => ({ text: x + c.vowel + (x === 'أ' ? '' : 'ـ'), ok: x === P.letter, ar: true })), why, reveal });
      }
      if (P.id === '2m') continue;
      /* One question per form: who, and what it means (a past form of the same person as a trap). */
      const rv = P.id === '3f' ? { pre: c.pre, base: c.base, fr: meaningOf(L) } : reveal;
      const whoSet = P.ina ? ['ina', 'ت', 'ي', 'أ'] : PRES_LETTERS;
      app.push({ kind: 'pres-who', key: 'prw:' + v.id + L, word: v.id, promptAr: form, prompt: 'Qui fait l’action ?',
        choices: shuffle(whoSet.map(x => ({ text: PRES_WHO[x], ok: x === L }))), why, reveal: rv });
      const past = pcLabel(v, P.id) || pcText(v, P.id);
      const others = shuffle(whoSet.filter(x => x !== L)).slice(0, past ? 2 : 3).map(x => ({ text: meaningOf(x), ok: false }));
      app.push({ kind: 'pres-mean', key: 'prm:' + v.id + L, word: v.id, promptAr: form, prompt: 'Que veut dire ce mot ?',
        choices: shuffle([{ text: meaningOf(L), ok: true }].concat(others, past ? [{ text: past, ok: false }] : [])),
        why: why + ' Le présent commence par un préfixe ; le passé, lui, n’en a pas.', reveal: rv });
    }
    /* The vowel of the 3rd letter, learnt with each verb. */
    const rest = v.pres.slice(2);
    const m = /^(.)ْ(.)([َُِ])(.)ُ$/.exec(rest);
    if (m){
      const pv = v.pres[1];
      const variants = ['َ', 'ُ', 'ِ'].filter(x => x !== m[3]).map(x => 'ي' + pv + m[1] + 'ْ' + m[2] + x + m[4] + 'ُ');
      variants.push('ي' + (pv === 'َ' ? 'ُ' : 'َ') + rest);
      app.push({ kind: 'pres-vowel', key: 'prv:' + v.id, word: v.id, prompt: 'Comment dit-on « ' + v.pr['3m'] + ' » ?' + hint,
        choices: shuffle([{ text: v.pres, ok: true, ar: true }].concat(variants.map(t => ({ text: t, ok: false, ar: true })))),
        why: 'La 3e lettre de ' + v.pres + ' prend ' + VOWEL_NAME[m[3]] + ' : cette voyelle s’apprend avec chaque verbe. Le préfixe a une fatha, car ' + v.ar + ' n’a que 3 lettres.',
        reveal: { pre: v.pres.slice(0, 2), base: rest, fr: v.pr['3m'] + ' (' + inf + ')' } });
    }
  }
}

function buildGrammarPool(lesson, opts){
  const want = id => lesson === 'all' || lesson === id || (String(lesson).startsWith('sec:') && lessonSection(id) === lesson.slice(4));
  const num = lesson === 'passe' ? (opts && opts.num) || 'all' : 'all';
  const rules = ((state.grammar && state.grammar.rules) || []).filter(r => want(r.lesson) && (num === 'all' || (r.num || 's') === num || r.num === 'all')).map(r => ({
    kind: 'rule', key: 'rule:' + r.q, prompt: r.q,
    choices: shuffle([{ text: r.a, ok: true, ar: !!r.ar }].concat(r.wrong.map(t => ({ text: t, ok: false, ar: !!r.ar })))),
    why: r.why || ''
  }));
  const app = [];
  const nouns = grammarNouns();
  const possFor = (lid, list) => {
    const set = POSS.filter(p => POSS_SETS[lid].includes(p.id));
    for (const w of list){
      const n = frNoun(w); const stem = attachStem(stripEnd(w.ar));
      const [b, l] = splitLast(stem);
      const ctx = p => possCtx(p.id, lid);
      const lab = p => lid === 'attaches' ? attLabel(p.id) : p.label;
      for (const p of set){
        const form = stem + p.end, fr = frPoss(n, p.id);
        const reveal = { base: b, end: l + p.end, fr: fr + ctx(p) };
        app.push({ kind: 'poss-build', key: 'pb:' + w.id + p.id, word: w.id,
          prompt: 'Comment dit-on « ' + fr + ' »' + ctx(p) + ' ?',
          choices: shuffle([{ text: form, ok: true, ar: true }].concat(pickOthers(set, p, 3).map(o => ({ text: stem + o.end, ok: false, ar: true })))),
          why: p.pron + ' = ' + lab(p) + '.', reveal });
        app.push({ kind: 'poss-mean', key: 'pm:' + w.id + p.id, word: w.id, promptAr: form, prompt: 'Que veut dire ce mot ?',
          choices: shuffle([{ text: fr + ctx(p), ok: true }].concat(pickOthers(set.filter(o => frPoss(n, o.id) + ctx(o) !== fr + ctx(p)), p, 3).map(o => ({ text: frPoss(n, o.id) + ctx(o), ok: false })))),
          why: p.pron + ' = ' + lab(p) + '.', reveal });
        const tileSet = set.length > 5 ? [p].concat(pickOthers(set, p, 4)) : set;
        app.push({ kind: 'poss-tiles', key: 'pt:' + w.id + p.id, word: w.id, tiles: true, stem,
          prompt: 'Complète pour dire « ' + fr + ' »' + ctx(p) + '.',
          choices: set.filter(o => tileSet.includes(o)).map(o => ({ text: o.tile, ok: o === p, ar: true })),
          why: p.pron + ' = ' + lab(p) + '.', reveal });
      }
      if (w.plural && n.plural && lid === 'pronoms'){
        const pstem = attachStem(stripEnd(w.plural)); const [pb, pl] = splitLast(pstem);
        for (const p of set){
          const form = pstem + p.end, fr = frPoss(n, p.id, true);
          app.push({ kind: 'poss-plural', key: 'pp:' + w.id + p.id, word: w.id, promptAr: form, prompt: 'Que veut dire ce mot ? (' + w.plural + ' est le pluriel de ' + w.ar + ')',
            choices: shuffle([{ text: fr + p.ctx, ok: true }].concat([frNoun(w) && frPoss(n, p.id, false) + p.ctx].concat(pickOthers(set, p, 2).map(o => frPoss(n, o.id, true) + o.ctx)).map(t => ({ text: t, ok: false })))),
            why: 'Le nom est au pluriel, donc le pronom s’accorde : ' + fr + '.', reveal: { base: pb, end: pl + p.end, fr: fr + p.ctx } });
        }
      }
    }
  };
  if (want('pronoms')) possFor('pronoms', nouns);
  if (want('attaches')){
    possFor('attaches', nouns.concat(grammarExtraNouns('attaches')));
    attachedVerbQuestions(app);
  }
  if (want('nom')){
    const others = grammarVerbs().map(v => v.ar).concat(PARTICLES);
    for (const w of nouns){
      const n = frNoun(w); const stem = stripEnd(w.ar); const [b, l] = splitLast(stem);
      const def = frDef(n); const al = 'بِ' + withAl(stem);
      const [ab, alast] = splitLast(al);
      const inWhy = 'Après بِ, le nom indéfini se termine par « -in » (ـٍ).';
      const alWhy = 'Avec ال, le nom perd son tanwîn : il se termine par « -i » (ـِ) et non « -in ».';
      app.push({ kind: 'prep-build', key: 'nb:' + w.id, word: w.id, prompt: 'Comment dit-on « avec ' + w.fr + ' » ?',
        choices: shuffle([{ text: 'بِ' + stem + '\u064D', ok: true, ar: true }, { text: 'بِ' + stem + '\u064C', ok: false, ar: true }, { text: 'بِ' + tanwinAn(stem), ok: false, ar: true }, { text: stem + '\u064D', ok: false, ar: true }]),
        why: inWhy, reveal: { pre: 'بِ', base: b, end: l + '\u064D', fr: 'avec ' + w.fr } });
      app.push({ kind: 'prep-tiles', key: 'nt:' + w.id, word: w.id, tiles: true, stem: 'بِ' + stem, prompt: 'Complète pour dire « avec ' + w.fr + ' ».',
        choices: [['ـٍ', true], ['ـٌ', false], ['ـً', false], ['ـْ', false]].map(([t, ok]) => ({ text: t, ok, ar: true })),
        why: inWhy, reveal: { pre: 'بِ', base: b, end: l + '\u064D', fr: 'avec ' + w.fr } });
      const tw = [['\u064C', '« -un »'], [tanwinAn(stem).slice(stem.length), '« -an »'], ['\u064D', '« -in »']][Math.floor(Math.random() * 3)];
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
    const num = lesson === 'passe' ? (opts && opts.num) || 'all' : 'all';
    const pers = PERS.filter(p => num === 'all' || p.n === num);
    const whyOf = p => p.id === '3m' ? 'La forme de base correspond à « il ».' : 'Terminaison ' + p.tile + ' pour « ' + p.label + ' » (' + p.pron + ').';
    for (const v of grammarVerbs()){
      const forms = conjugate(v); const inf = verbInf(v);
      for (const p of pers){
        const form = forms[p.id];
        const c = conjParts(v, p);
        const reveal = p.id === '3m' ? { base: form, end: '', fr: pcLabel(v, p.id) || ('il : ' + inf), plain: true } : { base: c.base, end: c.end, fr: pcLabel(v, p.id) || (p.label + ' : ' + inf) };
        const why = whyOf(p);
        /* Distractors: mostly from the same number (singular or plural), so the choice stays meaningful. */
        const others = n => { const same = pickOthers(PERS.filter(o => o.n === p.n), p, n); return same.length >= n ? same : same.concat(pickOthers(PERS.filter(o => o.n !== p.n), null, n - same.length)); };
        const mix = n => shuffle(others(2).concat(pickOthers(PERS.filter(o => o.n !== p.n), null, n - 2)));
        app.push({ kind: 'conj-build', key: 'cb:' + v.id + p.id, word: v.id,
          prompt: 'Conjugue « ' + v.ar + ' » (' + inf + ') au passé avec « ' + p.label + ' ».',
          choices: shuffle([{ text: form, ok: true, ar: true }].concat(mix(3).map(o => ({ text: forms[o.id], ok: false, ar: true })))),
          why, reveal });
        app.push({ kind: 'conj-who', key: 'cw:' + v.id + p.id, word: v.id, promptAr: form, prompt: 'Qui a fait l’action ?',
          choices: shuffle([{ text: p.who, ok: true }].concat(mix(3).map(o => ({ text: o.who, ok: false })))),
          why, reveal });
        if (pcText(v, p.id)){
          const opts3 = mix(3).filter(o => pcText(v, o.id));
          if (opts3.length === 3){
            app.push({ kind: 'conj-mean', key: 'cm:' + v.id + p.id, word: v.id, promptAr: form, prompt: 'Que veut dire ce mot ?',
              choices: shuffle([{ text: pcLabel(v, p.id), ok: true }].concat(opts3.map(o => ({ text: pcLabel(v, o.id), ok: false })))),
              why, reveal });
          }
        }
        if (!forms.merged){
          const set = new Set([p].concat(others(2), pickOthers(PERS.filter(o => o.n !== p.n), null, 2)));
          app.push({ kind: 'conj-tiles', key: 'ct:' + v.id + p.id, word: v.id, tiles: true, stem: verbStem(v.ar),
            prompt: 'Complète pour dire « ' + (pcLabel(v, p.id) || (p.label + ' : ' + inf)) + ' ».',
            choices: PERS.filter(o => set.has(o)).map(o => ({ text: o.tile, ok: o === p, ar: true })),
            why, reveal });
        }
      }
    }
  }
  if (want('phrase')) phraseQuestions(app);
  if (want('present')) presentQuestions(app);
  const seen = new Set();
  return { rules, app: app.filter(q => !seen.has(q.key) && seen.add(q.key)) };
}
function sampleGrammar(lesson, count, opts){
  const { rules, app } = buildGrammarPool(lesson, opts);
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
  const L = lesson || gLesson(curSection());
  const queue = override || sampleGrammar(L, o.count === 'all' ? 999 : Number(o.count) || 10, o);
  if (!queue.length){ toast('Pas encore d’exercices pour cette leçon.'); return; }
  state.session = { kind: 'grammar', lesson: L, queue, idx: 0, answered: false, picked: -1, correct: 0, mistakes: [], finished: false, startedAt: Date.now(), histId: newId('h') };
  state.lessonId = null;
  render(); scrollTop();
}
function revealHtml(r){
  if (!r) return '';
  if (r.svo) return '<div class="reveal"><div class="reveal-svo">' + svoWords(r.svo) + '</div><p class="reveal-fr">' + arWrap(r.fr) + '</p></div>';
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
  if (q.tiles && q.prefix){
    top = '<p class="ar big tiles-stem" lang="ar" dir="rtl"><span class="slot">' + (s.answered ? esc(q.choices[s.picked].text) : '؟') + '</span><span>' + esc('ـ' + q.stem) + '</span></p>';
  }
  else if (q.tiles){
    const joins = JOINS_NEXT.includes(String(q.stem).replace(HARAKA_RE, '').slice(-1));
    top = '<p class="ar big tiles-stem' + (q.sentence ? ' sentence' : '') + '" lang="ar" dir="rtl"><span>' + esc((q.before || '') + q.stem + (joins ? 'ـ' : '')) + '</span><span class="slot">' + (s.answered ? esc(q.choices[s.picked].text) : '؟') + '</span>' + (q.after ? '<span>' + esc(q.after) + '</span>' : '') + '</p>';
  }
  else if (q.promptAr) top = '<p class="ar big' + (q.promptAr.includes(' ') ? ' sentence' : '') + '" lang="ar" dir="rtl">' + esc(q.promptAr) + '</p>';
  const label = q.kind === 'rule' ? 'Règle' : q.kind.startsWith('poss') ? 'Pronoms' : q.kind.startsWith('conj') ? 'Conjugaison' : q.kind.startsWith('att') ? 'Pronoms attachés' : q.kind.startsWith('ph') ? 'La phrase verbale' : q.kind.startsWith('pres-') ? 'Le présent' : 'Le nom';
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
      '<div class="after"><button type="button" class="btn primary big" id="nextQ" data-action="gnext">' + (last ? 'Voir le résultat' : 'Question suivante') + '</button>' + askLink('ask-q') + reportLink('report-q') + '</div>';
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

function grammarTrainHtml(sec){
  sec = sec || curSection();
  const lessons = sectionLessons(sec); const o = state.grammarOpts; const cur = gLesson(sec);
  const lastRun = state.history.filter(h => h.type === 'grammar' && h.total && runSection(h.lesson) === sec).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  const lessonOpts = lessons.map(l => [l.id, l.title.replace(/^Les? /, '').replace(/^La /, '').replace(/^./, c => c.toUpperCase())])
    .concat(lessons.length > 1 ? [['sec:' + sec, lessons.length === 2 ? 'Les deux' : 'Toutes les leçons']] : []);
  const lessonCtl = lessonOpts.length <= 3
    ? '<div class="field"><span class="label" id="gLessonLabel">Leçon</span>' + seg('glesson', cur, lessonOpts, 'gLessonLabel') + '</div>'
    : '<label class="field"><span class="label">Leçon</span><select id="gLessonSel">' + lessonOpts.map(([v, l]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>';
  return '<p class="hint">' + (sec === 'conjugaison'
      ? 'Des questions sur les règles et des exercices avec les verbes du cours, au passé (singulier, duel, pluriel) et au présent.'
      : 'Des questions sur les règles et des exercices construits avec le vocabulaire du cours. Ils s’enrichissent à chaque nouvelle semaine.') + '</p>' +
    lessonCtl +
    (cur === 'passe' ? '<div class="field"><span class="label" id="gNumLabel">Personnes</span>' + seg('gnum', o.num || 'all', [['s', 'Singulier'], ['d', 'Duel'], ['p', 'Pluriel'], ['all', 'Tout']], 'gNumLabel') + '</div>' : '') +
    '<div class="field"><span class="label" id="gCountLabel">Nombre de questions</span>' + seg('gcount', String(o.count), [['10', '10'], ['20', '20']], 'gCountLabel') + '</div>' +
    '<button type="button" class="btn primary big" data-action="gstart">Commencer les exercices</button>' +
    (lastRun ? '<p class="hint">Dernier entraînement : ' + lastRun.correct + ' / ' + lastRun.total + ', ' + esc(fmtShort(lastRun.at)).replace(/\.$/, '') + '.</p>' : '');
}
function lessonLabel(id){
  id = String(id || '');
  if (id === 'sec:conjugaison') return 'la conjugaison';
  if (id === 'sec:grammaire') return 'la grammaire';
  if (id.startsWith('verb:')){ const v = lookupItem(id.slice(5)); return v ? 'le verbe ' + v.ar : 'un verbe'; }
  const l = grammarLessons().find(x => x.id === id); return l ? l.title : 'toutes les leçons';
}

/* ---- two parts in the Grammaire tab: grammar and conjugation (lessons with "section": "conjugaison") ---- */
function lessonSection(id){ const l = grammarLessons().find(x => x.id === id); return l && l.section === 'conjugaison' ? 'conjugaison' : 'grammaire'; }
function sectionLessons(sec){ return grammarLessons().filter(l => lessonSection(l.id) === sec); }
function runSection(lesson){ lesson = String(lesson || ''); return lesson.startsWith('sec:') ? lesson.slice(4) : lesson.startsWith('verb:') ? 'conjugaison' : lesson === 'all' ? 'grammaire' : lessonSection(lesson); }
function curSection(){ return state.tab === 'review' ? (state.reviseMode === 'conj' ? 'conjugaison' : 'grammaire') : state.gramSection; }
/* The lesson chosen for the exercises, remembered for each part. */
function gLesson(sec){
  const o = state.grammarOpts;
  const v = (o.bySec && o.bySec[sec]) || o.lesson;
  const lessons = sectionLessons(sec);
  if (v && lessons.some(l => l.id === v)) return v;
  return lessons.length === 1 ? lessons[0].id : 'sec:' + sec;
}
function setGLesson(value){
  const o = state.grammarOpts;
  o.bySec = Object.assign({}, o.bySec, { [curSection()]: value }); o.lesson = value;
  lsSet(LS + 'gopts', JSON.stringify(o));
}
function prefixHighlight(pre, rest){ return '<span class="w">' + splitHtml([[pre, 'hl'], [rest, '']]) + '</span>'; }
function sectionHero(sec){
  return sec === 'conjugaison' ? highlight('دَرَسْ', 'تُ') + ' ' + highlight('دَرَسْ', 'تُمَا') + ' ' + prefixHighlight('يَ', 'دْرُسُ')
    : highlight('كِتَا', 'بُكَ') + ' ' + highlight('بِقَلَ', 'مٍ');
}
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
  const sec = state.gramSection === 'conjugaison' ? 'conjugaison' : 'grammaire';
  const conj = sec === 'conjugaison';
  const list = sectionLessons(sec);
  const otherNew = sectionLessons(conj ? 'grammaire' : 'conjugaison').some(isSpotlit);
  setView('<section class="stack">' +
    '<h1 class="h1">' + (conj ? 'Conjugaison' : 'Grammaire') + '</h1>' + notes() +
    '<div class="field">' + seg('gsection', sec, [['grammaire', 'Grammaire'], ['conjugaison', 'Conjugaison']], 'gSecL') + '<span class="sr" id="gSecL">Partie</span>' +
      (otherNew ? '<p class="hint sec-new">Du nouveau aussi en ' + (conj ? 'grammaire' : 'conjugaison') + '.</p>' : '') + '</div>' +
    '<div class="sheet gram-hero"><p class="sheet-meta"><span>' + plural(list.length, 'leçon', 'leçons') + '</span><span>' + (conj ? plural(conjVerbs().length, 'verbe', 'verbes') : esc(list.map(l => 'semaine ' + l.week).filter((v, i, a) => a.indexOf(v) === i).join(', '))) + '</span></p>' +
      '<p class="ar gram-hero-ar" lang="ar" dir="rtl">' + sectionHero(sec) + '</p></div>' +
    '<h2 class="h2">S’entraîner</h2>' + grammarTrainHtml(sec) +
    '<h2 class="h2">Leçons</h2>' +
    '<div class="modes">' + list.map(l =>
      '<button type="button" class="mode" data-action="lesson" data-id="' + esc(l.id) + '"><span class="mode-text"><b>' + esc(l.title) + (isSpotlit(l) ? ' <span class="new-chip">Nouveau</span>' : '') + '</b><span>' + arWrap(l.subtitle) + ', semaine ' + l.week + '</span></span>' + ICON.chevron + '</button>').join('') +
    '</div>' +
    (conj ? conjugatorHtml() : '') +
    '</section>');
}

/* ---- the conjugator: every course verb, past and present, with the subject letters in red ---- */
const CONJ_LAB = [['الغائِب', 'absent(s)'], ['الغائِبَة', 'absente(s)'], ['المُخاطَب', 'interlocu­teur(s)'], ['المُخاطَبَة', 'interlocu­trice(s)'], ['المُتَكَلِّم', 'locuteur(s)']];
const CONJ_GRID = [['3m', '3md', '3mp'], ['3f', '3fd', '3fp'], ['2m', '2d', '2mp'], ['2f', '2d', '2fp'], ['1', '1p', '1p']];
const CONJ_COLS = [{ ar: 'المُفرَد', fr: 'Singulier' }, { ar: 'المُثَنَّى', fr: 'Duel' }, { ar: 'الجَمع', fr: 'Pluriel' }];
function conjVerbs(){
  const all = grammarVerbs().filter(v => v.pc && v.pc['3m']);
  return all.filter(v => v.week).sort((a, b) => (a.week - b.week) || ((a.createdAt || 0) - (b.createdAt || 0))).concat(all.filter(v => !v.week));
}
function conjAudio(v, key){
  const m = ((state.grammar && state.grammar.conjugueur && state.grammar.conjugueur.audio) || {})[v.id] || {};
  return m[key] || (key === '3m' ? v.audio || '' : '');
}
function pastCell(v, pid){
  const P = PERS.find(p => p.id === pid); const c = conjParts(v, P); const form = c.base + c.end;
  let cell;
  if (pid === '3m' || pid === '3f' || !c.end) cell = { base: form, end: '' };
  else if (pid === '3fd') cell = { base: form.slice(0, -1), end: 'ا' };
  else if (pid === '3mp') cell = { base: form.slice(0, -2), end: 'و', post: 'ا' };
  else cell = { base: c.base, end: c.end };
  return Object.assign(cell, { pron: P.pron, fr: pcText(v, pid), audio: conjAudio(v, pid) });
}
function presCell(v, pid){
  const P = PRES_P.find(x => x.id === pid); const c = presParts(v, pid);
  return { pron: P.pron, pre: c.pre, base: c.base, end: c.end || '', fr: presFr(v, pid), audio: conjAudio(v, 'p' + (pid === '2m' ? '3f' : pid)) };
}
function conjugatorHtml(){
  const verbs = conjVerbs(); if (!verbs.length) return '';
  return '<h2 class="h2">Le conjugueur</h2>' +
    '<p class="hint">Choisis un verbe du cours pour voir tous ses tableaux, au passé et au présent, avec la prononciation.</p>' +
    '<div class="verb-grid">' + verbs.map(v =>
      '<button type="button" class="verb-chip" data-action="conj-verb" data-id="' + esc(v.id) + '"><span class="ar" lang="ar" dir="rtl">' + esc(v.ar) + '</span><small>' + esc(verbInf(v)) + '</small></button>').join('') + '</div>';
}
function renderConjVerb(){
  const v = lookupItem(state.conjVerb);
  if (!v || !v.pc){ state.conjVerb = null; return render(); }
  const past = { caption: 'Le passé de ' + v.ar, cols: CONJ_COLS, rows: CONJ_GRID.map((ids, i) => ({ ar: CONJ_LAB[i][0], fr: CONJ_LAB[i][1], cells: ids.map(id => pastCell(v, id)) })) };
  const f3 = conjugate(v);
  const notesPast = ['En rouge, les lettres du sujet. Rien en rouge pour هُوَ ' + v.ar + ' et هِيَ ' + f3['3f'] + ' : le تْ indique seulement le féminin.',
    'Le duel se traduit en français comme le pluriel.'];
  if (f3.merged) notesPast.push('Le ت de la racine et celui de la terminaison se fondent avec une chadda : ' + f3['1'] + '.');
  let presHtml = '';
  if (presOk(v)){
    const pres = { caption: 'Le présent de ' + v.ar, cols: [CONJ_COLS[0]], rows: ['3m', '3f', '2m', '2f', '1'].map((id, i) => ({ ar: CONJ_LAB[i][0], fr: CONJ_LAB[i][1].replace('(s)', ''), cells: [presCell(v, id)] })) };
    const n = presParts(v, '1p');
    const m = /^.ْ.([َُِ])/.exec(v.pres.slice(2));
    const notesPres = [];
    if (m) notesPres.push('La 3e lettre de ' + v.pres + ' prend ' + VOWEL_NAME[m[1]] + ' : cette voyelle s’apprend avec chaque verbe.');
    if (presParts(v, '1').merged) notesPres.push('Avec أَنَا : ' + presForm(v, '1') + '. Le أَ du préfixe et le أْ de la racine se fondent en آ.');
    notesPres.push('هِيَ ' + presForm(v, '3f') + ' et أَنْتَ ' + presForm(v, '2m') + ' s’écrivent pareil.');
    presHtml = '<h2 class="h2 lesson-h">Au présent</h2>' + conjTable(pres) +
      '<div class="sheet lesson-sheet">' + lessonRows([{ pre: n.pre, base: n.base, fr: presFr(v, '1p'), label: 'نَحْنُ : pour deux comme pour trois ou plus', audio: conjAudio(v, 'p1p') }]) + '</div>' +
      notesPres.map(t => '<p class="note rule-note">' + arWrap(t) + '</p>').join('');
  }
  setView('<section class="stack">' +
    '<button type="button" class="btn text" data-action="conj-back">Retour</button>' +
    '<h1 class="h1 verb-h1"><span class="ar" lang="ar" dir="rtl">' + esc(v.ar) + '</span><span>' + esc(verbInf(v)) + '</span></h1>' +
    '<p class="hint">' + arWrap((v.root ? 'Racine ' + v.root + ', ' : '') + (v.week ? 'vocabulaire de la semaine ' + v.week : 'verbe modèle de la leçon sur le passé')) + '. Touche une case pour l’écouter.</p>' +
    '<h2 class="h2 lesson-h">Au passé</h2>' + conjTable(past) +
    notesPast.map(t => '<p class="note rule-note">' + arWrap(t) + '</p>').join('') +
    presHtml +
    '<button type="button" class="btn primary big" data-action="conj-train" data-id="' + esc(v.id) + '">S’entraîner sur ce verbe</button>' +
    '</section>');
}
function startVerbTraining(id){
  const { app } = buildGrammarPool('sec:conjugaison', { num: 'all' });
  const byKind = {};
  shuffle(app.filter(q => q.word === id)).forEach(q => { (byKind[q.kind] = byKind[q.kind] || []).push(q); });
  const kinds = Object.keys(byKind); const out = [];
  while (out.length < 10 && kinds.some(k => byKind[k].length)){
    for (const k of shuffle(kinds)) if (byKind[k].length && out.length < 10) out.push(byKind[k].pop());
  }
  if (!out.length){ toast('Pas encore d’exercices pour ce verbe.'); return; }
  startGrammar('verb:' + id, shuffle(out));
}
/* Letters that connect to the next one. When a word is split into coloured parts, a zero-width
   joiner on each side of the cut keeps the letters connected even where a browser shapes each part
   on its own (older Safari). */
const JOINS_NEXT = 'بتثجحخسشصضطظعغفقكلمنهيئىـ';
function joinCut(a, b){
  const last = String(a).replace(HARAKA_RE, '').replace(/\u0651/g, '').slice(-1);
  return a && b && JOINS_NEXT.includes(last) && /^[\u0620-\u064A]/.test(b) ? ['\u200D', '\u200D'] : ['', ''];
}
function splitHtml(parts){
  /* parts: [[text, className], …] → spans with joiners between connected letters. */
  return parts.filter(p => p[0]).map((p, i, arr) => {
    const before = i > 0 ? joinCut(arr[i - 1][0], p[0])[1] : '';
    const after = i < arr.length - 1 ? joinCut(p[0], arr[i + 1][0])[0] : '';
    return '<span' + (p[1] ? ' class="' + p[1] + '"' : '') + '>' + before + esc(p[0]) + after + '</span>';
  }).join('');
}
function rowHtml(r){
  if (r.plain) return esc((r.pre || '') + (r.base || '') + (r.end || ''));
  return '<span class="w">' + splitHtml([[r.pre || '', 'hl'], [r.base || '', ''], [r.end || '', 'hl']]) + '</span>';
}
function conjCell(c){
  const ar = (c.pron ? '<span class="conj-pron">' + esc(c.pron) + '</span> ' : '') + '<span class="w">' + splitHtml([[c.pre || '', 'end'], [c.base || '', ''], [c.end || '', 'end'], [c.post || '', '']]) + '</span>';
  const inner = '<span class="ar conj-ar" lang="ar">' + ar + '</span><small class="conj-fr" dir="ltr" lang="fr">' + esc(c.fr || '') + '</small>';
  if (!c.audio) return '<span class="conj-cell">' + inner + '</span>';
  return '<button type="button" class="conj-cell" data-action="lplay" data-src="' + esc(c.audio) + '"><span class="sr">Écouter</span>' + inner + '<span class="conj-spk" aria-hidden="true">' + ICON.speaker + '</span></button>';
}
const ROLE_FR = { v: 'verbe', s: 'sujet', o: 'complément' };
function caseSplit(ar){
  /* The case ending sits on the last letter (with ًا, on the letter before the alif). */
  if (/\u064B\u0627$/.test(ar)){ const [b, l] = splitLast(ar.slice(0, -2)); return [b, l + '\u064B\u0627']; }
  return splitLast(ar);
}
function svoWords(words){
  return '<span class="svo-line" dir="rtl">' + words.map(w => {
    const parts = w.parts || (w.role === 'v' ? [[w.ar, '']] : (([b, e]) => [[b, ''], [e, 'end']])(caseSplit(w.ar)));
    return '<span class="svo-w svo-' + w.role + (w.parts && w.role === 'v' ? ' svo-vs' : '') + '"><span class="ar svo-ar" lang="ar">' + splitHtml(parts) + '</span><small class="svo-l" lang="fr">' + esc(w.l || ROLE_FR[w.role]) + '</small></span>';
  }).join('') + '</span>';
}
function svoBlock(b){
  return '<figure class="svo">' + svoWords(b.words || []) +
    '<div class="svo-cap">' + (b.audio ? '<button type="button" class="icon-btn" data-action="lplay" data-src="' + esc(b.audio) + '" aria-label="Écouter">' + ICON.speaker + '</button>' : '') +
    '<span class="svo-fr">' + arWrap(b.fr || '') + '</span></div>' +
    (b.note ? '<p class="svo-note">' + arWrap(b.note) + '</p>' : '') + '</figure>';
}
function ptableCell(c){
  return '<div class="pt-cell"><span class="ar pt-p" lang="ar" dir="rtl">' + esc(c.p) + '</span>' +
    '<span class="pt-l" dir="ltr"><b>+ nom</b> ' + esc(c.nom) + '</span><span class="pt-l" dir="ltr"><b>+ verbe</b> ' + arWrap(c.verbe) + '</span></div>';
}
function conjTable(b, cellFn){
  cellFn = cellFn || conjCell;
  const head = (b.cols || []).map(c => '<th scope="col"><span class="ar" lang="ar">' + esc(c.ar) + '</span><small dir="ltr" lang="fr">' + esc(c.fr) + '</small></th>').join('');
  const body = (b.rows || []).map(r => '<tr><th scope="row"><span class="ar" lang="ar">' + esc(r.ar) + '</span><small dir="ltr" lang="fr">' + esc(r.fr) + '</small></th>' +
    (r.cells || []).map(c => '<td>' + cellFn(c) + '</td>').join('') + '</tr>').join('');
  return '<figure class="conj">' + (b.caption ? '<figcaption class="sr">' + esc(b.caption) + '</figcaption>' : '') +
    '<table class="conj-t cols-' + (b.cols || []).length + (cellFn === ptableCell ? ' pt-t' : '') + '" dir="rtl"><thead><tr><td class="conj-corner"></td>' + head + '</tr></thead><tbody>' + body + '</tbody></table></figure>';
}
function lessonRows(rows){
  return '<ul class="lesson-rows">' + rows.map((r, i) =>
    '<li><div class="lr-ar"><p class="ar" lang="ar" dir="rtl">' + rowHtml(r) + '</p>' +
      (r.audio ? '<button type="button" class="icon-btn" data-action="lplay" data-src="' + esc(r.audio) + '" aria-label="Écouter">' + ICON.speaker + '</button>' : '') + '</div>' +
      '<div class="lr-fr"><b>' + esc(r.fr) + '</b><span>' + arWrap(r.label || '') + '</span></div></li>').join('') + '</ul>';
}
function lessonBlock(b){
  if (b.type === 'h') return '<h2 class="h2 lesson-h">' + arWrap(b.text) + (isNewItem(b) ? ' <span class="new-chip">Nouveau</span>' : '') + '</h2>';
  if (b.type === 'text') return '<p class="lesson-text">' + arWrap(b.text) + '</p>';
  if (b.type === 'note') return '<p class="note rule-note">' + arWrap(b.text) + '</p>';
  if (b.type === 'rows') return '<div class="sheet lesson-sheet">' + lessonRows(b.rows || []) + '</div>';
  if (b.type === 'conj') return conjTable(b);
  if (b.type === 'ptable') return conjTable(b, ptableCell);
  if (b.type === 'svo') return svoBlock(b);
  if (b.type === 'quote') return '<figure class="quote"><p class="ar quote-ar" lang="ar" dir="rtl">' + esc(b.ar) + '</p>' +
    '<figcaption>' + (b.audio ? '<button type="button" class="icon-btn" data-action="lplay" data-src="' + esc(b.audio) + '" aria-label="Écouter">' + ICON.speaker + '</button>' : '') +
    '<span>' + arWrap(b.fr || '') + '</span></figcaption></figure>';
  return '';
}
function retenirHtml(l){
  if (!l.retenir || !l.retenir.length) return '';
  return '<h2 class="h2 lesson-h">L’essentiel à retenir</h2><ul class="retenir">' + l.retenir.map(r =>
    '<li>' + arWrap(r.text) + (r.week ? ' <small>semaine ' + r.week + '</small>' : '') + '</li>').join('') + '</ul>';
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
    (l.legend ? '<p class="hint">' + arWrap(l.legend) + '</p>' : '') +
    retenirHtml(l) +
    '<button type="button" class="btn primary big" data-action="lesson-train" data-id="' + esc(l.id) + '">S’entraîner sur cette leçon</button>' +
    askLink('ask-lesson', 'Demander une explication sur cette leçon', l.id) +
    '<button type="button" class="btn text report-link" data-action="report-lesson" data-id="' + esc(l.id) + '">Signaler une erreur dans cette fiche</button>' +
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
function hasNewLessons(){ return grammarLessons().some(isNewItem); }
function hasNewWords(){ return state.words.some(isNewItem); }
function isSpotlit(l){ return isNewItem(l); }
function refreshGrammarBadge(){
  const g = document.querySelector('.tabs button[data-tab="grammar"]');
  if (g){
    const fresh = hasNewLessons();
    g.classList.toggle('spotlight', fresh);
    g.classList.toggle('has-new', fresh || (lsGet(K_GRAMVISIT) !== '1' && grammarLessons().length > 0));
  }
  const v = document.querySelector('.tabs button[data-tab="list"]');
  if (v){ const fresh = hasNewWords(); v.classList.toggle('spotlight', fresh); v.classList.toggle('has-new', fresh); }
  const r = document.querySelector('.tabs button[data-tab="reader"]');
  if (r){ const fresh = practiceNew() && lsGet(K_PRACVISIT) !== '1'; r.classList.toggle('spotlight', fresh); r.classList.toggle('has-new', fresh); }
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
    (Reports.admin ? '<div class="field" id="reportsBox">' + reportsHtml() + '</div>' : '') +
    (Cloud.status === 'disabled' ? '' : '<div class="field" id="accountBox">' + accountHtml() + '</div><div class="field" id="notifBox">' + notifHtml() + '</div>') +
    '<div class="field" id="offlineBox">' + offlineHtml() + '</div>' +
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

/* ---------- Pratique: translation and blank sheet on paper, alphabet and dictation sites ---------- */
const PRACTICE_ADDED = '2026-11-04T08:00:00+01:00';
const K_PRACVISIT = LS + 'practice-visited-v1';
function practiceNew(){ return isNewItem({ added: PRACTICE_ADDED }); }
function practiceMode(value, title, text, fresh){
  return '<button type="button" class="mode" data-action="practice" data-value="' + value + '"><span class="mode-text"><b>' + esc(title) +
    (fresh ? ' <span class="new-chip">Nouveau</span>' : '') + '</b><span>' + esc(text) + '</span></span>' + ICON.chevron + '</button>';
}
function renderPractice(){
  if (READERS[state.practice]) return renderReader();
  hideReader();
  if (state.practice === 'traduction') return renderTrSetup();
  if (state.practice === 'feuille') return renderBlankSetup();
  const fresh = practiceNew();
  setView('<section class="stack">' +
    '<h1 class="h1">Pratique</h1>' + notes() +
    '<div class="sheet paper-hero"><p class="sheet-meta"><span>Sur une feuille</span><span>' + ICON.pen + '</span></p>' +
      '<p class="ar paper-hero-ar" lang="ar" dir="rtl">' + esc('كَسَرَتِ البَابَ') + '</p></div>' +
    '<h2 class="h2">Avec une feuille et un stylo</h2>' +
    '<div class="modes">' +
      practiceMode('traduction', 'Traduire des phrases', 'Du français vers l’arabe : vocabulaire, passé, présent et phrase verbale.', fresh) +
      practiceMode('feuille', 'La feuille blanche', 'Écris de mémoire tout ce que tu as retenu du cours, puis compare.', fresh) +
    '</div>' +
    '<h2 class="h2">Lecture et dictée</h2>' +
    '<div class="modes">' +
      practiceMode('lettres', 'L’alphabet', 'Les lettres et leurs sons, sur le site Ataallam de l’école.') +
      practiceMode('dictee', 'La dictée', 'Écoute et écris des mots en arabe.') +
    '</div>' +
    '</section>');
}
function openPractice(which){
  state.practice = which || null;
  if (READERS[which]){ readerWhich = which; lsSet(K_READER, which); }
  render(); scrollTop();
}

/* -- Translation (French → Arabic, written on paper, then compared with the correction) -- */
function trData(){ return (state.grammar && state.grammar.traduction) || { phrases: [], objets: {}, sujets: [] }; }
function trCourse(){
  return (trData().phrases || []).map((p, i) => ({ key: 'tc' + (i + 1), src: 'cours', fr: p.fr, ar: p.ar, aide: p.aide || [], notes: p.notes || [], audio: p.audio || '' }));
}
/* « Vous (masculin) avez… », « Ils (deux) ont… », as in the teacher’s exercise. */
const TR_TAG = { '2m': 'masculin', '2f': 'féminin', '3md': 'deux', '3fd': 'deux', '2d': 'deux', '2mp': 'masculin', '2fp': 'féminin' };
function frSubjTag(text, pid){ const t = TR_TAG[pid]; return t ? String(text).replace(/^(\S+)/, '$1 (' + t + ')') : String(text); }
/* Two sukun cannot follow each other: كَسَرَتْ + البَابَ → كَسَرَتِ البَابَ ; أَكَلْتُمْ + ال → أَكَلْتُمُ. */
function joinSukun(word, next){
  if (!next || !next.startsWith('ال') || !word.endsWith('ْ')) return word;
  return word.slice(0, -1) + (word.endsWith('مْ') ? 'ُ' : 'ِ');
}
function objPhrase(w, def){ return def ? withAl(stripEnd(w.ar)) + 'َ' : tanwinAn(stripEnd(w.ar)); }
function objWhy(w, def){
  return def ? 'Le complément a ال : une seule fatha (ـَ).' : 'Le complément n’a pas ال : tanwîn ـً' + (stripEnd(w.ar).endsWith('ة') ? ', sans alif après ة.' : ', écrit avec un alif.');
}
function vocabLine(w){ return w.ar + ' = ' + (w.type === 'verbe' || /^g-/.test(w.id) && w.pc ? verbInf(w) : w.fr); }
function verbSubjParts(V, pid, endLen){
  /* Colour only the subject letters, as in the book: nothing for فَعَلَ and فَعَلَتْ, the ا of فَعَلَتَا, the و of فَعَلُوا. */
  if (pid === '3m' || pid === '3f' || !endLen) return [[V, '']];
  if (pid === '3fd') return [[V.slice(0, -1), ''], ['ا', 'end']];
  if (pid === '3mp') return [[V.slice(0, -2), ''], ['و', 'end'], ['ا', '']];
  return [[V.slice(0, V.length - endLen), ''], [V.slice(V.length - endLen), 'end']];
}
function trPast(){
  const T = trData();
  const v = pickOne(grammarVerbs().filter(x => x.pc && x.pc['3m']));
  if (!v) return null;
  const p = pickOne(PERS);
  const objs = (T.objets[v.id] || []).map(lookupItem).filter(Boolean);
  const ow = objs.length && Math.random() < 0.75 ? pickOne(objs) : null;
  const od = Math.random() < 0.5;
  const c = conjParts(v, p);
  const O = ow ? objPhrase(ow, od) : '';
  const V0 = c.base + c.end, V = joinSukun(V0, O);
  const on = ow ? frNoun(ow) : null;
  const fr = capFirst(frSubjTag(pcText(v, p.id), p.id)) + (on ? ' ' + frNounPhrase(on, od) : '') + '.';
  const notes = [p.id === '3m' ? '« Il » : la forme de base ' + V0 + ', sans terminaison.'
    : p.id === '3f' ? '« Elle » : ـَتْ. Le تْ indique seulement le féminin.'
    : 'Terminaison ' + p.tile + ' pour « ' + p.label + ' » (' + p.pron + ') : c’est le sujet, collé au verbe.'];
  if (p.n === 'd') notes.push('Deux personnes : c’est le duel.');
  if (c.merged) notes.push('Le ت de la racine et celui de la terminaison se fondent avec une chadda : ' + V0 + '.');
  if (V !== V0) notes.push('Pas deux soukoun de suite : ' + V0 + ' devient ' + V + ' devant ال.');
  if (ow) notes.push(objWhy(ow, od));
  const words = [{ ar: V, role: 'v', parts: verbSubjParts(V, p.id, c.end.length), l: p.id === '3m' || p.id === '3f' ? 'verbe' : 'verbe + sujet' }].concat(ow ? [{ ar: O, role: 'o' }] : []);
  return { key: 'tp:' + v.id + p.id + (ow ? ow.id + (od ? 'D' : 'I') : ''), src: 'melange', fr, ar: words.map(w => w.ar).join(' '), words, notes, aide: [], vocab: [v].concat(ow ? [ow] : []).map(vocabLine) };
}
function trNounSubject(){
  const T = trData();
  const frames = ((state.grammar && state.grammar.sentences) || []).slice();
  for (const vid of Object.keys(T.objets || {})) for (const oid of T.objets[vid]) for (const sid of T.sujets || []) frames.push({ verb: vid, subj: sid, obj: oid });
  for (let tries = 0; tries < 20; tries++){
    const f = pickOne(frames); if (!f) return null;
    const v = lookupItem(f.verb), sw = lookupItem(f.subj), ow = f.obj ? lookupItem(f.obj) : null;
    if (!v || !sw || (f.obj && !ow)) continue;
    const sn = frNoun(sw), on = ow ? frNoun(ow) : null;
    if (!sn || (ow && !on) || !pcText(v, sn.fem ? '3f' : '3m')) continue;
    const sd = Math.random() < 0.5, od = Math.random() < 0.5;
    const S = nounCase(sw, sd, 'u'), O = ow ? nounCase(ow, od, 'a') : '';
    const V = verbFor(v, sn.fem, S);
    const words = [{ ar: V, role: 'v' }, { ar: S, role: 's' }].concat(ow ? [{ ar: O, role: 'o' }] : []);
    const notes = ['Verbe, puis sujet' + (ow ? ', puis complément.' : '.'),
      sd ? 'Le sujet a ال : une seule damma (ـُ).' : 'Le sujet n’a pas ال : tanwîn ـٌ (« -un »).'];
    if (sn.fem) notes.push('Le sujet est féminin : le verbe prend ـَتْ' + (V.endsWith('ِ') ? ', qui devient ـَتِ devant ال (pas deux soukoun de suite).' : '.'));
    if (ow) notes.push(objWhy(ow, od));
    return { key: 'tn:' + f.verb + f.subj + (sd ? 'D' : 'I') + (ow ? ow.id + (od ? 'D' : 'I') : ''), src: 'melange', fr: frSentence(sn, sd, v, on, od), ar: words.map(w => w.ar).join(' '), words, notes, aide: [],
      vocab: [v, sw].concat(ow ? [ow] : []).map(vocabLine) };
  }
  return null;
}
function trPresent(){
  const T = trData();
  const v = pickOne(grammarVerbs().filter(presOk)); if (!v) return null;
  const P = pickOne(PRES_P); const c = presParts(v, P.id);
  if (!presFr(v, P.id)) return null;
  const objs = (T.objets[v.id] || []).map(lookupItem).filter(Boolean);
  const ow = objs.length && Math.random() < 0.7 ? pickOne(objs) : null;
  const od = Math.random() < 0.5;
  const O = ow ? objPhrase(ow, od) : '';
  const on = ow ? frNoun(ow) : null;
  const fr = capFirst(frSubjTag(presFr(v, P.id), P.id)) + (on ? ' ' + frNounPhrase(on, od) : '') + '.';
  const m = /^.ْ.([َُِ])/.exec(v.pres.slice(2));
  const notes = [presWhy(v, P, c)];
  if (m && !c.merged) notes.push('Au présent, ' + v.ar + ' devient ' + v.pres + ' : ' + VOWEL_NAME[m[1]] + ' sur la 3e lettre.');
  if (ow) notes.push(objWhy(ow, od));
  const words = [{ ar: c.pre + c.base + (c.end || ''), role: 'v', parts: [[c.pre, 'end'], [c.base, ''], [c.end || '', 'end']], l: 'verbe (présent)' }].concat(ow ? [{ ar: O, role: 'o' }] : []);
  return { key: 'tr:' + v.id + P.id + (ow ? ow.id + (od ? 'D' : 'I') : ''), src: 'melange', fr, ar: words.map(w => w.ar).join(' '), words, notes, aide: [], vocab: [v].concat(ow ? [ow] : []).map(vocabLine) };
}
function pickOne(a){ return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }
function trMixed(n){
  const out = [], seen = new Set(), seenFr = new Set();
  const makers = [trPast, trPast, trPast, trNounSubject, trNounSubject, trPresent, trPresent];
  for (let tries = 0; out.length < n && tries < n * 30; tries++){
    const it = pickOne(makers)();
    if (!it || seen.has(it.key) || seenFr.has(it.fr)) continue;
    seen.add(it.key); seenFr.add(it.fr); out.push(it);
  }
  return out;
}
function renderTrSetup(){
  const o = state.trOpts; const nCourse = trCourse().length;
  if (!nCourse && o.src === 'cours') o.src = 'melange';
  const counts = [['5', '5'], ['10', '10']].concat(o.src === 'cours' && nCourse > 10 ? [['all', 'Toutes (' + nCourse + ')']] : []);
  const cur = o.src !== 'cours' && o.count === 'all' ? '10' : String(o.count);
  setView('<section class="stack">' +
    '<button type="button" class="btn text" data-action="practice-back">Retour</button>' +
    '<h1 class="h1">Traduire des phrases</h1>' +
    '<div class="paper-call">' + ICON.pen + '<p><b>Prends une feuille et un stylo.</b> Pour chaque phrase, écris la traduction en arabe avec toutes les voyelles. Ensuite seulement, regarde la correction et compare.</p></div>' +
    '<div class="field"><span class="label" id="trSrcL">Phrases</span>' + seg('trsrc', o.src, [['cours', 'Du cours'], ['melange', 'Nouvelles phrases']], 'trSrcL') + '</div>' +
    '<p class="hint">' + (o.src === 'cours'
      ? 'Les ' + nCourse + ' phrases de l’exercice fait en classe, avec la correction et l’audio.'
      : 'Des phrases différentes à chaque fois, avec tout ce qu’on a vu : le vocabulaire, le passé (singulier, duel, pluriel), le présent et la phrase verbale.') + '</p>' +
    '<div class="field"><span class="label" id="trCountL">Nombre de phrases</span>' + seg('trcount', cur, counts, 'trCountL') + '</div>' +
    '<button type="button" class="btn primary big" data-action="tr-start">Commencer</button>' +
    '<p class="hint">« Ils » ou « elles » sans autre précision : trois personnes ou plus. Pour deux personnes, la phrase l’indique : « Ils (deux) ».</p>' +
    '</section>');
}
function startTranslation(queue){
  const o = state.trOpts;
  let q = queue;
  if (!q){
    if (o.src === 'cours'){ q = trCourse(); if (o.count !== 'all') q = shuffle(q).slice(0, Number(o.count) || 5); }
    else q = trMixed(Number(o.count) || 5);
  }
  if (!q.length){ toast('Pas de phrase disponible pour le moment.'); return; }
  state.session = { kind: 'translation', src: o.src, queue: q, idx: 0, revealed: false, help: false, marks: [], finished: false, startedAt: Date.now(), histId: newId('h') };
  render(); scrollTop();
}
const TR_MARKS = [['ok', 'Juste', 'Tout est bon'], ['close', 'Petite erreur', 'Une voyelle, une lettre'], ['ko', 'À revoir', 'La structure était fausse']];
function renderTranslation(){
  const s = state.session;
  if (s.finished || s.idx >= s.queue.length){
    if (!s.finished){ s.finished = true; saveSessionRecord(s); }
    return renderTrEnd();
  }
  const it = s.queue[s.idx];
  const aide = it.aide && it.aide.length ? '<p class="tr-aide">' + arWrap('Aide : ' + it.aide.join(' ; ')) + '</p>' : '';
  let after;
  if (!s.revealed){
    after = (it.vocab && it.vocab.length ? (s.help
        ? '<div class="note tr-vocab">' + it.vocab.map(t => '<span>' + arWrap(t) + '</span>').join('') + '</div>'
        : '<button type="button" class="btn text tr-help" data-action="tr-help">Voir le vocabulaire</button>') : '') +
      '<div class="answer-bar"><button type="button" class="btn primary big" data-action="tr-reveal">Voir la correction</button></div>' +
      '<p class="hint tr-tip">Écris d’abord ta phrase sur ta feuille, avec les voyelles.</p>';
  } else {
    after = '<div class="reveal tr-reveal">' + (it.words ? '<div class="reveal-svo">' + svoWords(it.words) + '</div>' : '<p class="ar tr-ar" lang="ar" dir="rtl">' + esc(it.ar) + '</p>') +
        (it.audio ? '<button type="button" class="icon-btn tr-play" data-action="lplay" data-src="' + esc(it.audio) + '" aria-label="Écouter">' + ICON.speaker + '</button>' : '') + '</div>' +
      (it.notes && it.notes.length ? '<ul class="tr-notes">' + it.notes.map(n => '<li>' + arWrap(n) + '</li>').join('') + '</ul>' : '') +
      '<p class="label tr-cmp">Compare avec ta feuille</p>' +
      '<div class="rate rate-3">' + TR_MARKS.map(([r, l, h], i) =>
        '<button type="button" class="rate-btn tr-' + r + '" data-action="tr-mark" data-r="' + r + '" aria-keyshortcuts="' + (i + 1) + '"><b>' + l + '</b><small>' + h + '</small></button>').join('') + '</div>' +
      '<div class="after">' + askLink('ask-q') + reportLink('report-q') + '</div>';
  }
  setView('<section class="session">' +
    sessionTop('Phrase ' + (s.idx + 1) + ' sur ' + s.queue.length) +
    progressBar(s.idx / s.queue.length * 100) +
    '<div class="sheet card still compact tr-card">' +
      '<p class="sheet-meta"><span>Traduis en arabe</span><span>' + (it.src === 'cours' ? 'Exercice du cours' : '') + '</span></p>' +
      '<div class="face front"><p class="tr-fr">' + esc(it.fr) + '</p>' + aide + '</div>' +
    '</div>' + after +
    '</section>');
}
function trMark(r){
  const s = state.session; if (!s || s.kind !== 'translation' || !s.revealed) return;
  s.marks[s.idx] = r; s.idx++; s.revealed = false; s.help = false;
  if (s.idx >= s.queue.length){ s.finished = true; saveSessionRecord(s); }
  renderSession(); scrollTop();
}
function trCounts(s){
  const c = { ok: 0, close: 0, ko: 0 };
  s.marks.forEach(m => { if (c[m] != null) c[m]++; });
  return c;
}
function renderTrEnd(){
  const s = state.session; const c = trCounts(s); const total = s.queue.length;
  const pct = total ? Math.round((c.ok + c.close * 0.5) / total * 100) : 0;
  const praise = pct >= 90 ? ['مُمْتَازٌ', 'Excellent'] : pct >= 70 ? ['جَيِّدٌ جِدًّا', 'Très bien'] : pct >= 50 ? ['جَيِّدٌ', 'Bien'] : ['حَاوِلْ مَرَّةً أُخْرَى', 'Essaie encore'];
  const redo = s.queue.filter((it, i) => s.marks[i] && s.marks[i] !== 'ok');
  setView('<section class="session stack">' +
    '<div class="sheet card end">' +
      '<p class="end-ar praise" lang="ar" dir="rtl">' + praise[0] + '</p>' +
      '<p class="score">' + c.ok + ' / ' + total + '</p>' +
      '<p>' + praise[1] + ' : ' + plural(c.ok, 'phrase juste', 'phrases justes') + (c.close ? ', ' + plural(c.close, 'petite erreur', 'petites erreurs') : '') + (c.ko ? ', ' + c.ko + ' à revoir' : '') + '.</p>' +
    '</div>' +
    (redo.length ? '<h2 class="h2">À retravailler</h2><ul class="mistakes">' + redo.map(it =>
      '<li><span class="mq">' + esc(it.fr) + '</span><span class="ma"><bdi class="ari" lang="ar" dir="rtl">' + esc(it.ar) + '</bdi></span></li>').join('') + '</ul>' : '') +
    '<div class="actions">' +
      (redo.length ? '<button type="button" class="btn primary big" data-action="tr-retry">Refaire ces phrases</button>' : '') +
      (s.src === 'melange' ? '<button type="button" class="btn ' + (redo.length ? 'ghost' : 'primary') + ' big" data-action="tr-again">Nouvelles phrases</button>' : '') +
      '<button type="button" class="btn ghost big" data-action="quit">Retour</button>' +
    '</div>' +
    '</section>');
}

/* -- The blank sheet: write everything you remember, then tick what you had -- */
let blankTimer = null;
function blankWeeks(){ return weeks(); }
function blankWeek(){ const o = state.blankOpts; return o.week === 'all' ? 'all' : o.week === 'last' || !blankWeeks().includes(Number(o.week)) ? latestWeek() : Number(o.week); }
function blankItems(week){
  const words = sortWords(state.words.filter(w => week === 'all' || weekOf(w) === week)).map(w => ({ k: 'w:' + w.id, id: w.id, ar: w.ar, fr: w.fr, kind: 'word' }));
  const rules = [];
  for (const l of grammarLessons()) (l.retenir || []).forEach((r, i) => { if (week === 'all' || r.week === week) rules.push({ k: 'r:' + l.id + ':' + i, text: r.text, lesson: l.title, kind: 'rule' }); });
  return words.concat(rules);
}
function renderBlankSetup(){
  const o = state.blankOpts; const ws = blankWeeks(); const last = latestWeek();
  const sel = o.week === 'all' ? 'all' : o.week === 'last' ? 'last' : String(o.week);
  const items = blankItems(blankWeek());
  setView('<section class="stack">' +
    '<button type="button" class="btn text" data-action="practice-back">Retour</button>' +
    '<h1 class="h1">La feuille blanche</h1>' +
    '<p class="lead">La méthode du professeur : sans rien regarder, écris sur une feuille blanche tout ce que tu as retenu du cours. Ensuite, compare avec la liste de l’app.</p>' +
    '<div class="paper-call">' + ICON.pen + '<p><b>Le bon moment : le lendemain du cours.</b> Ce que tu retrouves seul se grave ; ce que tu as oublié, c’est exactement ce qu’il faut revoir.</p></div>' +
    '<label class="field"><span class="label">Quel cours ?</span><select id="blankSel">' +
      '<option value="last"' + (sel === 'last' ? ' selected' : '') + '>Le dernier cours (semaine ' + last + ')</option>' +
      ws.slice().reverse().filter(n => n !== last).map(n => '<option value="' + n + '"' + (sel === String(n) ? ' selected' : '') + '>Semaine ' + n + '</option>').join('') +
      '<option value="all"' + (sel === 'all' ? ' selected' : '') + '>Tout le programme</option>' +
    '</select></label>' +
    '<div class="field"><span class="label" id="blankTimerL">Minuteur</span>' + seg('blanktimer', o.timer, [['0', 'Sans'], ['5', '5 min'], ['10', '10 min']], 'blankTimerL') + '</div>' +
    '<button type="button" class="btn primary big" data-action="blank-start">Commencer</button>' +
    '<p class="hint">À comparer ensuite : ' + plural(items.filter(i => i.kind === 'word').length, 'mot', 'mots') + ' et ' + plural(items.filter(i => i.kind === 'rule').length, 'point de grammaire', 'points de grammaire') + '.</p>' +
    '</section>');
}
function startBlank(){
  const week = blankWeek(); const items = blankItems(week);
  if (!items.length){ toast('Rien à comparer pour ce cours.'); return; }
  const mins = Number(state.blankOpts.timer) || 0;
  state.session = { kind: 'blank', week, items, checked: {}, phase: 'write', mins, endsAt: mins ? Date.now() + mins * 60000 : 0, finished: false, startedAt: Date.now(), histId: newId('h') };
  render(); scrollTop();
}
function blankLeft(s){ return Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000)); }
function fmtClock(sec){ return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function tickBlank(){
  const s = state.session;
  if (!s || s.kind !== 'blank' || s.phase !== 'write' || !s.endsAt){ clearInterval(blankTimer); blankTimer = null; return; }
  if (s.tick) trackTime(s);
  const el = $('#blankClock'); const left = blankLeft(s);
  if (el){ el.textContent = left ? fmtClock(left) : 'Temps écoulé'; el.classList.toggle('over', !left); }
  if (!left){ clearInterval(blankTimer); blankTimer = null; try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e){} }
}
function renderBlank(){
  const s = state.session;
  const title = s.week === 'all' ? 'Tout le programme' : 'Semaine ' + s.week;
  if (s.phase === 'write'){
    setView('<section class="session stack">' +
      sessionTop(esc(title)) +
      '<div class="sheet blank-sheet">' +
        '<p class="sheet-meta"><span>La feuille blanche</span><span>' + ICON.pen + '</span></p>' +
        (s.endsAt ? '<p class="blank-clock" id="blankClock" aria-live="off">' + fmtClock(blankLeft(s)) + '</p>' : '') +
        '<ol class="blank-steps">' +
          '<li>Ferme ton cahier et ton livre.</li>' +
          '<li>Sur une feuille blanche, écris tout ce dont tu te souviens : les mots en arabe avec leur sens, les règles, les tableaux, des exemples.</li>' +
          '<li>Quand tu as fini, compare avec la liste.</li>' +
        '</ol>' +
      '</div>' +
      '<button type="button" class="btn primary big" data-action="blank-check">J’ai fini, je compare</button>' +
      '</section>');
    if (s.endsAt && !blankTimer){ blankTimer = setInterval(tickBlank, 1000); }
    tickBlank();
    return;
  }
  const words = s.items.filter(i => i.kind === 'word'), rules = s.items.filter(i => i.kind === 'rule');
  if (s.phase === 'check'){
    const box = it => '<li><button type="button" class="blank-item" role="checkbox" aria-checked="' + !!s.checked[it.k] + '" data-action="blank-toggle" data-k="' + esc(it.k) + '"><span class="bx" aria-hidden="true"></span>' +
      (it.kind === 'word' ? '<span class="ar bi-ar" lang="ar" dir="rtl">' + esc(it.ar) + '</span><span class="bi-fr">' + esc(it.fr) + '</span>'
        : '<span class="bi-rule">' + arWrap(it.text) + '<small>' + esc(it.lesson) + '</small></span>') + '</button></li>';
    setView('<section class="session stack">' +
      sessionTop('<span id="blankCount">' + Object.keys(s.checked).length + '</span> / ' + s.items.length) +
      '<p class="lead">Coche tout ce qui était sur ta feuille, même si c’était à peu près juste.</p>' +
      (words.length ? '<h2 class="h2">Les mots</h2><ul class="blank-list">' + words.map(box).join('') + '</ul>' : '') +
      (rules.length ? '<h2 class="h2">La grammaire</h2><ul class="blank-list">' + rules.map(box).join('') + '</ul>' : '') +
      '<button type="button" class="btn primary big" data-action="blank-done">Voir mon résultat</button>' +
      '</section>');
    return;
  }
  const n = Object.keys(s.checked).length, total = s.items.length;
  const pct = total ? Math.round(n / total * 100) : 0;
  const missedW = words.filter(i => !s.checked[i.k]), missedR = rules.filter(i => !s.checked[i.k]);
  setView('<section class="session stack">' +
    '<div class="sheet card end">' +
      '<p class="end-ar praise" lang="ar" dir="rtl">' + (pct >= 80 ? 'مُمْتَازٌ' : pct >= 50 ? 'جَيِّدٌ' : 'بَارَكَ اللهُ فِيكَ') + '</p>' +
      '<p class="score">' + n + ' / ' + total + '</p>' +
      '<p>' + (pct >= 80 ? 'Tu avais presque tout en tête.' : pct >= 50 ? 'Une bonne partie est déjà là.' : 'C’est normal au début : maintenant tu sais quoi revoir.') + '</p>' +
    '</div>' +
    (missedW.length || missedR.length ? '<h2 class="h2">À revoir</h2><ul class="mistakes">' +
      missedW.map(i => '<li><span class="ma"><bdi class="ari" lang="ar" dir="rtl">' + esc(i.ar) + '</bdi></span><span class="mq">' + esc(i.fr) + '</span></li>').join('') +
      missedR.map(i => '<li><span class="mq">' + arWrap(i.text) + '</span><span class="hint">' + esc(i.lesson) + '</span></li>').join('') + '</ul>' : '') +
    '<div class="actions">' +
      (missedW.length ? '<button type="button" class="btn primary big" data-action="blank-exam">Réviser les mots oubliés</button>' : '') +
      (missedR.length ? '<button type="button" class="btn ' + (missedW.length ? 'ghost' : 'primary') + ' big" data-action="blank-lessons">Relire les leçons</button>' : '') +
      '<button type="button" class="btn ghost big" data-action="quit">Retour</button>' +
    '</div>' +
    '</section>');
}
function blankToggle(btn){
  const s = state.session; if (!s || s.kind !== 'blank' || s.phase !== 'check') return;
  const k = btn.dataset.k; if (s.checked[k]) delete s.checked[k]; else s.checked[k] = true;
  btn.setAttribute('aria-checked', String(!!s.checked[k]));
  const c = $('#blankCount'); if (c) c.textContent = Object.keys(s.checked).length;
}
function blankPhase(phase){
  const s = state.session; if (!s || s.kind !== 'blank') return;
  s.phase = phase;
  if (phase === 'done' && !s.finished){ s.finished = true; saveSessionRecord(s); }
  render(); scrollTop();
}
/* Reminder on the review page, the two days after class, until the blank sheet is done for this class week. */
const K_BLANKLATER = LS + 'blank-later';
function blankNudge(){
  const p = parisParts(Date.now());
  if (p.dow !== 1 && p.dow !== 2) return '';
  if (lsGet(K_BLANKLATER) === dayKey(Date.now())) return '';
  const wk = weekKey(Date.now());
  if (state.history.some(h => h.type === 'blank' && h.at && weekKey(h.at) === wk)) return '';
  return '<div class="nudge">' + ICON.pen + '<div><p><b>La feuille blanche</b> Écris de mémoire ce que tu as retenu du dernier cours, puis compare avec l’app.</p>' +
    '<div class="nudge-actions"><button type="button" class="btn primary" data-action="blank-go">Commencer</button><button type="button" class="btn text" data-action="blank-later">Plus tard</button></div></div></div>';
}

/* -- Homework checklist (devoirs.json), ticked on this device -- */
function devoirsKey(d){ return LS + 'devoirs-' + (d.id || d.pour || 'x'); }
function devoirsDone(d){ try { const v = JSON.parse(lsGet(devoirsKey(d)) || '{}'); return v && typeof v === 'object' ? v : {}; } catch(e){ return {}; } }
function devoirsActive(){
  const d = state.devoirs;
  if (!d || !Array.isArray(d.items) || !d.items.length) return null;
  const until = Date.parse(d.pour || '');
  return !isNaN(until) && Date.now() > until ? null : d;
}
function devoirsHtml(){
  const d = devoirsActive(); if (!d) return '';
  const done = devoirsDone(d);
  const n = d.items.filter(i => done[i.id]).length, total = d.items.length;
  const open = state.devoirsOpen == null ? n < total : state.devoirsOpen;
  const due = Date.parse(d.pour || '');
  const when = isNaN(due) ? '' : ' pour ' + new Date(due).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return '<section class="devoirs' + (n === total ? ' all-done' : '') + '">' +
    '<button type="button" class="devoirs-head" data-action="devoirs-toggle" aria-expanded="' + open + '">' +
      '<span class="dv-title"><b>Devoirs' + esc(when) + '</b><small>' + (n === total ? 'Tout est fait, bravo !' : n + ' sur ' + total + ' faits') + '</small></span>' +
      '<span class="dv-bar" aria-hidden="true"><span data-w="' + Math.round(n / total * 100) + '"></span></span>' + ICON.chevron +
    '</button>' +
    (open ? '<ul class="devoirs-list">' + d.items.map(i =>
      '<li><button type="button" class="dv-check" role="checkbox" aria-checked="' + !!done[i.id] + '" data-action="devoir" data-id="' + esc(i.id) + '"><span class="bx" aria-hidden="true"></span>' +
        '<span class="dv-text"><b>' + arWrap(i.titre || '') + (i.facultatif ? ' <em>facultatif</em>' : '') + '</b>' + (i.detail ? '<small>' + arWrap(i.detail) + '</small>' : '') + '</span></button>' +
        (i.lien ? '<a class="dv-link" href="' + esc(i.lien) + '">' + esc(i.lienTexte || 'Ouvrir') + '</a>' : '') + '</li>').join('') + '</ul>' +
      (d.note ? '<p class="hint dv-note">' + arWrap(d.note) + '</p>' : '') : '') +
    '</section>';
}
function toggleDevoir(id){
  const d = devoirsActive(); if (!d) return;
  const done = devoirsDone(d);
  if (done[id]) delete done[id]; else done[id] = true;
  lsSet(devoirsKey(d), JSON.stringify(done));
  if (d.items.every(i => done[i.id])){ state.devoirsOpen = false; toast('Tous les devoirs sont faits, bravo !'); }
  renderReview();
}
async function loadDevoirs(){
  try {
    const r = await fetch('devoirs.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    state.devoirs = await r.json();
    lsSet(LS + 'devoirs-cache', JSON.stringify(state.devoirs));
  } catch(e){
    try { state.devoirs = JSON.parse(lsGet(LS + 'devoirs-cache') || 'null'); } catch(e2){ state.devoirs = null; }
  }
}

/* ---------- events ---------- */
function switchTab(t){
  if (state.session) return;
  if (t === 'reader' && state.tab === 'reader' && !state.settings) state.practice = null;
  if (t === 'reader'){ lsSet(K_PRACVISIT, '1'); }
  state.tab = t; state.setup = null; state.settings = false; state.detailId = null; state.lessonId = null; state.conjVerb = null;
  if (t === 'reader') refreshGrammarBadge();
  if (t === 'grammar'){ lsSet(K_GRAMVISIT, '1'); refreshGrammarBadge(); if (!state.grammar) state.grammarError = ''; }
  render(); scrollTop();
}
function setOpt(name, value){
  if (name === 'dir'){ state.dir = value; lsSet(LS + 'dir', value); if (pushOn()){ const api = Cloud.api(); if (api) api.updateNotifSettings({ dirs: value }).catch(() => {}); } }
  else if (name === 'order' || name === 'faces'){ state.browseOpts[name] = value; lsSet(LS + 'browse', JSON.stringify(state.browseOpts)); }
  else if (name === 'format'){ state.examOpts.format = value; lsSet(LS + 'exam', JSON.stringify(state.examOpts)); }
  else if (name === 'count'){ state.examOpts.count = value === 'all' ? 'all' : Number(value); lsSet(LS + 'exam', JSON.stringify(state.examOpts)); }
  else if (name === 'size'){ state.arSize = value; lsSet(LS + 'size', value); applyLook(); }
  else if (name === 'revmode'){ state.reviseMode = value; lsSet(LS + 'revise-mode', value); }
  else if (name === 'lbperiod' || name === 'lbmetric'){ LB[name === 'lbperiod' ? 'period' : 'metric'] = value; lsSet(LS + name.replace('lb', 'lb-'), value); }
  else if (name === 'trsrc' || name === 'trcount'){ state.trOpts[name === 'trsrc' ? 'src' : 'count'] = value; lsSet(LS + 'tr', JSON.stringify(state.trOpts)); }
  else if (name === 'blanktimer'){ state.blankOpts.timer = value; lsSet(LS + 'blank', JSON.stringify(state.blankOpts)); }
  else if (name === 'gsection'){ state.gramSection = value; lsSet(LS + 'gsection', value); }
  else if (name === 'glesson') setGLesson(value);
  else if (name === 'gcount' || name === 'gnum'){ state.grammarOpts[{ glesson: 'lesson', gcount: 'count', gnum: 'num' }[name]] = name === 'gcount' ? Number(value) : value; lsSet(LS + 'gopts', JSON.stringify(state.grammarOpts)); }
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
  if (link){
    if (link.id === 'audioLink') $('#audioHelp').hidden = true;
    if (link.dataset.ask === 'go'){ copyAsk(true); setTimeout(closeAsk, 300); }
    return;
  }
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
    case 'settings': if (!state.session){ state.settings = true; state.confirmReset = false; if (Reports.admin) loadReports(); render(); scrollTop(); offlineCheck(); } break;
    case 'offline-dl': offlineDownload(true); break;
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
    case 'report-q': reportFromSession(); break;
    case 'report-word': { const w = wordById(t.dataset.id); if (w) reportWord(w); break; }
    case 'report-lesson': { const l = grammarLessons().find(x => x.id === t.dataset.id); if (l) reportLesson(l); break; }
    case 'rp-send': sendReport(); break;
    case 'ask-q': askFromSession(); break;
    case 'ask-word': { const w = wordById(t.dataset.id); if (w) askWord(w); break; }
    case 'ask-lesson': { const l = grammarLessons().find(x => x.id === t.dataset.id); if (l) askLesson(l); break; }
    case 'ask-copy': copyAsk(); break;
    case 'ask-close': closeAsk(); break;
    case 'rp-close': closeReport(); break;
    case 'rp-login': closeReport(); if (state.session) quitSession(); state.settings = true; render(); { const el = $('#accountBox'); if (el) el.scrollIntoView({ block: 'start' }); } break;
    case 'rp-done': { const api = Cloud.api(); if (api) api.setReportStatus(t.dataset.id, 'done').then(loadReports).catch(() => toast('Action impossible.')); break; }
    case 'rp-del': { const api = Cloud.api(); if (api) api.deleteReport(t.dataset.id).then(loadReports).catch(() => toast('Action impossible.')); break; }
    case 'rp-toggle': Reports.showDone = !Reports.showDone; { const b = $('#reportsBox'); if (b) b.innerHTML = reportsHtml(); } break;
    case 'go-grammar': if (t.dataset.sec){ state.gramSection = t.dataset.sec; lsSet(LS + 'gsection', t.dataset.sec); } switchTab('grammar'); break;
    case 'conj-verb': state.conjVerb = t.dataset.id; render(); scrollTop(); break;
    case 'conj-back': state.conjVerb = null; render(); scrollTop(); break;
    case 'conj-train': startVerbTraining(t.dataset.id); break;
    case 'lb-refresh': LB.error = ''; LB.list = null; loadLeaderboard(); renderStats(); break;
    case 'lb-leave': leaveLeaderboard(); break;
    case 'lb-rejoin': rejoinLeaderboard(); break;
    case 'go-lb-settings': { state.settings = true; state.confirmReset = false; render(); const el = $('#lbSettings'); if (el){ el.scrollIntoView({ block: 'center' }); const i = $('#lbName'); if (i) i.focus({ preventScroll: true }); } break; }
    case 'greload': state.grammarError = ''; renderGrammar(); break;
    case 'gpick': gpick(Number(t.dataset.i)); break;
    case 'gnext': gnext(); break;
    case 'gretry': { const s = state.session; if (s && s.mistakes.length){ const q = s.mistakes.map(m => Object.assign({}, m, { choices: shuffle(m.choices.slice()) })); startGrammar(s.lesson, q); } break; }
    case 'lesson': state.lessonId = t.dataset.id; state.gramSection = lessonSection(t.dataset.id); render(); scrollTop(); break;
    case 'lesson-back': state.lessonId = null; render(); scrollTop(); break;
    case 'lesson-train': startGrammar(t.dataset.id); break;
    case 'lplay': playSrc(t.dataset.src, t); break;
    case 'reader': setReader(t.dataset.value); break;
    case 'practice': openPractice(t.dataset.value); break;
    case 'practice-back': openPractice(null); break;
    case 'tr-start': startTranslation(); break;
    case 'tr-help': { const s = state.session; if (s && s.kind === 'translation'){ s.help = true; renderSession(); } break; }
    case 'tr-reveal': { const s = state.session; if (s && s.kind === 'translation'){ s.revealed = true; renderSession(); } break; }
    case 'tr-mark': trMark(t.dataset.r); break;
    case 'tr-retry': { const s = state.session; if (s){ const q = s.queue.filter((it, i) => s.marks[i] && s.marks[i] !== 'ok'); if (q.length) startTranslation(q); } break; }
    case 'tr-again': state.trOpts.src = 'melange'; startTranslation(); break;
    case 'blank-start': startBlank(); break;
    case 'blank-check': blankPhase('check'); break;
    case 'blank-toggle': blankToggle(t); break;
    case 'blank-done': blankPhase('done'); break;
    case 'blank-exam': { const s = state.session; if (s && s.kind === 'blank'){ const q = s.items.filter(i => i.kind === 'word' && !s.checked[i.k]).map(i => ({ id: i.id, dir: 'frar' })); if (q.length) startExam(q); } break; }
    case 'blank-lessons': state.session = null; switchTab('grammar'); break;
    case 'blank-go': state.tab = 'reader'; lsSet(K_PRACVISIT, '1'); openPractice('feuille'); refreshGrammarBadge(); break;
    case 'blank-later': lsSet(K_BLANKLATER, dayKey(Date.now())); renderReview(); break;
    case 'devoir': toggleDevoir(t.dataset.id); break;
    case 'devoirs-toggle': { const d = devoirsActive(); if (d){ const done = devoirsDone(d); const open = state.devoirsOpen == null ? d.items.some(i => !done[i.id]) : state.devoirsOpen; state.devoirsOpen = !open; renderReview(); } break; }
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
  else if (e.target.id === 'gLessonSel'){ setGLesson(e.target.value); render(); const sel = $('#gLessonSel'); if (sel) sel.focus({ preventScroll: true }); }
  else if (e.target.id === 'blankSel'){ state.blankOpts.week = e.target.value; lsSet(LS + 'blank', JSON.stringify(state.blankOpts)); render(); const sel = $('#blankSel'); if (sel) sel.focus({ preventScroll: true }); }
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
  if (e.key === 'Escape' && $('#reportSheet')){ closeReport(); return; }
  if ($('#reportSheet')) return;
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
  } else if (s.kind === 'translation'){
    if (s.finished || s.idx >= s.queue.length) return;
    if (!s.revealed && (e.key === ' ' || e.key === 'Enter') && !onButton){ e.preventDefault(); s.revealed = true; renderSession(); }
    else if (s.revealed && /^[1-3]$/.test(e.key)){ e.preventDefault(); trMark(TR_MARKS[Number(e.key) - 1][0]); }
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

/* ---------- links from notifications: #reviser, #semaine-N, #examen, #grammaire, #grammaire-<leçon>,
   #conjugaison, #conjugaison-<verbe>, #pratique, #traduction, #feuille-blanche, #alphabet, #dictee ---------- */
function openLink(hash){
  const h = decodeURIComponent(String(hash || '').replace(/^#/, ''));
  if (!h || h === 'reports' || state.session) return false;
  let m, done = true;
  const base = () => { state.settings = false; state.detailId = null; state.lessonId = null; state.setup = null; state.conjVerb = null; };
  if (h === 'reviser'){ base(); state.tab = 'review'; state.reviseMode = 'vocab'; state.scope = 'all'; }
  else if ((m = /^semaine-(\d+)$/.exec(h))){ base(); state.tab = 'review'; state.reviseMode = 'vocab'; state.scope = weeks().includes(Number(m[1])) ? Number(m[1]) : 'all'; }
  else if (h === 'examen'){ base(); state.tab = 'review'; state.reviseMode = 'vocab'; state.scope = 'all'; state.setup = 'exam'; }
  else if (h === 'grammaire' || h === 'conjugaison'){ base(); state.tab = 'grammar'; state.gramSection = h; }
  else if ((m = /^conjugaison-([\w-]+)$/.exec(h))){ base(); state.tab = 'grammar'; state.gramSection = 'conjugaison'; if (lookupItem(m[1])) state.conjVerb = m[1]; }
  else if (h === 'dictee' || h === 'alphabet'){ base(); state.tab = 'reader'; state.practice = readerWhich = h === 'dictee' ? 'dictee' : 'lettres'; lsSet(K_READER, readerWhich); }
  else if (h === 'pratique' || h === 'traduction' || h === 'feuille-blanche'){ base(); state.tab = 'reader'; lsSet(K_PRACVISIT, '1'); state.practice = h === 'traduction' ? 'traduction' : h === 'feuille-blanche' ? 'feuille' : null; }
  else if ((m = /^grammaire-([\w-]+)$/.exec(h))){ base(); state.tab = 'grammar'; if (grammarLessons().some(l => l.id === m[1])){ state.lessonId = m[1]; state.gramSection = lessonSection(m[1]); } }
  else done = false;
  if (done){
    try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
    render(); scrollTop();
  }
  return done;
}
window.addEventListener('hashchange', () => { if (state.loaded) openLink(location.hash); });
if ('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type !== 'open-link' || !d.hash) return;
    if (state.loaded) openLink(d.hash); else { try { history.replaceState(null, '', d.hash); } catch(err){} }
  });
}

/* ---------- start ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist){ navigator.storage.persist().catch(() => {}); }

setTimeout(() => { if (Cloud.status === 'loading'){ Cloud.status = 'unavailable'; refreshCloudUi(); } }, 15000);

Store.loadLocal();
render();
setInterval(() => { refreshGrammarBadge(); if (state.loaded && !state.session && !state.settings && !state.setup && ['review', 'grammar', 'list'].includes(state.tab)) softRefresh(); }, 5 * 60000);
Store.loadWords().then(() => {
  state.loaded = true;
  if (!openLink(location.hash)) render();
  refreshGrammarBadge();
  setTimeout(maybeAnnounceGrammar, 600);
  warmAudioCache(); refreshOnlineUi();
});
})();
