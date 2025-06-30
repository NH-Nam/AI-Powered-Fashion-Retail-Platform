const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var feedbackSchema = new mongoose.Schema({
    fullname:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
    },
    phone:{
        type:Number,
        required:true,
    },
    subject_name:{
        type:String,
        required:true,
    },
    note:{
        type:String,
        required:true
    },
    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    status:{
        type: Number,
        default: 0
    },
     // Trường created_at sẽ tự động được tạo khi tạo dữ liệu mới
     created_at: { type: Date, default: Date.now },
     // Trường updated_at sẽ tự động được cập nhật khi cập nhật dữ liệu
     updated_at: { type: Date, default: Date.now }
});

//Export the model
module.exports = mongoose.model('feedbacks', feedbackSchema);