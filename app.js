require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const bcrypt = require('bcrypt');
const validator = require('validator');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const connectDB = require('./utils/database');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('./utils/email');

const Product = require('./models/Product');
const User = require('./models/User');

const app = express();

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ÉTAPE 1 — Helmet (Sécurité HTTP) - Configuration personnalisée pour les images
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"], // Permet les images externes
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// ÉTAPE 3 — Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

connectDB();

// Utiliser les variables d'environnement
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://john:john123@cluster0.o7hvg7s.mongodb.net/shop';
const SESSION_SECRET = process.env.SESSION_SECRET || 'a9f8s7d6f5g4h3j2k1l0qwertyuiopzxcvbnm';

// ÉTAPE 2 — Protection CSRF
const csrfProtection = csrf();

// Session configuration sécurisée
app.use(session({
  secret: process.env.SESSION_SECRET || 'a9f8s7d6f5g4h3j2k1l0qwertyuiopzxcvbnm',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Empêche l'accès JavaScript au cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS uniquement en production
    maxAge: 1000 * 60 * 60 // 1 heure
  }
}));

// ÉTAPE 2 — Protection CSRF (activée après les sessions)
app.use(csrfProtection);

// Middleware global pour CSRF token
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  next();
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// Test endpoint pour debug
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works', timestamp: new Date() });
});

// Home - redirect to login if not authenticated
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Dashboard - protected route
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const products = await Product.find().populate('userId');
    res.render('dashboard', { user, products, docTitle: 'Tableau de bord' });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', { docTitle: 'Connexion', errorMessage: null, successMessage: null });
});

// Login POST with validation
app.post('/login',
  [
    body('email')
      .isEmail()
      .withMessage('Email invalide')
      .normalizeEmail(),
    body('password')
      .trim()
      .notEmpty()
      .withMessage('Mot de passe requis')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('login', {
          docTitle: 'Connexion',
          errorMessage: errors.array()[0].msg,
          successMessage: null
        });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.render('login', {
          docTitle: 'Connexion',
          errorMessage: 'Email ou mot de passe incorrect',
          successMessage: null
        });
      }

      req.session.userId = user._id;
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      res.render('login', {
        docTitle: 'Connexion',
        errorMessage: 'Erreur serveur',
        successMessage: null
      });
    }
  });

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup', { docTitle: 'Inscription', errorMessage: null, oldInput: null });
});

// Signup POST with validation (DEBUG MODE - sans validation pour isoler le problème)
app.post('/signup', async (req, res) => {
  try {
    console.log('=== DEBUG INSCRIPTION ===');
    console.log('Body reçu:', req.body);

    const { email, password, confirmPassword } = req.body;

    // Vérification basique
    if (!email || !password) {
      console.log('Email ou password manquant');
      return res.render('signup', {
        docTitle: 'Inscription',
        errorMessage: 'Email et mot de passe requis',
        oldInput: { email, name: email?.split('@')[0] }
      });
    }

    if (password !== confirmPassword) {
      console.log('Mots de passe ne correspondent pas');
      return res.render('signup', {
        docTitle: 'Inscription',
        errorMessage: 'Les mots de passe ne correspondent pas',
        oldInput: { email, name: email?.split('@')[0] }
      });
    }

    console.log('Vérification utilisateur existant...');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('Utilisateur existe déjà');
      return res.render('signup', {
        docTitle: 'Inscription',
        errorMessage: 'Cet email est déjà utilisé',
        oldInput: { email, name: email?.split('@')[0] }
      });
    }

    console.log('Hashage du mot de passe...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('Mot de passe hashé');

    const user = new User({
      name: email.split('@')[0],
      email,
      password: hashedPassword,
      cart: { items: [] }
    });

    console.log('Sauvegarde utilisateur...');
    await user.save();
    console.log('Utilisateur sauvegardé:', user._id);

    console.log('Envoi email...');
    const emailResult = await sendWelcomeEmail(user.email, user.name);
    console.log('Résultat email:', emailResult);

    console.log('Configuration session...');
    req.session.userId = user._id;
    console.log('Session configurée, redirection...');

    res.redirect('/dashboard');
  } catch (err) {
    console.error('ERREUR DÉTAILLÉE:', err);
    console.error('Stack:', err.stack);
    res.render('signup', {
      docTitle: 'Inscription',
      errorMessage: `Erreur serveur: ${err.message}`,
      oldInput: {
        email: req.body?.email,
        name: req.body?.email?.split('@')[0]
      }
    });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
    }
    res.redirect('/login');
  });
});

// Mot de passe oublié - page
app.get('/reset', (req, res) => {
  res.render('reset', { docTitle: 'Mot de passe oublié' });
});

