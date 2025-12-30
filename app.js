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

// Initialisation Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Payment Service Class
class PaymentService {
  static async createCheckoutSession(reservation, successUrl, cancelUrl) {
    try {
      console.log('DEBUG: PaymentService.createCheckoutSession called');
      console.log('DEBUG: Reservation email:', reservation.email);
      console.log('DEBUG: Cart items count:', reservation.cart.items.length);

      const lineItems = reservation.cart.items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.productId.title,
            description: item.productId.description,
            images: [item.productId.imageUrl]
          },
          unit_amount: Math.round(item.productId.price * 100)
        },
        quantity: item.quantity
      }));

      console.log('DEBUG: Line items:', JSON.stringify(lineItems, null, 2));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        ui_mode: 'embedded',
        return_url: successUrl,
        metadata: {
          userId: reservation._id.toString(),
          orderId: `order_${Date.now()}`
        },
        customer_email: reservation.email
      });

      console.log('DEBUG: Stripe session created successfully:', session.id);
      return session;
    } catch (error) {
      console.error('Erreur création session Stripe:', error);
      console.error('DEBUG: Stripe error details:', error.raw || error);
      throw new Error('Impossible de créer la session de paiement');
    }
  }

  static async getCheckoutSession(sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return { session };
    } catch (error) {
      console.error('Erreur récupération session:', error);
      throw new Error('Session introuvable');
    }
  }

  static async handleStripeEvent(event) {
    const { type, data } = event;

    console.log(`📥 Événement Stripe reçu: ${type}`);

    try {
      switch (type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(data.object);
          break;
        case 'payment_intent.succeeded':
          console.log('✅ Paiement réussi:', data.object.id);
          break;
        case 'payment_intent.payment_failed':
          console.log('❌ Paiement échoué:', data.object.id);
          break;
        default:
          console.log(`ℹ️ Événement non géré: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Erreur traitement événement ${type}:`, error);
      throw error;
    }
  }

  static async handleCheckoutCompleted(session) {
    const { userId } = session.metadata;

    try {
      const User = require('./models/User');
      const user = await User.findById(userId);

      if (!user) {
        console.error(`Utilisateur ${userId} introuvable`);
        return;
      }

      // Vider le panier après paiement réussi
      user.cart.items = [];
      await user.save();

      console.log(`✅ Paiement confirmé pour ${user.email}, panier vidé`);

    } catch (error) {
      console.error(`Erreur confirmation paiement ${userId}:`, error);
      throw error;
    }
  }
}

const Product = require('./models/Product');
const User = require('./models/User');

const app = express();

// IMPORTANT : Faire confiance aux proxies (Railway/Heroku utilise des load balancers)
app.set('trust proxy', 1);

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================================================
// WEBHOOK STRIPE - DOIT ÊTRE AVANT bodyParser.json() !!!
// ============================================================================
app.post('/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET non configuré');
      return res.status(400).send('Webhook secret not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`✅ Webhook Stripe vérifié: ${event.type}`);
    } catch (err) {
      console.error('❌ Erreur webhook:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Traiter l'événement de manière asynchrone
    PaymentService.handleStripeEvent(event)
      .then(() => res.json({ received: true }))
      .catch(err => {
        console.error('Erreur traitement webhook:', err);
        res.status(500).json({ error: 'Erreur traitement webhook' });
      });
  }
);

// ============================================================================
// BODY PARSERS - APRÈS le webhook Stripe
// ============================================================================
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// HELMET - Sécurité HTTP avec configuration Stripe
// ============================================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],  // ✅ Ajout 'unsafe-inline'
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
}));

// ============================================================================
// RATE LIMITING
// ============================================================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ============================================================================
// CONNEXION DATABASE
// ============================================================================
connectDB();

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'a9f8s7d6f5g4h3j2k1l0qwertyuiopzxcvbnm',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// ============================================================================
// CSRF PROTECTION - Exclure les routes Stripe
// ============================================================================
const csrfProtection = csrf();

app.use((req, res, next) => {
  const csrfExcludedPaths = ['/create-checkout-session', '/webhook', '/test-checkout', '/session-status'];
  
  if (csrfExcludedPaths.includes(req.path)) {
    return next();
  }
  
  return csrfProtection(req, res, (err) => {
    if (err) return next(err);
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
    next();
  });
});

// ============================================================================
// MIDDLEWARE AUTH
// ============================================================================
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// ============================================================================
// ROUTES DE TEST
// ============================================================================
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test endpoint works', 
    timestamp: new Date(),
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
  });
});

