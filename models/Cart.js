// Cart is now embedded in User model, this file is kept for compatibility
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  // Cart data is embedded in User
});

module.exports = mongoose.model('Cart', cartSchema);
