const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var OrderSchema = new mongoose.Schema({
    // Public-facing randomized order code for users
    order_code: {
        type: String,
        default: function generateOrderCode() {
            const timePart = Date.now().toString(36).toUpperCase();
            const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
            return `ORD-${timePart}-${randomPart}`;
        }
    },
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    name: {
        type: String,
        required: true
    },
    email:{
        type:String,
        required:true,
    },
    phone:{
        type:String,
        required:true,
    },
    address:{
        type:String,
        required:true,
    },
    total_money: {
        type: Number,
        required:true
    },
    payment_status: {
        type: String,
        required:true
    },
    delivery_status: String,
    // Trường created_at sẽ tự động được tạo khi tạo dữ liệu mới
    created_at: { type: Date, default: Date.now },
    // Trường updated_at sẽ tự động được cập nhật khi cập nhật dữ liệu
    updated_at: { type: Date, default: Date.now }
});

//Export the model
module.exports = mongoose.model('orders', OrderSchema);