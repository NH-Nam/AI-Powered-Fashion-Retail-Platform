const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var OrderDetailSchema = new mongoose.Schema({
    order_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'orders'
    },
    product_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products'
    },
    price:{
        type:Number,
        required:true,
    },
    num:{
        type:Number,
        required:true
    },
    total_money:{
        type:Number,
        required:true
    },
    deleted: {
        type: Number,
        default: 0
    },
    // Trường created_at sẽ tự động được tạo khi tạo dữ liệu mới
    created_at: { type: Date, default: Date.now },
    // Trường updated_at sẽ tự động được cập nhật khi cập nhật dữ liệu
    updated_at: { type: Date, default: Date.now }
});

//Export the model
module.exports = mongoose.model('order_details', OrderDetailSchema);