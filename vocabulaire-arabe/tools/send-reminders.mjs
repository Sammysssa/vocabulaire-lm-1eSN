/* Envoie les rappels de révision (notifications) aux élèves qui les ont activés.
   Lancé toutes les heures par .github/workflows/rappels.yml.
   Un élève reçoit au plus un rappel par jour, à partir de l'heure qu'il a choisie,
   et seulement s'il a des cartes à réviser.

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

  let body;
  if (TEST){
    body = 'Test des rappels : les notifications fonctionnent.';
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
    data: { title: 'Vocabulaire arabe', body, url: APP_URL },
    webpush: { headers: { TTL: '43200', Urgency: 'normal' }, fcmOptions: { link: APP_URL } }
  });

  const updates = [];
  result.responses.forEach((r, i) => {
    if (!r.success && r.error && DEAD_TOKEN.has(r.error.code)){
      updates.push(new FieldPath('notif', 'tokens', tokens[i]), FieldValue.delete());
      removed++;
    }
  });
  if (!TEST) updates.push('notif.lastSent', day);
  if (updates.length) await doc.ref.update(...updates);
  sent += result.successCount;
}

console.log('Élèves inscrits : ' + snap.size + ', notifications envoyées : ' + sent + ', ignorés : ' + skipped + ', appareils retirés : ' + removed + (TEST ? ' (mode test)' : ''));
