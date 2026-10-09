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

Avec Claude Code, il suffit d'ouvrir le dépôt et de décrire la modification voulue : Claude modifie les fichiers, tu testes, puis tu pousses.

## Progression

Elle est enregistrée dans le navigateur de chaque appareil. Dans Réglages, « Sauvegarder ma progression » crée un fichier à garder de côté, et « Restaurer une sauvegarde » le recharge sur un autre appareil. Les deux progressions sont fusionnées, en gardant la plus récente pour chaque mot.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html`, `style.css`, `app.js` | L'application |
| `words.json` | Le vocabulaire du cours |
| `audio/` | La prononciation de chaque mot |
| `fonts/` | Les polices, hébergées avec l'app pour fonctionner hors connexion |
| `icons/`, `manifest.webmanifest` | L'icône et les informations d'installation |
| `cloud.js`, `firebase-config.js` | La sauvegarde en ligne (Firebase) |
| `sw.js` | Le fonctionnement hors connexion |
| `tools/generate_audio.py` | La génération de la prononciation |
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
- La tâche planifiée `.github/workflows/rappels.yml` lance `tools/send-reminders.mjs` toutes les heures. Le script lit la progression de chaque élève inscrit, compte les cartes à réviser et envoie la notification.
- Le script a besoin du secret GitHub `FIREBASE_SERVICE_ACCOUNT` : le contenu du fichier JSON obtenu dans la console Firebase (Paramètres du projet, Comptes de service, « Générer une nouvelle clé privée »). Ne mets jamais ce fichier dans le dépôt.
- Pour tester : onglet Actions du dépôt, « Rappels de révision », « Run workflow », en cochant la case de test.
- GitHub suspend les tâches planifiées d'un dépôt resté sans modification pendant 60 jours. L'ajout hebdomadaire du vocabulaire suffit à les garder actives.

## Grammaire

L'onglet Grammaire contient les fiches des leçons et des exercices. Tout le contenu est dans `grammar.json` :

- `lessons` : les fiches (titre, règle, tableau des formes avec la partie à surligner, remarques, audio).
- `rules` : les questions sur les règles, avec la bonne réponse (`a`), les mauvaises (`wrong`) et l'explication (`why`).
- `verbs` : les verbes vus en grammaire qui ne sont pas dans le vocabulaire (par exemple دَرَسَ).

Les exercices d'application sont générés automatiquement à partir du vocabulaire, grâce au champ `type` de chaque mot de `words.json` (`nom`, `verbe`, `adjectif`) :

- les noms (« un… », « une… ») servent aux pronoms possessifs ; un champ `plural` + `fr_plural` ajoute les exercices au pluriel ;
- les verbes servent à la conjugaison du passé ; le champ `pc` donne la traduction française pour chaque personne (`3m`, `3f`, `2m`, `2f`, `1`). Les verbes dont la dernière lettre est ت (سَكَتَ) sont conjugués avec la chadda (سَكَتُّ). Un verbe irrégulier peut recevoir ses formes exactes dans un champ `forms`.

## Classement de la classe

Dans les réglages, un élève connecté peut rejoindre le classement avec un pseudo. Seuls son pseudo, son temps de révision et ses points sont visibles par les autres élèves connectés (collection Firestore `leaderboard`).

- Temps : temps actif passé dans les séances (révision, défilement, examen, grammaire), chaque pause étant plafonnée à 90 secondes.
- Points : 1 point par carte réussie en révision, 2 points par bonne réponse en examen et en grammaire.
- Le classement « Cette semaine » repart à zéro chaque lundi ; « Depuis le début » cumule tout.

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

## Mettre une leçon en avant

Le champ `spotlight` de `grammar.json` colore l'onglet Grammaire et ajoute un badge « Nouveau » jusqu'à la date indiquée incluse, sur les leçons d'une semaine (`{"until": "2026-10-12", "week": 3}`), sur une leçon (`"lesson": "nom"`) ou sur une liste de leçons (`"lessons": ["pronoms", "passe"]`).
