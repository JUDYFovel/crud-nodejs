const path = require('path');
// Importer les modules requis
const express = require('express');

const rootDir = require('../utils/path');
const adminController = require('../controllers/admin');

// Créer une nouvelle instance de routeur Express pour gérer les routes admin
const router = express.Router();

// Définir la route GET pour la page add-product
router.get('/add-product', adminController.getAddProduct);

// Définir la route POST pour ajouter des produits
router.post('/add-product', adminController.postAddProduct);

// Définir la route GET pour éditer un produit
router.get('/edit-product/:productId', adminController.getEditProduct);

// Définir la route POST pour éditer un produit
router.post('/edit-product', adminController.postEditProduct);

// Définir la route POST pour supprimer un produit
router.post('/delete-product', adminController.postDeleteProduct);

// Exporter le routeur
module.exports = router;
