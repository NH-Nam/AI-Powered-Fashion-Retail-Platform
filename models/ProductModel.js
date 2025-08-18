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
    buy_price: {
        type: Number,
        default: 0
    },
    discount_price: {
        type: Number,
        default: 0
    },
    // Fashion-specific attributes for AI recognition
    size: {
        type: String,
        default: '',
        enum: ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size', 'Custom']
    },
    color: {
        type: String,
        default: '',
        enum: ['', 'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Orange', 'Brown', 'Gray', 'Navy', 'Beige', 'Cream', 'Multi-color', 'Other']
    },
    // Variant-level inventory like Shopee (multiple size-color-quantity combos)
    variants: [{
        size: {
            type: String,
            enum: ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size', 'Custom']
        },
        color: {
            type: String,
            enum: ['', 'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Orange', 'Brown', 'Gray', 'Navy', 'Beige', 'Cream', 'Multi-color', 'Other']
        },
        quantity: {
            type: Number,
            min: 0,
            default: 0
        }
    }],
    // Multiple materials with percentages
    materials: [{
        material: {
            type: String,
            enum: ['Cotton', 'Polyester', 'Wool', 'Silk', 'Linen', 'Denim', 'Leather', 'Suede', 'Synthetic', 'Blend', 'Other']
        },
        percentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 100
        }
    }],
    // Additional fashion attributes
    brand: {
        type: String,
        default: ''
    },
    style: {
        type: String,
        default: '',
        enum: ['Casual', 'Formal', 'Sport', 'Vintage', 'Modern', 'Classic', 'Trendy', 'Bohemian', 'Minimalist', 'Other']
    },
    // Multiple seasons
    seasons: [{
        type: String,
        enum: ['Spring', 'Summer', 'Fall', 'Winter', 'All Season']
    }],
    gender: {
        type: String,
        default: 'Unisex',
        enum: ['Men', 'Women', 'Unisex', 'Kids']
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