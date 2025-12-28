# Application Node.js Sécurisée avec Express et MongoDB

## Fonctionnalités de Sécurité Implémentées

### 🔒 Sécurité HTTP (Helmet)
- ✅ Protection contre XSS, clickjacking, MIME sniffing
- ✅ Headers de sécurité automatiques
- ✅ Configuration zero-touch

### 🛡️ Protection CSRF
- ✅ Tokens CSRF sur tous les formulaires
- ✅ Protection contre les attaques cross-site request forgery
- ✅ Middleware automatique pour Express

### ⏱️ Rate Limiting (Anti-spam)
- ✅ 100 requêtes max par IP / 15 minutes
- ✅ Protection contre les attaques par déni de service
- ✅ Messages d'erreur configurables

### 🍪 Sessions Sécurisées
- ✅ Cookies `httpOnly` (inaccessibles via JavaScript)
- ✅ Cookies `secure` en production (HTTPS uniquement)
- ✅ Expiration automatique (1 heure)
- ✅ Secret depuis variables d'environnement

### 🔐 Variables d'Environnement
- ✅ Fichier `.env` pour les secrets
- ✅ Configuration séparée dev/prod
- ✅ Secrets jamais versionnés (Git)

### 🚨 Gestion d'Erreurs Production
- ✅ Masquage des détails sensibles en production
- ✅ Page d'erreur 500 personnalisée
- ✅ Logging serveur maintenu

## Fonctionnalités Applicatives

- ✅ Authentification complète (inscription, connexion, sessions)
- ✅ Gestion des produits CRUD avec authentification
- ✅ Envoi d'emails (bienvenue et réinitialisation de mot de passe)
- ✅ Validation avancée des données avec express-validator
- ✅ Protection contre les injections XSS et données invalides
- ✅ Nettoyage automatique des inputs utilisateur
- ✅ Gestion d'erreurs complète et messages utilisateur

## Configuration des Emails

### Utilisation de Mailtrap (recommandé pour les tests)

1. Créez un compte sur [Mailtrap](https://mailtrap.io/)
2. Allez dans votre inbox et copiez les credentials SMTP
3. Modifiez `utils/email.js` :

```javascript
const transporter = nodemailer.createTransporter({
  host: 'smtp.mailtrap.io',
  port: 2525,
  auth: {
    user: 'votre-username-mailtrap', // Remplacez ici
    pass: 'votre-password-mailtrap'  // Remplacez ici
  }
});
```

### Utilisation de Gmail

Pour Gmail, modifiez la configuration :

```javascript
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'votre-email@gmail.com',
    pass: 'votre-mot-de-passe-app' // Utilisez un mot de passe d'application
  }
});
```

⚠️ **Important** : Activez l'authentification à 2 facteurs sur Gmail et générez un mot de passe d'application.

## Installation et Démarrage

```bash
npm install
npm start
```

L'application sera disponible sur `http://localhost:3000`

## Routes Disponibles

### Authentification
- `GET /login` - Page de connexion
- `POST /login` - Connexion
- `GET /signup` - Page d'inscription
- `POST /signup` - Inscription (envoi email de bienvenue)
- `GET /logout` - Déconnexion
- `GET /reset` - Mot de passe oublié
- `POST /reset` - Demande de réinitialisation (envoi email)
- `GET /reset/:token` - Page de nouveau mot de passe
- `POST /new-password` - Changement du mot de passe

### Produits (protégés)
- `GET /dashboard` - Tableau de bord avec produits
- `GET /add-product` - Formulaire d'ajout
- `POST /add-product` - Ajout de produit
- `GET /edit-product/:id` - Formulaire d'édition
- `POST /edit-product/:id` - Modification
- `POST /delete-product/:id` - Suppression

### API REST
- `GET /produits` - Liste des produits (JSON)
- `POST /produits` - Créer un produit
- `PUT /produits/:id` - Modifier un produit
- `DELETE /produits/:id` - Supprimer un produit

## Sécurité

- Mots de passe hashés avec bcrypt (12 rounds)
- Sessions stockées en mémoire (configurable pour production)
- Validation des emails avec validator
- Protection CSRF implicite avec sessions
- Middleware d'authentification pour les routes sensibles

## Tests

Utilisez Postman pour tester l'API :

1. **Inscription** : POST `/signup` avec email, password, confirmPassword
2. **Connexion** : POST `/login` avec email, password
3. **CRUD Produits** : Utilisez les routes `/add-product`, etc.

Les emails seront envoyés automatiquement lors de l'inscription et des demandes de réinitialisation.
