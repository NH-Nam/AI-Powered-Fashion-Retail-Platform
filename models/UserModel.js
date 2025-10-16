var mongoose = require('mongoose');

var UserSchema = mongoose.Schema({
    name: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        required: true,
        // unique: true
    },
    emailToken: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    usertype: {
        type: String,
        default: 'User'
    },
    phone: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    email_verified:
    {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        default: ''
    },
    // Trường created_at sẽ tự động được tạo khi tạo dữ liệu mới
    created_at: { type: Date, default: Date.now },
    // Trường updated_at sẽ tự động được cập nhật khi cập nhật dữ liệu
    updated_at: { type: Date, default: Date.now }
})


var UserModel = mongoose.model('users', UserSchema);

module.exports = UserModel;