# Vocabulaire arabe 1eSN : consignes pour Claude

Ce fichier est lu automatiquement par Claude Code. Il résume ce qu'il faut savoir pour continuer le projet. Le fonctionnement détaillé des fichiers de données est dans `README.md`.

## Le projet

- Application web installable (PWA) de révision pour la classe d'arabe **1eSN 2026-2027 de La Madrassa**. Sammy, élève de la classe, la construit avec Claude depuis septembre 2026 pour lui et ses camarades.
- En ligne : https://sammysssa.github.io/vocabulaire-lm-1eSN/ (GitHub Pages, branche `main`, racine du dépôt). Publier = pousser sur `main` ; le déploiement prend 1 à 2 minutes.
- Le professeur est appelé « le Moualim ». Le cours a lieu le **lundi soir** : une « semaine » de l'app va du lundi 19 h au lundi 19 h (heure de Paris).

## Ce que Sammy attend à chaque échange

Chaque semaine, il envoie le contenu du cours : photos du cahier ou du livre, diapositives du professeur, règles en texte, devoirs, parfois le résumé d'un camarade.

1. **Expliquer et valider** les règles, en français, simplement, avec des exemples arabes vocalisés.
2. **Corriger ce qui est faux** (dans ses notes, le résumé d'un camarade ou une traduction) et le dire clairement dans la réponse, avec la bonne version. Ne jamais intégrer une erreur telle quelle.
3. **Intégrer** dans l'app (vocabulaire, leçons, exercices, audio, devoirs) et **publier**.
4. **Proposer** des améliorations quand c'est utile ; il aime qu'on lui donne un avis franc.

Toujours répondre **en français**. Pour une tâche dans le navigateur, si une action plante, réessayer ou recharger la page et continuer plutôt que s'arrêter.

## Interdits

- Ne **jamais** mettre la clé du compte de service Firebase dans le dépôt : elle vit uniquement dans le secret GitHub `FIREBASE_SERVICE_ACCOUNT`. `firebase-config.js` contient la configuration web publique, c'est normal.
- Ne pas créer de compte ni taper de mot de passe à la place de Sammy.
- Ne pas supprimer ou réécrire l'historique Firestore des élèves.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | L'app (JavaScript sans framework, tout dans une IIFE). `APP_VERSION` en haut de `app.js`. |
| `sw.js` | Service worker (hors ligne). `VERSION` à augmenter à chaque publication ; `SHELL_FILES` liste les fichiers à garder en cache. |
| `cloud.js`, `firebase-config.js` | Comptes (Firebase Auth), sauvegarde de la progression (Firestore), notifications (FCM). |
| `words.json` | Vocabulaire. |
| `grammar.json` | Leçons, questions sur les règles, phrases à traduire, audio du conjugueur. |
| `devoirs.json` | Liste des devoirs de la semaine (page Réviser). |
| `audio/` | Prononciations (`<id>.mp4`). |
| `tools/generate_audio.py` | Voix de synthèse arabe pour les mots de `words.json`. |
| `tools/best_of.py` | Plusieurs prises par texte, Whisper garde la plus claire (leçons, phrases, conjugaisons). |
| `tools/send-reminders.mjs`, `tools/campagnes.json`, `.github/workflows/rappels.yml` | Notifications de rappel (GitHub Actions, 4 passages par heure). |
| `tools/tests/check.mjs` | Vérification automatique avant publication. |
| `vocabulaire-arabe/` | **Ancienne copie de l'app** (20 octobre), ajoutée par erreur lors d'un envoi. Elle est publiée sur le site mais n'est pas utilisée. Demander à Sammy avant de la supprimer. |

## L'app aujourd'hui (version 1.13.1)

Onglets : **Réviser** (révision espacée, examen, devoirs, sélecteur Vocabulaire / Grammaire / Conjugaison), **Vocabulaire** (liste par semaine, fiches), **Grammaire** (deux parties : Grammaire et Conjugaison, avec le conjugueur ; exercices en mode Entraînement ou Examen chronométré), **Pratique** (traduction sur feuille, feuille blanche, alphabet, dictée), **Progrès** (statistiques, maîtrise des mots et de chaque leçon, travail sur feuille, classement).

Autres éléments :
- comptes et synchronisation ; fonctionnement complet sans connexion (Réglages > « Sans connexion », tous les audios pré-téléchargés, envois en attente gardés par Firestore) ;
- notifications à l'heure choisie par chaque élève ;
- signalement d'erreurs (enregistré dans Firestore `reports`, les comptes de la collection `admins` sont prévenus par notification et les voient dans Réglages) ;
- bouton « Demander une explication » qui prépare une question pour Claude ou ChatGPT ;
- badges « Nouveau » sur ce qui a un champ `added` de la semaine en cours ;
- liens directs : `#reviser`, `#semaine-N`, `#examen`, `#grammaire`, `#grammaire-<leçon>`, `#conjugaison`, `#conjugaison-<id du verbe>`, `#pratique`, `#traduction`, `#feuille-blanche`, `#alphabet`, `#dictee`.

Programme vu jusqu'à la semaine 5 :
- 22 mots ;
- le nom (tanwîn, ال, prépositions) ;
- les pronoms possessifs et les pronoms attachés ;
- le passé (singulier, duel, pluriel) ;
- la phrase verbale (verbe, sujet, complément ; deux soukoun) ;
- le présent, première colonne.

## Ajouter une semaine : la marche à suivre

1. **Lire** les photos. Transcrire chaque mot **avec toutes les voyelles**, vérifier la racine et le sens, et repérer les erreurs.
2. **`words.json`** : identifiant `sN-mot` (par exemple `s5-nahr`), `week`, `ar`, `fr` (« un/une … » pour les noms), `root`, `type`, `note` si utile, et `added` à la date de publication (par exemple `"2026-11-04T08:00:00+01:00"`). Pour un verbe, ajouter aussi :
   - `pc` : passé composé par personne ;
   - `pres` : la forme « il » au présent, avec la voyelle de la 3e lettre donnée par le professeur ;
   - `pr` : traductions pour `3m 3f 2m 2f 1 1p` ;
   - `trans` : vrai s'il prend un complément.
3. **Les compléments** : ajouter dans `grammar.json` → `traduction.objets` les compléments qui ont du sens avec le verbe, et dans `traduction.sujets` les noms qui peuvent faire l'action. Ils servent aux phrases générées.
4. **`grammar.json`** :
   - leçons : blocs `h`, `text`, `note`, `rows`, `conj`, `svo`… Mettre `"section": "conjugaison"` pour une leçon de conjugaison et `added` sur les nouveaux titres ;
   - liste `retenir` avec le numéro de `week` (elle sert aussi à la feuille blanche) ;
   - `rules` : questions sur les règles (`lesson`, `q`, `a`, `wrong`, `why`, `ar`, `num` pour le passé).
5. **`devoirs.json`** : nouvel `id`, date `pour` (le lundi suivant, 19 h) et `items`.
6. **Audio** (voir plus bas). Chaque chemin `audio/...` cité dans les JSON doit exister.
7. **Version** : augmenter `APP_VERSION` (`app.js`) et `VERSION` (`sw.js`) ; ajouter tout nouveau fichier à `SHELL_FILES`.
8. **Vérifier** :
   - `node tools/tests/check.mjs` doit afficher « Tout est bon. » ;
   - regarder les nouveaux écrans à 360-390 px de large, en thème clair et sombre (captures Playwright) ;
   - contrôler l'affichage de l'arabe dans le texte français.
9. **README** à jour si le fonctionnement change.
10. **Publier** : commit en français, push sur `main`, puis contrôler le site en ligne.
11. **Répondre à Sammy** :
    - les règles expliquées ;
    - les corrections ;
    - ce qui a changé dans l'app ;
    - les questions éventuelles, peu nombreuses.

## Choix pédagogiques déjà faits (à garder cohérents)

- **Lettres rouges = sujets**, comme dans le livre : rien en rouge pour فَعَلَ et فَعَلَتْ (le تْ marque seulement le féminin), seulement le ا de فَعَلَتَا, seulement le و de فَعَلُوا (le alif est affiché sans couleur). Au présent, le préfixe est en rouge, ainsi que ـِينَ.
- **Personnes** dans le code (`PERS`) : `3m 3f 2m 2f 1`, duel `3md 3fd 2d`, pluriel `3mp 3fp 2mp 2fp 1p`. Le duel se traduit comme le pluriel. Les libellés précisent « (deux) » et « (trois ou plus) ».
- **Phrases à traduire**, dans le style du professeur :
  - « Vous (masculin) », « Tu (féminin) », « Ils (deux) » ;
  - « Ils » ou « Elles » sans précision = trois ou plus.
- **Présent** :
  - préfixe avec fatha, soukoun sur la 2e lettre, voyelle de la 3e lettre propre au verbe, damma finale ;
  - damma sur le préfixe pour un verbe de 4 lettres ;
  - tu (fille) : تَفْعَلِينَ ;
  - أَنَا + أْ → آ (آكُلُ) ;
  - تَـ sert pour « elle » et « tu (garçon) ».
- **Deux soukoun de suite** interdits : تْ devient تِ devant ال, et ـتُمْ devient ـتُمُ.
- **ه = lettre de l'absent** (هُوَ، هِيَ، هُمَا، هُمْ، هُنَّ).
- **Complément indéfini** : tanwîn ـً (avec un alif, sauf après ة). Un résumé d'élève disait « damma » : c'est faux.

## Pièges d'affichage de l'arabe

- Dans un texte français, toujours passer par `arWrap()` (isole chaque passage arabe dans un `<bdi>`). Si on utilise `esc()` seul, une racine comme « ك ت ب » s'affiche à l'envers.
- Éviter la virgule latine ou « : » entre deux passages arabes dans une même phrase (l'ordre peut s'inverser) : écrire « et » ou « mais », ou reformuler.
- Les couleurs à l'intérieur d'un mot utilisent des liaisons invisibles (`splitHtml`, `JOINS_NEXT`) : passer par ces fonctions plutôt que des `<span>` nus.
- La ligature **لا** ne doit jamais être coupée entre deux `<span>` (sinon lam et alif s'affichent séparés) : `splitHtml` s'en charge (`keepLamAlif`), le ل prend alors la couleur de l'alif.
- Les intitulés français longs des tableaux (interlocuteur(s)) portent un trait d'union conditionnel (U+00AD) pour couper proprement sur téléphone.

## L'audio

- Voix : **Piper « miro V2 »** (arabe), modifiée pour régler la durée de chaque son (`tools/generate_audio.py`, modèle téléchargé dans `tools/.models`). Prérequis : `espeak-ng`, `ffmpeg`, `pip install onnx onnxruntime soundfile numpy sherpa-onnx`.
- Mots : `python tools/generate_audio.py` (ou avec des identifiants). Champ `say` quand la prononciation doit différer de l'écriture, par exemple `نَبِيٌّ` → `say: "نَبِيْيُنْ"`.
- Phrases, formes de leçon, conjugaisons : `python tools/best_of.py <sortie> <éléments.json>` (format dans l'en-tête du script). Whisper réécoute chaque prise et garde la meilleure ; pour une forme conjuguée, ajouter `"person"` pour exiger que les lettres du sujet s'entendent. **Sous 0,86 : douteux**. Mieux vaut une case muette qu'une prononciation fausse.
- Défauts connus de la voix :
  - ر entendu ل : essayer `"r": [1.0, 1.5, 2.0]` ;
  - voyelle avant une chadda perdue (le script remet la chadda d'abord) ;
  - tanwîn mal lu (corrigé dans `spoken_text`) ;
  - le تْ final parfois avalé.
- Conjugueur : l'audio de chaque case est dans `grammar.json` → `conjugueur.audio`. Pour « il » au passé, c'est l'audio du mot.
- 15 cases sont muettes aujourd'hui :
  - كَتَبَتْ ;
  - كَسَرَ : tu (fille) au présent ;
  - جَلَسَ : جَلَسَتَا, جَلَسْتُنَّ ;
  - سَجَدَ : سَجَدْتَ, سَجَدْتُ, سَجَدُوا, سَجَدْتُنَّ ;
  - مَسَحَ : مَسَحَا, مَسَحَتَا ;
  - بَخِلَ : بَخِلَتْ, بَخِلْتُ, بَخِلْنَ, بَخِلْتُمْ, بَخِلْتُنَّ.

## Notifications

- `tools/campagnes.json` :
  - `campagnes` : messages datés, prioritaires ;
  - `hebdo` : un message par jour de la semaine, aujourd'hui la feuille blanche le mardi ;
  - `sauf` : dates à sauter, par exemple les vacances.
- Les élèves choisissent leur heure dans l'app ; un seul message par élève et par jour. Seuls quelques élèves ont activé les notifications.
- Pour tester : onglet Actions du dépôt > « Rappels de révision » > Run workflow, en cochant « test ».

## Questions en attente pour Sammy

- Pour quel jour est l'envoi audio des lettres ه et ن « avant 23 h 59 » (devoirs semaine 5) ?
- Quelles semaines sans cours (vacances) ajouter à `sauf` pour la notification du mardi ?
- Supprimer l'ancienne copie `vocabulaire-arabe/` ?
- Les cases du conjugueur restées muettes : réessayer avec d'autres réglages, ou les laisser ainsi.
