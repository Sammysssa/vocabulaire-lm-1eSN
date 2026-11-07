# Vocabulaire arabe

Application web installable pour réviser le vocabulaire du cours d'arabe : révision espacée, défilement, examens (QCM ou réponse écrite), statistiques de progression et prononciation intégrée.

Le vocabulaire est commun à tous et se trouve dans `words.json`. La progression de chaque élève reste enregistrée sur son propre téléphone : pas de compte, pas de serveur.

## Mettre l'app en ligne (une seule fois)

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Crée un dépôt : bouton « New repository », nom `vocabulaire-arabe`, visibilité **Public** (nécessaire pour l'hébergement gratuit), sans README.
3. Envoie les fichiers : sur la page du dépôt vide, clique sur « uploading an existing file », glisse **le contenu** du dossier (pas le dossier lui-même), puis « Commit changes ».
4. Active l'hébergement : Settings, puis Pages. Dans « Build and deployment », choisis « Deploy from a branch », branche `main`, dossier `/ (root)`, puis Save.
5. Après une à deux minutes, l'app est en ligne à l'adresse `https://<ton-pseudo>.github.io/vocabulaire-arabe/`. C'est ce lien que tu partages avec ta classe.

En ligne de commande, les étapes 3 et 4 deviennent :

```bash
git init && git add . && git commit -m "Première version"
git branch -M main
git remote add origin https://github.com/<ton-pseudo>/vocabulaire-arabe.git
git push -u origin main
```

## Installer l'app sur son téléphone

- **iPhone** : ouvre le lien dans Safari, touche le bouton Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite toujours l'app depuis son icône : sur iPhone, la progression de l'icône et celle de Safari sont séparées.
- **Android** : ouvre le lien dans Chrome, menu ⋮, puis « Installer l'application ».
- **Ordinateur** : Chrome et Edge proposent une icône d'installation dans la barre d'adresse. L'app marche aussi très bien dans un simple onglet.

## Ajouter les mots de la semaine

Chaque mot de `words.json` ressemble à ceci :

```json
{
  "id": "s2-qalam",
  "week": 2,
  "ar": "قَلَمٌ",
  "fr": "un stylo",
  "root": "ق ل م",
  "plural": "أَقْلَامٌ",
  "example": "",
  "note": "",
  "audio": "audio/s2-qalam.mp4"
}
```

Seuls `id`, `week`, `ar` et `fr` sont obligatoires. Deux règles :

- **L'`id` ne doit jamais changer** une fois publié : la progression des élèves y est rattachée. La convention `s<semaine>-<mot en translittération>` évite les doublons.
- **Écris l'arabe avec ses voyelles** (harakat) : c'est ce qui s'affiche sur les cartes et ce qui permet une prononciation correcte.

Deux façons de faire :

- **Avec Claude** : envoie la photo de la fiche. Claude te renvoie le `words.json` mis à jour et les fichiers audio. Remplace-les dans le dépôt (Add file, puis Upload files) et valide.
- **À la main** : modifie `words.json` directement sur GitHub (icône crayon), puis génère la prononciation des nouveaux mots avec `python tools/generate_audio.py` (voir les prérequis en tête du script) et envoie le dossier `audio/`.

Tes camarades voient les nouveaux mots à la prochaine ouverture de l'app avec une connexion.

## Faire évoluer l'app

Chaque modification envoyée sur la branche `main` est republiée automatiquement en une à deux minutes. Les élèves reçoivent la nouvelle version à la prochaine ouverture, et leur progression est conservée.

Pour ne rien casser :

- **Garde la même adresse** (même compte GitHub). La progression est liée à l'adresse du site : changer de pseudo GitHub ou d'hébergeur la ferait repartir de zéro.
- **Ne renomme pas les clés de stockage** définies en haut de `app.js` (`vocab-arabe-…`).
- **Si tu supprimes ou renommes des fichiers**, augmente `VERSION` dans `sw.js` pour vider les anciens caches.

Avec Claude Code, il suffit d'ouvrir le dépôt et de décrire la modification voulue : Claude modifie les fichiers, tu testes, puis tu pousses. Le fichier `CLAUDE.md` lui donne tout le contexte du projet (marche à suivre de chaque semaine, choix pédagogiques, pièges, questions en attente).

Avant de publier, lance la vérification automatique : `node tools/tests/check.mjs` (la première fois : `npm install --no-save playwright` puis `npx playwright install chromium`). Elle contrôle les fichiers audio, les erreurs JavaScript sur chaque écran et chacun des exercices générés.

Pour les phrases et les formes conjuguées, `tools/best_of.py` fait plusieurs prises de prononciation et garde la plus claire grâce à la reconnaissance vocale (mode d'emploi en tête du script).

## Sans connexion

L'app marche sans réseau (avion, métro). Le service worker garde l'app, le vocabulaire et les leçons ; au démarrage, l'app télécharge aussi en arrière-plan tous les fichiers audio (mots, leçons, conjugueur, phrases) et les polices. Dans Réglages, le bloc « Sans connexion » indique si tout est prêt et propose « Tout télécharger maintenant ». Hors connexion, un badge le signale en haut de l'écran.

La progression est toujours enregistrée d'abord sur l'appareil. Pour un élève connecté, Firestore garde les envois en attente (cache persistant) et les transmet au retour du réseau, même si l'app a été fermée entre-temps ; au démarrage suivant, l'app fusionne de toute façon l'appareil et le compte (la révision la plus récente l'emporte). Un message confirme la synchronisation quand la connexion revient.

Ne marchent qu'avec internet : l'alphabet et la dictée (sites externes), le classement et « Demander une explication ».

## Progression

Elle est enregistrée dans le navigateur de chaque appareil. Dans Réglages, « Sauvegarder ma progression » crée un fichier à garder de côté, et « Restaurer une sauvegarde » le recharge sur un autre appareil. Les deux progressions sont fusionnées, en gardant la plus récente pour chaque mot.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html`, `style.css`, `app.js` | L'application |
| `words.json` | Le vocabulaire du cours |
| `grammar.json` | Les leçons de grammaire, les exercices et les phrases à traduire |
| `devoirs.json` | La liste des devoirs de la semaine |
| `audio/` | La prononciation de chaque mot |
| `fonts/` | Les polices, hébergées avec l'app pour fonctionner hors connexion |
| `icons/`, `manifest.webmanifest` | L'icône et les informations d'installation |
| `cloud.js`, `firebase-config.js` | La sauvegarde en ligne (Firebase) |
| `sw.js` | Le fonctionnement hors connexion |
| `tools/generate_audio.py` | La génération de la prononciation |
| `tools/best_of.py` | La prononciation « au meilleur de plusieurs prises » (phrases, conjugaisons) |
| `tools/tests/check.mjs` | La vérification automatique avant publication |
| `CLAUDE.md` | Les consignes pour Claude Code |
| `tools/send-reminders.mjs`, `.github/workflows/rappels.yml` | L'envoi des rappels de révision |

## Sauvegarde en ligne (Firebase)

Chaque élève peut créer un compte dans les réglages de l'app, avec Google ou avec un e-mail et un mot de passe. Sa progression est alors sauvegardée en ligne et se retrouve sur tous ses appareils. Sans compte, l'app fonctionne comme avant, avec la progression sur l'appareil.

- Projet Firebase : `vocabulaire-lm-1esn`, formule gratuite Spark (aucune facturation possible).
- Base Firestore à Paris (`europe-west9`). Chaque élève a un document `users/<son identifiant>` (progression) et une sous-collection `sessions` (historique des séances).
- Règles de sécurité : un élève ne peut lire et modifier que ses propres données.
- La configuration publique du projet est dans `firebase-config.js`. Elle n'a rien de secret : la sécurité repose sur les règles. Laisse l'objet vide pour désactiver la sauvegarde en ligne.
- Le code de synchronisation est dans `cloud.js`. Si un mot a été révisé sur deux appareils, la révision la plus récente l'emporte.
- La liste des comptes se consulte dans la console Firebase, rubrique Authentication.

## Rappels de révision (notifications)

Chaque élève connecté peut activer, dans les réglages, un rappel quotidien à l'heure de son choix. Il ne le reçoit que s'il a des cartes à réviser. Sur iPhone, l'app doit être installée sur l'écran d'accueil (iOS 16.4 ou plus récent).

- Le téléphone s'inscrit auprès de Firebase Cloud Messaging ; son jeton est rangé dans `users/<uid>.notif`.
- La tâche planifiée `.github/workflows/rappels.yml` lance `tools/send-reminders.mjs` quatre fois par heure (GitHub saute beaucoup de passages planifiés, d'où cette marge). Le script lit la progression de chaque élève inscrit, compte les cartes à réviser et envoie la notification.
- Le script a besoin du secret GitHub `FIREBASE_SERVICE_ACCOUNT` : le contenu du fichier JSON obtenu dans la console Firebase (Paramètres du projet, Comptes de service, « Générer une nouvelle clé privée »). Ne mets jamais ce fichier dans le dépôt.
- Pour tester : onglet Actions du dépôt, « Rappels de révision », « Run workflow », en cochant la case de test.
- GitHub suspend les tâches planifiées d'un dépôt resté sans modification pendant 60 jours. L'ajout hebdomadaire du vocabulaire suffit à les garder actives.
- Messages spéciaux (par exemple une semaine de consolidation sans nouveau contenu) : ajoute dans `tools/campagnes.json` une campagne avec son titre et un message par jour (date à Paris, au format `AAAA-MM-JJ`). Ces jours-là, le message remplace le rappel habituel : il part à l'heure choisie par chaque élève, même sans carte à réviser, une seule fois par jour. Le champ `lien` ouvre l'app au bon endroit quand on touche la notification : `#reviser`, `#semaine-2`, `#examen`, `#grammaire` (toutes les leçons) ou `#grammaire-phrase` (une leçon, par son identifiant), `#traduction`, `#feuille-blanche` ou `#pratique`.
- Messages de chaque semaine : la liste `hebdo` de `tools/campagnes.json` donne un message par jour de la semaine (`lundi`, `mardi`…). Aujourd'hui, chaque mardi, le lendemain du cours, la notification propose la feuille blanche. Les dates listées dans `sauf` (vacances, cours annulé) sont sautées. Un message daté de `campagnes` passe avant.

## Grammaire

L'onglet Grammaire contient les fiches des leçons et des exercices, en deux parties choisies en haut de l'onglet : Grammaire (le nom, les pronoms, la phrase verbale…) et Conjugaison (le passé, le présent). Une leçon va dans la partie Conjugaison quand elle porte `"section": "conjugaison"`. Les exercices se lancent pour une leçon ou pour toute une partie, depuis l'onglet ou depuis Réviser (choix Vocabulaire, Grammaire ou Conjugaison).

La partie Conjugaison contient aussi le conjugueur : pour chaque verbe du cours, son tableau complet au passé (singulier, duel, pluriel) et au présent, calculé par l'app, avec les lettres du sujet en rouge comme dans le livre, et un entraînement sur ce verbe seul. L'audio de chaque case est listé dans `conjugueur.audio` de `grammar.json` (identifiant du verbe, puis la personne : `3f`, `3md`… pour le passé, `p3m`, `p3f` (aussi utilisé pour « tu »), `p2f`, `p1`, `p1p` pour le présent) ; pour « il » au passé, c'est l'audio du mot. Une case sans audio reste simplement muette. Liens directs : `#conjugaison` et `#conjugaison-<identifiant du verbe>` (par exemple `#conjugaison-s1-kataba`).

Les exercices ont deux modes : **Entraînement** (explication après chaque réponse) et **Examen chronométré** (5, 10, 15 ou 20 secondes par question, au choix ; sans réponse, la question compte comme fausse ; l'explication s'affiche après chaque question, puis le chrono repart à la suivante).

Chaque question générée connaît sa leçon. Une séance enregistre ses résultats par leçon (`byLesson` dans l'historique, synchronisé avec le compte), ce qui permet à l'onglet Progrès d'afficher la **maîtrise de chaque leçon** : bonnes réponses sur les 30 dernières questions de la leçon, « Maîtrisé » à partir de 80 % sur au moins 15 questions. Progrès résume aussi la traduction et la feuille blanche.

Pour la ligature لا : un ل suivi d'un alif ne doit jamais être coupé entre deux parties colorées, sinon le navigateur dessine deux lettres séparées. `splitHtml` regroupe automatiquement le ل avec l'alif (`keepLamAlif`).

Tout le contenu est dans `grammar.json` :

- `lessons` : les fiches (titre, règle, tableau des formes avec la partie à surligner, remarques, audio). Une fiche peut être faite de blocs (`blocks`) : titre (`h`), texte (`text`), remarque (`note`), liste de formes (`rows`), citation (`quote`), tableau de conjugaison singulier / pluriel (`conj`, avec pour chaque case le pronom `pron`, la forme `base` + la terminaison `end` affichée en rouge, la traduction `fr` et l'`audio`), tableau des pronoms attachés (`ptable` : pronom `p`, sens avec un nom `nom` et avec un verbe `verbe`) et phrase analysée (`svo` : liste de mots avec leur rôle `v` verbe, `s` sujet, `o` complément, la traduction `fr`, l'`audio` et une remarque `note` ; les terminaisons du sujet et du complément sont colorées).
- Dans un tableau `conj`, une case peut aussi avoir un préfixe `pre` (en rouge, pour le présent : يَـ تَـ أَ نَـ) et une fin `post` affichée sans couleur (le alif de فَعَلُوا, qui ne fait pas partie du sujet). Le nombre de colonnes suit `cols` (singulier, duel, pluriel). Un titre `h` qui porte un champ `added` reçoit le badge « Nouveau » pendant la semaine.
- `retenir` (dans chaque leçon) : l'essentiel à retenir, avec la semaine où il a été vu (`week`). Il s'affiche en bas de la fiche et sert de liste de contrôle pour la feuille blanche.
- `rules` : les questions sur les règles, avec la bonne réponse (`a`), les mauvaises (`wrong`) et l'explication (`why`). Pour la leçon du passé, le champ `num` indique si la question porte sur le singulier (`s`, par défaut), le duel (`d`), le pluriel (`p`) ou tous (`all`) : l'élève peut choisir de s'entraîner sur l'un ou l'autre.
- `traduction` : l'exercice de traduction. `phrases` contient les phrases du cours (`fr`, la correction `ar`, une `aide` pour les mots pas encore appris, des explications `notes` et l'`audio`). `objets` donne, pour chaque verbe, les compléments qui ont du sens avec lui, et `sujets` les noms qui peuvent faire l'action : l'app s'en sert pour fabriquer des phrases nouvelles.
- `verbs` : les verbes vus en grammaire qui ne sont pas dans le vocabulaire (par exemple دَرَسَ).
- `nouns` : les noms vus en grammaire qui ne sont pas dans le vocabulaire (par exemple فَصْلٌ), avec la liste des leçons (`lessons`) où ils servent.
- `sentences` : les phrases modèles de la leçon « La phrase verbale » (`verb`, `subj` et, si le verbe en a un, `obj`, chacun étant l'identifiant d'un mot). L'app en tire toutes les variantes avec ou sans ال, au masculin ou au féminin, et les exercices sur les terminaisons. Choisis des combinaisons qui ont du sens (« le commerçant a mangé la poule »).

Les exercices d'application sont générés automatiquement à partir du vocabulaire, grâce au champ `type` de chaque mot de `words.json` (`nom`, `verbe`, `adjectif`) :

- les noms (« un… », « une… ») servent aux pronoms possessifs ; un champ `plural` + `fr_plural` ajoute les exercices au pluriel ;
- les verbes servent à la conjugaison du passé ; le champ `pc` donne la traduction française pour chaque personne : singulier `3m`, `3f`, `2m`, `2f`, `1` et pluriel `3mp` (ils), `3fp` (elles), `2mp` (vous, garçons ou groupe mixte), `2fp` (vous, filles), `1p` (nous). Si le pluriel manque, il est déduit de « il a … » (verbes avec avoir seulement) ; pour les verbes pronominaux (s'asseoir…), écris-le. Quand la dernière lettre de la racine est la même que celle de la terminaison, elles fusionnent avec une chadda (سَكَتُّ, سَكَتُّمْ). Un verbe qui peut avoir un complément (manger, écrire…) porte `"trans": true` : il sert alors aussi aux exercices de pronoms attachés au verbe (أَكَلَهُ, il l'a mangé). Un verbe irrégulier peut recevoir ses formes exactes dans un champ `forms`. Le duel (`3md` eux deux, `3fd` elles deux, `2d` vous deux) est construit automatiquement ; sa traduction reprend celle du pluriel.
- le présent : le champ `pres` donne la forme avec « il » (يَكْتُبُ) et `pr` la traduction pour `3m`, `3f`, `2m`, `2f`, `1` et `1p`. L'app remplace le préfixe pour les autres personnes (تَـ، أَ، نَـ), ajoute ـِينَ pour « tu (fille) » et écrit آ quand le préfixe أَ rencontre un أْ (آكُلُ). La voyelle de la 3e lettre vient de `pres` : c'est celle donnée par le professeur.

## Classement de la classe

Dans les réglages, un élève connecté peut rejoindre le classement avec un pseudo. Seuls son pseudo, son temps de révision et ses points sont visibles par les autres élèves connectés (collection Firestore `leaderboard`).

- Temps : temps actif passé dans les séances (révision, défilement, examen, grammaire), chaque pause étant plafonnée à 90 secondes.
- Points : 1 point par carte réussie en révision, 2 points par bonne réponse en examen et en grammaire.
- La semaine de classement va du lundi 19 h au lundi suivant 19 h (heure de Paris) ; « Depuis le début » cumule tout.

Règles Firestore à ajouter à côté de celles des utilisateurs :

```
match /leaderboard/{uid} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null && request.auth.uid == uid
    && request.resource.data.keys().hasOnly(['name', 'week', 'weekSecs', 'weekPoints', 'totalSecs', 'totalPoints', 'updatedAt'])
    && request.resource.data.name is string && request.resource.data.name.size() >= 2 && request.resource.data.name.size() <= 20
    && request.resource.data.week is string
    && request.resource.data.weekSecs is number && request.resource.data.weekSecs >= 0 && request.resource.data.weekSecs <= 604800
    && request.resource.data.weekPoints is number && request.resource.data.weekPoints >= 0 && request.resource.data.weekPoints <= 100000
    && request.resource.data.totalSecs is number && request.resource.data.totalSecs >= 0
    && request.resource.data.totalPoints is number && request.resource.data.totalPoints >= 0;
  allow delete: if request.auth != null && request.auth.uid == uid;
}
```

## Badge « Nouveau »

Chaque nouveau contenu porte un champ `added` (date et heure d'ajout, par exemple `"2026-10-06T12:00:00+02:00"`) dans `words.json` (mots) ou `grammar.json` (leçons). Il affiche le badge « Nouveau » et colore l'onglet concerné jusqu'à la fin de la semaine de classe, le lundi suivant à 19 h (heure de Paris). Pense à renseigner `added` à chaque ajout.

## Demander une explication

Après chaque correction (grammaire, examen), sur la fiche d'un mot et en bas de chaque leçon, le bouton « Demander une explication » prépare un message pour un assistant IA : niveau de l'élève, exercice, bonne réponse, réponse de l'élève, explication de l'app, puis une demande précise (pourquoi, deux autres exemples…). L'élève choisit Claude ou ChatGPT : l'assistant s'ouvre avec le texte déjà écrit, et le texte est aussi copié au cas où. Rien ne passe par l'app ni par Firebase, donc aucun coût ni clé à gérer. La liste des assistants est dans `ASK_TARGETS` (`app.js`), le cadrage commun dans `ASK_FRAME`.

## Onglet Pratique

L'onglet Pratique (anciennement Lecture) regroupe les exercices à faire à côté de l'écran. Toucher à nouveau l'onglet ramène à son accueil.

- **Traduire des phrases** : l'élève prend une feuille, écrit la phrase en arabe avec les voyelles, puis affiche la correction (avec l'audio pour les phrases du cours et des explications) et note lui-même son résultat : juste, petite erreur ou à revoir. Deux séries : les phrases du cours (`traduction.phrases` dans `grammar.json`) ou des phrases nouvelles fabriquées par l'app à partir du vocabulaire (passé à toutes les personnes avec le duel, présent, phrases avec un nom sujet, compléments avec ou sans ال, règle des deux soukoun). « Ils » ou « elles » sans précision veut dire trois ou plus ; le duel est écrit « Ils (deux) ».
- **La feuille blanche** : la méthode du professeur. L'élève choisit le cours (le dernier par défaut), lance un minuteur s'il le veut, écrit de mémoire tout ce qu'il a retenu, puis coche dans la liste les mots de la semaine et les points « à retenir » des leçons qu'il avait écrits. Les mots oubliés peuvent être révisés tout de suite. Le mardi et le mercredi, un encadré le propose sur la page Réviser tant qu'il n'a pas été fait dans la semaine, et une notification le rappelle le mardi.
- **L'alphabet** (site Ataallam, https://lettres.elatarbiyah.fr/) et **la dictée** (https://dictee-elatarbiyah.fr/) s'affichent dans l'app ; chacun reste ouvert dans son cadre quand on change d'onglet. Ils demandent une connexion internet ; le bouton « Ouvrir » ouvre le site dans le navigateur si l'affichage intégré ne fonctionne pas.

Liens directs : `#pratique`, `#traduction`, `#feuille-blanche`, `#alphabet`, `#dictee`. Pour ajouter un site, complète `READERS` dans `app.js` et ajoute son cadre et son bouton dans `index.html`.

## Devoirs

`devoirs.json` contient la liste des devoirs donnés en cours. Elle s'affiche en haut de la page Réviser jusqu'à la date `pour` (le prochain cours), et chaque élève coche ce qu'il a fait (sur son appareil). Pour une nouvelle liste, change `id` (par exemple `2026-s6`), la date `pour` et les `items` : `id`, `titre`, `detail`, `facultatif` et un `lien` facultatif vers l'app (`#semaine-6`, `#grammaire-present`…) avec son texte `lienTexte`.

## Révision espacée

- « À revoir » remet la carte à zéro (plus aucune maîtrise) et la représente dans la séance.
- Juste après un échec, les intervalles sont courts : Difficile = 10 min, Bien = 1 jour, Facile = 2 jours.
- Ensuite, Difficile, Bien et Facile proposent toujours trois durées différentes et croissantes.
- Un mot raté à l'examen repart aussi à zéro et revient dans la révision du jour.

## Signalements d'erreurs

Après chaque correction (grammaire, examen, révision, défilement), sur la fiche d'un mot et en bas de chaque leçon, un lien « Signaler une erreur » ouvre un panneau qui rappelle la correction, demande à l'élève de confirmer et d'expliquer l'erreur, puis l'enregistre dans la collection Firestore `reports`.

- Les administrateurs sont les comptes listés dans la collection `admins` (un document par identifiant de compte, créé depuis la console Firebase). Ils voient les signalements dans les réglages de l'app et peuvent les marquer comme traités ou les supprimer.
- La tâche planifiée des rappels envoie aussi une notification aux administrateurs quand un nouveau signalement arrive (dans l'heure).

Règles Firestore à ajouter :

```
match /admins/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
}
match /reports/{id} {
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.keys().hasOnly(['uid', 'name', 'at', 'kind', 'ref', 'question', 'answer', 'given', 'comment', 'status', 'notified', 'app'])
    && request.resource.data.comment is string && request.resource.data.comment.size() >= 5 && request.resource.data.comment.size() <= 1000
    && request.resource.data.question is string && request.resource.data.question.size() <= 600
    && request.resource.data.answer is string && request.resource.data.answer.size() <= 600
    && request.resource.data.given is string && request.resource.data.given.size() <= 300
    && request.resource.data.status == 'new' && request.resource.data.notified == false;
  allow read, update, delete: if request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
```
