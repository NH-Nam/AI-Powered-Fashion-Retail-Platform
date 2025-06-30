const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var favoriteSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products'
    }, 
    user_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    created_at: { type: Date, default: Date.now }
});

//Export the model
module.exports = mongoose.model('favorites', favoriteSchema);