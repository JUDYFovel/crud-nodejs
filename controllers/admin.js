// Importer les modules requis
const path = require('path');
// Rôle: Importe le module 'path' pour manipuler les chemins de fichiers.
const rootDir = require('../utils/path');
// Rôle: Importe le module rootDir pour obtenir le répertoire racine.
const Product = require('../models/Product');
// Rôle: Importe le modèle Product pour les opérations CRUD sur les produits.
const User = require('../models/User');
// Rôle: Importe le modèle User pour accéder aux utilisateurs, notamment l'utilisateur dummy.

// Contrôleur pour la route GET add-product
const getAddProduct = (req, res, next) => {
    // Rendre le template pour ajouter des produits
    res.render('admin/add-product', { docTitle: 'Add Product' });
};

// Contrôleur pour la route POST add-product
const postAddProduct = async (req, res, next) => {
    // Rôle: Fonction contrôleur pour traiter l'ajout d'un produit via POST.
    try {
        // Trouver l'utilisateur dummy
        const user = await User.findOne({ email: 'dummy@example.com' });
        // Rôle: Recherche l'utilisateur dummy dans la base de données par email.
        if (!user) {
            // Rôle: Vérifie si l'utilisateur dummy existe.
            throw new Error('Dummy user not found');
            // Rôle: Lance une erreur si l'utilisateur dummy n'est pas trouvé.
        }
        // Créer le produit avec userId
        const product = new Product({
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            imageUrl: req.body.imageUrl,
            userId: user._id
        });
        await product.save();
        // Rediriger vers la page d'accueil après ajout
        res.redirect('/');
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
};

// Contrôleur pour la route GET edit-product
const getEditProduct = async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect('/');
        }
        res.render('admin/edit-product', {
            docTitle: 'Edit Product',
            product: product
        });
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
};

// Contrôleur pour la route POST edit-product
const postEditProduct = async (req, res, next) => {
    try {
        const productId = req.body.productId;
        await Product.findByIdAndUpdate(productId, {
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            imageUrl: req.body.imageUrl
        });
        res.redirect('/');
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
};

// Contrôleur pour la route POST delete-product
const postDeleteProduct = async (req, res, next) => {
    try {
        const productId = req.body.productId;
        await Product.findByIdAndDelete(productId);
        res.redirect('/');
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
};

// Exporter les contrôleurs
exports.getAddProduct = getAddProduct;
exports.postAddProduct = postAddProduct;
exports.getEditProduct = getEditProduct;
exports.postEditProduct = postEditProduct;
exports.postDeleteProduct = postDeleteProduct;
