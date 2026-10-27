/* Envoie les rappels de révision (notifications) aux élèves qui les ont activés.
   Lancé toutes les heures par .github/workflows/rappels.yml.
   Un élève reçoit au plus un rappel par jour, à partir de l'heure qu'il a choisie,
   et seulement s'il a des cartes à réviser.
   Les jours prévus dans tools/campagnes.json (par exemple une semaine de consolidation),
   le rappel est remplacé par le message du jour, envoyé même sans carte à réviser.

   Variables d'environnement :
     FIREBASE_SERVICE_ACCOUNT  contenu JSON de la clé du compte de service (secret GitHub)
     TEST_MODE                 "true" pour envoyer tout de suite un rappel de test à tous les appareils inscrits */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const APP_URL = 'https://sammysssa.github.io/vocabulaire-lm-1eSN/';
const TEST = process.env.TEST_MODE === 'true';
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

if (!process.env.FIREBASE_SERVICE_ACCOUNT){
  console.log('Secret FIREBASE_SERVICE_ACCOUNT absent : aucun rappel envoyé.');
  process.exit(0);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const messaging = getMessaging();
const words = JSON.parse(readFileSync(new URL('../words.json', import.meta.url), 'utf8')).words || [];
let campaigns = [];
try { campaigns = JSON.parse(readFileSync(new URL('./campagnes.json', import.meta.url), 'utf8')).campagnes || []; }
catch (e) { console.log('Campagnes : fichier absent ou illisible (' + e.message + ').'); }
/* Special message planned for this (local) day, if any. */
function campaignFor(day){
  for (const c of campaigns){
    const m = c && c.jours && c.jours[day];
    if (m && m.texte) return { id: c.id || 'campagne', title: c.titre || 'Vocabulaire arabe', body: m.texte, url: APP_URL + (m.lien || '') };
  }
  return null;
}
const now = new Date();

function localTime(timeZone){
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch (e) {
    return localTime('Europe/Paris');
  }
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: p.year + '-' + p.month + '-' + p.day, hour: Number(p.hour) };
}

function dueCount(progress, dirs){
  let due = 0;
  for (const w of words){
    for (const d of dirs){
      const s = progress && progress[w.id] && progress[w.id][d];
      if (!s || typeof s.due !== 'number' || s.due <= now.getTime()) due++;
    }
  }
  return due;
}

/* Error reports: tell the administrators (collection "admins") about new reports. */
async function notifyReports(){
  const pending = await db.collection('reports').where('notified', '==', false).get();
  if (pending.empty) return 0;
  const admins = await db.collection('admins').get();
  const first = pending.docs[0].data();
  const body = pending.size === 1
    ? 'Nouveau signalement (' + (first.kind || 'erreur') + ') : « ' + String(first.comment || '').slice(0, 80) + ' »'
    : pending.size + ' nouveaux signalements d’erreur à consulter.';
  let sentTo = 0;
  for (const a of admins.docs){
    const u = await db.collection('users').doc(a.id).get();
    const tokens = Object.keys(((u.data() || {}).notif || {}).tokens || {});
    if (!tokens.length) continue;
    const res = await messaging.sendEachForMulticast({ tokens, data: { title: 'Signalement d’erreur', body, url: APP_URL + '#reports' }, webpush: { headers: { TTL: '86400', Urgency: 'normal' } } });
    sentTo += res.successCount;
  }
  const batch = db.batch();
  pending.docs.forEach(d => batch.update(d.ref, { notified: true }));
  await batch.commit();
  console.log('Signalements : ' + pending.size + ' nouveau(x), notification envoyée à ' + sentTo + ' appareil(s) administrateur.');
  return pending.size;
}
try { await notifyReports(); } catch (e) { console.log('Signalements : vérification impossible (' + (e.code || e.message) + ').'); }

const snap = await db.collection('users').where('notif.enabled', '==', true).get();
let sent = 0, skipped = 0, removed = 0;

for (const doc of snap.docs){
  const user = doc.data();
  const notif = user.notif || {};
  const tokens = Object.keys(notif.tokens || {});
  if (!tokens.length){ skipped++; continue; }

  const { day, hour } = localTime(notif.tz || 'Europe/Paris');
  const target = Number.isFinite(Number(notif.hour)) ? Number(notif.hour) : 19;
  const dirs = notif.dirs === 'arfr' ? ['arfr'] : notif.dirs === 'frar' ? ['frar'] : ['arfr', 'frar'];

  let body, title = 'Vocabulaire arabe', url = APP_URL;
  const campaign = TEST ? null : campaignFor(day);
  if (TEST){
    body = 'Test des rappels : les notifications fonctionnent.';
  } else if (campaign){
    /* One campaign message per day, even if the usual reminder already went out earlier today. */
    if (notif.lastCampaign === day || hour < target || hour >= 23){ skipped++; continue; }
    body = campaign.body; title = campaign.title; url = campaign.url;
  } else {
    if (notif.lastSent === day || hour < target || hour >= 23){ skipped++; continue; }
    const due = dueCount(user.progress, dirs);
    if (!due){
      await doc.ref.update({ 'notif.lastSent': day });
      skipped++;
      continue;
    }
    body = due === 1 ? '1 carte t’attend aujourd’hui.' : due + ' cartes t’attendent aujourd’hui.';
  }

  const result = await messaging.sendEachForMulticast({
    tokens,
    data: { title, body, url },
    webpush: { headers: { TTL: '43200', Urgency: 'normal' }, fcmOptions: { link: url } }
  });

  const updates = [];
  result.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD_TOKEN.has(r.error.code)){
      updates.push(new FieldPath('notif', 'tokens', tokens[i]), FieldValue.delete());
      removed++;
    }
  });
  if (!TEST) updates.push('notif.lastSent', day);
  if (campaign) updates.push('notif.lastCampaign', day);
  if (updates.length) await doc.ref.update(...updates);
  sent += result.successCount;
}

const today = campaignFor(localTime('Europe/Paris').day);
if (today) console.log('Campagne du jour (' + today.id + ') : ' + today.body);
console.log('Élèves inscrits : ' + snap.size + ', notifications envoyées : ' + sent + ', ignorés : ' + skipped + ', appareils retirés : ' + removed + (TEST ? ' (mode test)' : ''));
