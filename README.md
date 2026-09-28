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
| `sw.js` | Le fonctionnement hors connexion |
| `tools/generate_audio.py` | La génération de la prononciation |

## Plus tard : comptes et synchronisation

Si la classe veut retrouver sa progression sur plusieurs appareils, on pourra ajouter une connexion avec Firebase (gratuit à cette échelle), sans changer l'adresse de l'app. Les progressions existantes pourront être reprises.
