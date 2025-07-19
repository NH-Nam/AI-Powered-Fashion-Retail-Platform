var mongoose = require('mongoose');

var ProductSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categorys'
    },
    description: String,
    image: String,
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discount_price: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        default: ''
    },
    deleted:{
        type: Number,
        default: 0
    },
    // Trường created_at sẽ tự động được tạo khi tạo dữ liệu mới
    created_at: { type: Date, default: Date.now },
    // Trường updated_at sẽ tự động được cập nhật khi cập nhật dữ liệu
    updated_at: { type: Date, default: Date.now }
})


var ProductModel = mongoose.model('products', ProductSchema);

module.exports = ProductModel;