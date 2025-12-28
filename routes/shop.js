const path = require('path');
const express = require('express');

const rootDir = require('../utils/path');
const shopController = require('../controllers/shop');

const router = express.Router();

router.get('/', shopController.getShop);

router.get('/cart', shopController.getCart);

router.get('/orders', shopController.getOrders);

router.post('/add-to-cart', shopController.postAddToCart);

router.post('/delete-from-cart', shopController.postDeleteFromCart);

router.post('/place-order', shopController.postPlaceOrder);

module.exports = router;
