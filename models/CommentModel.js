const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var commentSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
    },
    comment:{
        type:String,
        required:true,
    },
    user_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    product_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products',
    },
    // Trường created_at sẽ tự động được tạo khi tạo dữ liệu mới
    created_at: { type: Date, default: Date.now },
    // Trường updated_at sẽ tự động được cập nhật khi cập nhật dữ liệu
    updated_at: { type: Date, default: Date.now }
});

//Export the model
module.exports = mongoose.model('comments', commentSchema);