app.get('/create-test-user', async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: 'test@example.com' });
    if (existingUser) {
      return res.json({ message: 'Test user already exists', user: existingUser });
    }

    const hashedPassword = await bcrypt.hash('test123', 12);
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      cart: { items: [] }
    });

    await user.save();
    res.json({ message: 'Test user created', user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/test-login', async (req, res) => {
  try {
    const user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      return res.status(404).json({ error: 'Test user not found' });
    }

    req.session.userId = user._id;
    res.json({ message: 'Logged in as test user', user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/test-add-to-cart/:productId', requireAuth, async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const user = await User.findById(req.session.userId);
    if (!user.cart) {
      user.cart = { items: [] };
    }

    const cartItemIndex = user.cart.items.findIndex(item => item.productId.toString() === productId);
    if (cartItemIndex >= 0) {
      user.cart.items[cartItemIndex].quantity += 1;
    } else {
      user.cart.items.push({ productId: productId, quantity: 1 });
    }

    await user.save();
    res.json({ message: 'Product added to cart', cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ROUTES STRIPE CHECKOUT
// ============================================================================

// Créer une session Stripe Checkout
app.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    console.log('🔄 Création session Stripe pour user:', req.session.userId);
    const user = await User.findById(req.session.userId).populate('cart.items.productId');

    if (!user) {
      console.log('❌ User not found');
      return res.redirect('/dashboard');
    }

    if (!user.cart.items.length) {
      console.log('❌ Cart is empty');
      return res.redirect('/dashboard');
    }

    console.log('✅ Cart items:', user.cart.items.length);

    // Filter out invalid cart items
    const validItems = user.cart.items.filter(item => item.productId && item.productId.title);
    user.cart.items = validItems;
    await user.save();

    if (validItems.length === 0) {
      console.log('❌ No valid items in cart');
      return res.redirect('/dashboard');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const successUrl = `${protocol}://${host}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${protocol}://${host}/cancel`;

    // Créer la session avec le service
    const session = await PaymentService.createCheckoutSession(user, successUrl, cancelUrl);

    console.log('✅ Session Stripe créée:', session.id);
    
    res.render('checkout', {
      clientSecret: session.client_secret,
      docTitle: 'Paiement',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    console.error('❌ Erreur Stripe:', err.message);
    res.redirect('/dashboard');
  }
});

// Vérifier le statut de la session (appelé après paiement)
app.get('/session-status', requireAuth, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    const sessionData = await PaymentService.getCheckoutSession(sessionId);
    
    res.json({
      status: sessionData.session.status,
      customer_email: sessionData.session.customer_details?.email
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Page de succès de paiement
app.get('/success', requireAuth, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    
    if (!sessionId) {
      return res.redirect('/dashboard');
    }

    const sessionData = await PaymentService.getCheckoutSession(sessionId);
    const session = sessionData.session;

    // Le panier est vidé automatiquement via webhook
    const user = await User.findById(req.session.userId);
    if (user && user.cart.items.length > 0) {
      user.cart.items = [];
      await user.save();
    }

    res.render('success', { docTitle: 'Paiement réussi', session });
  } catch (err) {
    console.error('Erreur récupération session Stripe:', err);
    res.redirect('/dashboard');
  }
});

// Page d'annulation de paiement
app.get('/cancel', requireAuth, (req, res) => {
  res.render('cancel', { docTitle: 'Paiement annulé' });
});

// ============================================================================
// ROUTES PRINCIPALES
// ============================================================================

app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate('cart.items.productId');
    const products = await Product.find().populate('userId');

    // Clean invalid cart items
    if (user.cart && user.cart.items) {
      const validItems = user.cart.items.filter(item => 
        item.productId && item.productId.title && typeof item.productId.price === 'number'
      );
      
      if (validItems.length !== user.cart.items.length) {
        user.cart.items = validItems;
        await user.save();
      }
    }

    if (!user.cart) {
      user.cart = { items: [] };
      await user.save();
    }

    res.render('dashboard', { user, products, docTitle: 'Tableau de bord' });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

app.post('/add-to-cart', requireAuth, async (req, res) => {
  try {
    const productId = req.body.productId;

    if (!productId) {
      console.log('❌ No productId provided');
      return res.redirect('/dashboard');
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      console.log('❌ User not found');
      return res.redirect('/login');
    }

    const product = await Product.findById(productId);
    if (!product || !product.title || !product.price) {
      console.log('❌ Product not found or invalid:', productId);
      return res.redirect('/dashboard');
    }

    if (!user.cart) {
      user.cart = { items: [] };
    }

    const cartItemIndex = user.cart.items.findIndex(item => 
      item.productId && item.productId.toString() === productId
    );

    if (cartItemIndex >= 0) {
      user.cart.items[cartItemIndex].quantity += 1;
    } else {
      user.cart.items.push({ productId: productId, quantity: 1 });
    }

    await user.save();
    console.log('✅ Product added to cart:', product.title);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('❌ Error adding to cart:', err);
    res.redirect('/dashboard');
  }
});

// ============================================================================
// ROUTES AUTH
// ============================================================================

app.get('/login', (req, res) => {
  res.render('login', { docTitle: 'Connexion', errorMessage: null, successMessage: null });
});

app.post('/login',
  [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password').trim().notEmpty().withMessage('Mot de passe requis')
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
  }
);

app.get('/signup', (req, res) => {
  res.render('signup', { docTitle: 'Inscription', errorMessage: null, oldInput: null });
});

app.post('/signup', async (req, res) => {
  try {
    console.log('=== DEBUG INSCRIPTION ===');
    const { email, password, confirmPassword } = req.body;

    if (!email || !password) {
      return res.render('signup', {
        docTitle: 'Inscription',
        errorMessage: 'Email et mot de passe requis',
        oldInput: { email, name: email?.split('@')[0] }
      });
    }

    if (password !== confirmPassword) {
      return res.render('signup', {
        docTitle: 'Inscription',
        errorMessage: 'Les mots de passe ne correspondent pas',
        oldInput: { email, name: email?.split('@')[0] }
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup', {
        docTitle: 'Inscription',
        errorMessage: 'Cet email est déjà utilisé',
        oldInput: { email, name: email?.split('@')[0] }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      name: email.split('@')[0],
      email,
      password: hashedPassword,
      cart: { items: [] }
    });

    await user.save();
    console.log('✅ Utilisateur créé:', user._id);

    await sendWelcomeEmail(user.email, user.name);

    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('ERREUR INSCRIPTION:', err);
    res.render('signup', {
      docTitle: 'Inscription',
      errorMessage: `Erreur serveur: ${err.message}`,
      oldInput: { email: req.body?.email, name: req.body?.email?.split('@')[0] }
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/login');
  });
});

// ============================================================================
// RESET PASSWORD
// ============================================================================

app.get('/reset', (req, res) => {
  res.render('reset', { docTitle: 'Mot de passe oublié' });
});

app.post('/reset', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.redirect('/reset');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiration = Date.now() + 3600000;
    await user.save();

    await sendPasswordResetEmail(user.email, token);
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.redirect('/reset');
  }
});

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

// ============================================================================
// ROUTES PRODUITS
// ============================================================================

app.get('/add-product', requireAuth, (req, res) => {
  res.render('add-product', { docTitle: 'Ajouter un Produit', errorMessage: null, oldInput: null });
});

app.post('/add-product', requireAuth,
  [
    body('title').trim().notEmpty().withMessage('Titre requis').isLength({ min: 3 }).withMessage('Titre minimum 3 caractères'),
    body('price').isFloat({ gt: 0 }).withMessage('Prix invalide (doit être positif)'),
    body('description').trim().isLength({ min: 5 }).withMessage('Description minimum 5 caractères'),
    body('imageUrl').trim().isURL().withMessage('URL d\'image invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('add-product', {
          docTitle: 'Ajouter un Produit',
          errorMessage: errors.array()[0].msg,
          oldInput: req.body
        });
      }

      const user = await User.findById(req.session.userId);
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
        oldInput: req.body
      });
    }
  }
);

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

app.post('/delete-product/:id', requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/dashboard');
  } catch (err) {
    console.log(err);
    res.redirect('/dashboard');
  }
});

// ============================================================================
// ROUTES API PRODUITS
// ============================================================================

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
    html += `</div></body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send('Erreur serveur');
  }
});

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

app.get('/produits', async (req, res) => {
  try {
    const products = await Product.find().populate('userId');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.delete('/produits/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.put('/produits/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Product updated', product });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ============================================================================
// DEBUG ROUTES
// ============================================================================

app.get('/debug/cart', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate('cart.items.productId');
    return res.json({ cart: user.cart });
  } catch (err) {
    console.error('DEBUG /debug/cart error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/debug/cart/public/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email }).populate('cart.items.productId');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ email: user.email, cart: user.cart });
  } catch (err) {
    console.error('DEBUG PUBLIC /debug/cart/public error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).render('500', {
    docTitle: 'Erreur Serveur'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Serveur démarré avec succès');
  console.log('='.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔐 Stripe Secret Key: ${process.env.STRIPE_SECRET_KEY ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`🔑 Stripe Publishable Key: ${process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`🪝 Webhook Secret: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Configuré' : '⚠️ Non configuré (webhooks désactivés)'}`);
  console.log(`💾 MongoDB: ${process.env.MONGODB_URI ? '✅ Connecté' : '❌ Non configuré'}`);
  console.log('='.repeat(60));
});