const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var CartSchema = new mongoose.Schema({
    price:{
        type:Number,
        required:true,
    },
    total_price:{
        type:Number,
        required:true,
    },
    quantity:{
        type:Number,
        required:true,
    },
    product_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products'
    },
    user_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
});

//Export the model
module.exports = mongoose.model('carts', CartSchema);