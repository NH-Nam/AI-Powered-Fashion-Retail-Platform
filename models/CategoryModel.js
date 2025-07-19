var mongoose = require('mongoose');

var CategorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    }
})


var CategoryModel = mongoose.model('categorys', CategorySchema);

module.exports = CategoryModel;