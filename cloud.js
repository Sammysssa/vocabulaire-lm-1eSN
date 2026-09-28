/* Sauvegarde en ligne de la progression (Firebase Authentication + Firestore).
   Ce module est facultatif : si la configuration est vide ou si Firebase ne se charge
   pas (hors connexion), l'app continue de fonctionner avec la progression locale.
   Il communique avec app.js par des événements « vocab-cloud » et l'objet window.VocabCloud. */
import { firebaseConfig, vapidKey } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';

function emit(type, detail){
  window.dispatchEvent(new CustomEvent('vocab-cloud', { detail: Object.assign({ type }, detail || {}) }));
}

async function start(){
  if (!firebaseConfig || !firebaseConfig.apiKey){ emit('disabled'); return; }
  const [appMod, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  auth.languageCode = 'fr';
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.getFirestore(app);
  }

  let current = null;
  let stopUser = null;
  let stopSessions = null;

  A.onAuthStateChanged(auth, user => {
    if (stopUser){ stopUser(); stopUser = null; }
    if (stopSessions){ stopSessions(); stopSessions = null; }
    current = user;
    emit('user', { user: user ? { uid: user.uid, email: user.email || '', name: user.displayName || '' } : null });
    if (!user) return;
    stopUser = F.onSnapshot(F.doc(db, 'users', user.uid), snap => {
      const data = snap.exists() ? snap.data() : {};
      emit('progress', { progress: data.progress || {}, resetAt: data.resetAt || 0, notif: data.notif || null, fromCache: snap.metadata.fromCache });
    }, err => emit('error', { code: err.code }));
    stopSessions = F.onSnapshot(F.collection(db, 'users', user.uid, 'sessions'), snap => {
      emit('sessions', { sessions: snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })) });
    }, err => emit('error', { code: err.code }));
  });

  const userRef = () => F.doc(db, 'users', current.uid);
  let messagingModule = null;
  const loadMessaging = async () => {
    if (!messagingModule) messagingModule = await import(SDK + 'firebase-messaging.js');
    return messagingModule;
  };
  const pushToken = async M => {
    const registration = await navigator.serviceWorker.ready;
    const token = await M.getToken(M.getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw { code: 'messaging/token-unavailable' };
    return token;
  };
  const tokenEntry = () => ({ at: Date.now(), ua: navigator.userAgent.slice(0, 150) });

  window.VocabCloud = {
    signInGoogle(){ return A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
    signInEmail(email, password){ return A.signInWithEmailAndPassword(auth, email, password); },
    signUpEmail(email, password){ return A.createUserWithEmailAndPassword(auth, email, password); },
    resetPassword(email){ return A.sendPasswordResetEmail(auth, email); },
    signOut(){ return A.signOut(auth); },
    /* patch : { idDuMot: { arfr: {...}, frar: {...} } } — fusionné avec l'existant */
    pushProgress(patch){
      if (!current) return Promise.resolve();
      return F.setDoc(userRef(), { progress: patch, updatedAt: F.serverTimestamp() }, { merge: true });
    },
    pushSession(id, record){
      if (!current) return Promise.resolve();
      const data = Object.assign({}, record); delete data.id;
      return F.setDoc(F.doc(db, 'users', current.uid, 'sessions', id), data);
    },
    async pushSessions(list){
      if (!current || !list.length) return;
      for (let i = 0; i < list.length; i += 400){
        const batch = F.writeBatch(db);
        for (const record of list.slice(i, i + 400)){
          const data = Object.assign({}, record); delete data.id;
          batch.set(F.doc(db, 'users', current.uid, 'sessions', record.id), data);
        }
        await batch.commit();
      }
    },
    /* Notifications de rappel : le jeton de chaque appareil est rangé dans users/<uid>.notif.tokens */
    async notifSupport(){
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
      try { const M = await loadMessaging(); return (await M.isSupported()) ? 'ok' : 'unsupported'; }
      catch (e) { return 'unsupported'; }
    },
    async enableNotifications(settings){
      if (!current) throw { code: 'auth/required' };
      const M = await loadMessaging();
      const token = await pushToken(M);
      await F.setDoc(userRef(), { notif: Object.assign({ enabled: true, tokens: { [token]: tokenEntry() } }, settings), updatedAt: F.serverTimestamp() }, { merge: true });
      return token;
    },
    async refreshNotifications(oldToken){
      if (!current || Notification.permission !== 'granted') return oldToken;
      const M = await loadMessaging();
      const token = await pushToken(M);
      if (token !== oldToken){
        await F.setDoc(userRef(), { notif: { enabled: true, tokens: { [token]: tokenEntry() } } }, { merge: true });
        if (oldToken) await F.updateDoc(userRef(), new F.FieldPath('notif', 'tokens', oldToken), F.deleteField()).catch(() => {});
      }
      return token;
    },
    async updateNotifSettings(settings){
      if (!current) return;
      await F.setDoc(userRef(), { notif: settings }, { merge: true });
    },
    async disableNotifications(token){
      try { const M = await loadMessaging(); await M.deleteToken(M.getMessaging(app)); } catch (e) {}
      if (current && token) await F.updateDoc(userRef(), new F.FieldPath('notif', 'tokens', token), F.deleteField());
    },
    async resetAll(){
      if (!current) return;
      const resetAt = Date.now();
      await F.setDoc(userRef(), { progress: {}, resetAt, updatedAt: F.serverTimestamp() });
      const snap = await F.getDocs(F.collection(db, 'users', current.uid, 'sessions'));
      for (let i = 0; i < snap.docs.length; i += 400){
        const batch = F.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      return resetAt;
    }
  };
  emit('ready');
}

start().catch(err => emit('unavailable', { message: String((err && err.message) || err) }));
