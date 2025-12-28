// Cart items are now embedded in User.cart.items, this file is kept for compatibility
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  // Cart items are embedded in User
});

module.exports = mongoose.model('CartItem', cartItemSchema);