// Mot de passe oublié - traitement
app.post('/reset', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.redirect('/reset');
    }

    const token = crypto.randomBytes(32).toString('hex');

    user.resetToken = token;
    user.resetTokenExpiration = Date.now() + 3600000; // 1 heure
    await user.save();

    const resetLink = `http://localhost:3000/reset/${token}`;

    const emailResult = await sendPasswordResetEmail(user.email, token);
    if (!emailResult.success) {
      console.error('Erreur envoi email:', emailResult.error);
    }

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.redirect('/reset');
  }
});

// Page de nouveau mot de passe
app.get('/reset/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetTokenExpiration: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/login');
    }

    res.render('new-password', {
      userId: user._id.toString(),
      token: req.params.token,
      docTitle: 'Nouveau mot de passe'
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Enregistrer le nouveau mot de passe
app.post('/new-password', async (req, res) => {
  try {
    const { password, userId, token } = req.body;

    const user = await User.findOne({
      _id: userId,
      resetToken: token,
      resetTokenExpiration: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect('/login');
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;

    await user.save();
    res.render('login', {
      docTitle: 'Connexion',
      errorMessage: null,
      successMessage: 'Mot de passe réinitialisé avec succès !'
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Afficher le formulaire d'ajout de produit
app.get('/add-product', requireAuth, (req, res) => {
  res.render('add-product', { docTitle: 'Ajouter un Produit', errorMessage: null, oldInput: null });
});

// Traiter l'ajout de produit avec validation
app.post('/add-product', requireAuth,
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Titre requis')
      .isLength({ min: 3 })
      .withMessage('Titre minimum 3 caractères'),
    body('price')
      .isFloat({ gt: 0 })
      .withMessage('Prix invalide (doit être positif)'),
    body('description')
      .trim()
      .isLength({ min: 5 })
      .withMessage('Description minimum 5 caractères'),
    body('imageUrl')
      .trim()
      .isURL()
      .withMessage('URL d\'image invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('add-product', {
          docTitle: 'Ajouter un Produit',
          errorMessage: errors.array()[0].msg,
          oldInput: {
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            imageUrl: req.body.imageUrl
          }
        });
      }

      const userId = req.session.userId;
      const user = await User.findById(userId);

      const product = new Product({
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
        imageUrl: req.body.imageUrl,
        userId: user._id
      });
      await product.save();
      res.redirect('/dashboard');
    } catch (err) {
      console.log(err);
      res.render('add-product', {
        docTitle: 'Ajouter un Produit',
        errorMessage: 'Erreur serveur',
        oldInput: {
          title: req.body.title,
          price: req.body.price,
          description: req.body.description,
          imageUrl: req.body.imageUrl
        }
      });
    }
  });

// Afficher le formulaire d'édition de produit
app.get('/edit-product/:id', requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.redirect('/dashboard');
    }
    res.render('edit-product', { product, docTitle: 'Modifier un Produit' });
  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }
});

// Traiter la modification de produit
app.post('/edit-product/:id', requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, {
      title: req.body.title,
      price: req.body.price,
      description: req.body.description,
      imageUrl: req.body.imageUrl
    });
    res.redirect('/dashboard');
  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }
});

// Supprimer un produit
app.post('/delete-product/:id', requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/dashboard');
  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }
});

// Affichage des produits dans le navigateur
app.get('/view-produits', async (req, res) => {
  try {
    const products = await Product.find().populate('userId');
    let html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Liste des Produits</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .product { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
          img { max-width: 200px; }
        </style>
      </head>
      <body>
        <h1>Liste des Produits</h1>
        <a href="/">Retour à l'API</a>
        <div id="products">
    `;
    products.forEach(product => {
      html += `
        <div class="product">
          <h2>${product.title}</h2>
          <p>Prix: ${product.price} €</p>
          <p>Description: ${product.description}</p>
          <img src="${product.imageUrl}" alt="${product.title}">
          <p>Utilisateur: ${product.userId.name} (${product.userId.email})</p>
        </div>
      `;
    });
    html += `
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send('Erreur serveur');
  }
});

// Création produit
app.post('/produits', async (req, res) => {
  try {
    let user = await User.findOne({ email: 'john@example.com' });
    if (!user) {
      user = new User({ name: 'John', email: 'john@example.com', cart: { items: [] } });
      await user.save();
    }

    const product = new Product({ ...req.body, userId: user._id });
    await product.save();
    res.status(201).json({ message: 'Product created', product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Lire tous les produits
app.get('/produits', async (req, res) => {
  try {
    const products = await Product.find().populate('userId');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Supprimer produit
app.delete('/produits/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Modifier produit
app.put('/produits/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Product updated', product });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ÉTAPE 6 — Gestion d'erreurs production (masquer les détails sensibles)
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).render('500', {
    pageTitle: 'Erreur',
    path: '/500'
  });
});

app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server running on port ${process.env.PORT || 3000}`));
