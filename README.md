# Safety First — Suivi SQCDPE

Application web installable (PWA) pour le suivi quotidien Sécurité / Qualité / Coûts / Délais / Personnel / Environnement, sur les sites **Neau, Saint-Gaultier, Terrasson et Sauveterre**.

## Ce que contient le dossier

```
safety-first-pwa/
  index.html          → page principale
  styles.css           → mise en forme
  app.js                → logique de l'application
  firebase-config.js    → clés de connexion (à compléter, voir étape 2)
  manifest.json          → identité de l'app installable
  sw.js                   → fonctionnement hors-ligne
  icons/                   → icônes de l'application
```

## Fonctionne tout de suite, en local

Sans aucune configuration, l'application fonctionne déjà : les statuts et
commentaires sont sauvegardés dans le navigateur de l'appareil utilisé.
C'est suffisant pour tester ou pour un usage sur un seul poste (ex. l'écran
de la salle de réunion).

**Limite du mode local : les données ne sont pas partagées entre appareils.**
Pour que Neau, Saint-Gaultier, Terrasson et Sauveterre alimentent chacun
leur tableau et que toute la direction voie les mêmes données en temps réel
depuis un PC ou un smartphone, il faut activer le mode cloud (étape 2
ci-dessous) — 5 minutes, gratuit pour ce volume d'usage.

## Étape 1 — Mettre l'application en ligne

Ce sont des fichiers statiques : n'importe quel hébergement simple suffit.
Deux options rapides et gratuites :

**Option A — Firebase Hosting (recommandé, s'intègre avec l'étape 2)**
```bash
npm install -g firebase-tools
firebase login
cd safety-first-pwa
firebase init hosting     # choisir "utiliser un dossier existant", répondre "non" à l'app monopage si demandé
firebase deploy
```

**Option B — Netlify / Vercel / GitHub Pages**
Glissez-déposez simplement le dossier `safety-first-pwa` dans l'interface
de Netlify (netlify.com/drop), ou poussez-le sur un dépôt GitHub et activez
GitHub Pages sur la branche.

> Important : ouvrir `index.html` directement en double-cliquant (`file://`)
> ne fonctionnera pas complètement à cause des modules JavaScript. Il faut
> toujours passer par un serveur (même local, ex. `npx serve .`) ou un
> hébergement en ligne.

## Étape 2 — Activer la synchronisation entre sites et appareils (Firebase)

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet** (gratuit).
2. Dans le projet, ouvrez **Créer une application web** (icône `</>`), donnez-lui un nom (ex. "Safety First"). Firebase affiche un bloc `firebaseConfig` : copiez ces valeurs.
3. Collez-les dans `firebase-config.js`, à la place des valeurs `VOTRE_...` :
   ```js
   export const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "monprojet.firebaseapp.com",
     projectId: "monprojet",
     storageBucket: "monprojet.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```
4. Dans la console Firebase, allez dans **Firestore Database** → **Créer une base de données** → mode production, région Europe (ex. `eur3`).
5. Dans l'onglet **Règles** de Firestore, collez :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /plants/{plantId}/months/{monthId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   Ces règles n'autorisent la lecture/écriture qu'aux personnes connectées via le mot de passe partagé (étape 3 bis ci-dessous) — sans connexion, tout accès est refusé.
6. Redéployez (`firebase deploy` ou re-glissez le dossier) : la synchronisation temps réel est active. Le bandeau d'avertissement orange disparaît automatiquement dans l'app.

## Étape 2 bis — Activer le mot de passe partagé (authentification)

1. Dans la console Firebase, allez dans **Build → Authentication** → **Get started**.
2. Onglet **Sign-in method** → activez le fournisseur **Email/Password** (juste "Email/Password", pas besoin du lien de connexion sans mot de passe).
3. Onglet **Users** → **Add user** :
   - Email : utilisez exactement la valeur de `SHARED_LOGIN_EMAIL` dans `firebase-config.js` (par défaut `direction@safety-first.app` — vous pouvez la changer, mais elle doit être identique aux deux endroits).
   - Mot de passe : choisissez le mot de passe que toute l'équipe de direction utilisera pour ouvrir l'app.
4. C'est tout : à l'ouverture, l'app demande ce mot de passe. Une fois connecté sur un appareil, la session reste active (pas besoin de se reconnecter à chaque ouverture) jusqu'à un clic sur "Déconnexion".

Pour changer le mot de passe plus tard : Firebase Console → Authentication → Users → menu ⋮ sur la ligne du compte → **Reset password**, ou supprimez/recréez l'utilisateur.

## Étape 3 — Installer l'app sur PC et smartphone

- **Sur PC (Chrome/Edge)** : ouvrez l'URL de l'app → icône d'installation dans la barre d'adresse → "Installer".
- **Sur Android** : ouvrez l'URL dans Chrome → menu ⋮ → "Ajouter à l'écran d'accueil".
- **Sur iPhone/iPad** : ouvrez l'URL dans Safari → bouton Partager → "Sur l'écran d'accueil".

L'application s'ouvre alors comme une app native, en plein écran, avec son
icône, et reste utilisable hors connexion pour la consultation (les
modifications se synchronisent dès le retour du réseau).

## Utilisation

- Sélecteur en haut : choix du site (Neau, Saint-Gaultier, Terrasson, Sauveterre) — chaque site a son propre tableau, indépendant des autres.
- Clic sur une case ou un voyant : fait tourner le statut gris → vert → rouge → gris.
- Double-clic sur une case (ou l'icône ✎) : ouvre un commentaire pour ce jour et ce critère.
- Flèches ‹ › : navigation mois par mois, l'historique est conservé indéfiniment.

## Évolutions possibles

- Authentification (mot de passe unique ou comptes nominatifs) pour restreindre l'accès en écriture.
- Export mensuel (PDF ou Excel) pour archivage ou affichage papier.
- Vue consolidée multi-sites pour la direction générale.

N'hésitez pas à revenir vers moi pour l'une de ces évolutions.
