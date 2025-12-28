const path = require('path');
const rootDir = require('../utils/path');
const Product = require('../models/Product');
const User = require('../models/User');
// const OrderItem = require('../models/OrderItem');

const getShop = async (req, res, next) => {
    try {
        const products = await Product.find().populate('userId');
        console.log('Products in shop:', products);
        const user = await User.findOne({ email: 'dummy@example.com' });
        let cartItems = [];
        if (user && user.cart && user.cart.items) {
            cartItems = await Promise.all(user.cart.items.map(async (item) => {
                const product = await Product.findById(item.productId);
                return { product, quantity: item.quantity };
            }));
        }
        res.render('shop', { prods: products, carts: cartItems, docTitle: 'Shop' });
    } catch (err) {
        console.log(err);
        res.render('shop', { prods: [], carts: [], docTitle: 'Shop' });
    }
};

const getCart = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: 'dummy@example.com' });
        let cartItems = [];
        if (user && user.cart && user.cart.items) {
            cartItems = await Promise.all(user.cart.items.map(async (item) => {
                const product = await Product.findById(item.productId);
                return { product, quantity: item.quantity };
            }));
        }
        res.render('shop', { prods: [], carts: cartItems, docTitle: 'Cart' });
    } catch (err) {
        console.log(err);
        res.render('shop', { prods: [], carts: [], docTitle: 'Cart' });
    }
};

const postDeleteFromCart = async (req, res, next) => {
    try {
        const productId = req.body.productId;
        const user = await User.findOne({ email: 'dummy@example.com' });
        if (!user || !user.cart) {
            return res.redirect('/cart');
        }
        user.cart.items = user.cart.items.filter(item => item.productId.toString() !== productId);
        await user.save();
        res.redirect('/cart');
    } catch (err) {
        console.log(err);
        res.redirect('/cart');
    }
};

const getOrders = async (req, res, next) => {
    try {
        // Orders not implemented yet
        res.render('shop', { prods: [], carts: [], orders: [], docTitle: 'Orders' });
    } catch (err) {
        console.log(err);
        res.render('shop', { prods: [], carts: [], orders: [], docTitle: 'Orders' });
    }
};

const postPlaceOrder = async (req, res, next) => {
    try {
        // Orders not implemented yet
        res.redirect('/orders');
    } catch (err) {
        console.log(err);
        res.redirect('/cart');
    }
};

const postAddToCart = async (req, res, next) => {
    try {
        const productId = req.body.productId;
        const user = await User.findOne({ email: 'dummy@example.com' });
        if (!user) {
            throw new Error('Dummy user not found');
        }
        const product = await Product.findById(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        if (!user.cart) {
            user.cart = { items: [] };
        }
        const cartItemIndex = user.cart.items.findIndex(item => item.productId.toString() === productId);
        if (cartItemIndex >= 0) {
            // Increment quantity
            user.cart.items[cartItemIndex].quantity += 1;
        } else {
            // Add new item
            user.cart.items.push({ productId: productId, quantity: 1 });
        }
        await user.save();
        res.redirect('/cart');
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
};

module.exports = {
    getShop,
    getCart,
    getOrders,
    postAddToCart,
    postDeleteFromCart,
    postPlaceOrder
};
