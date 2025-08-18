var express = require('express');
var router = express.Router();
var CategoryModel = require('../models/CategoryModel');
var Feedback = require('../models/FeedbackModel');
const { admin } = require('../middleware/authorize');
var { formatTimeFeedback } = require('../utils/Utility');
//dung chung
var User = require('../models/UserModel');
require('dotenv').config();
const jwt = require('jsonwebtoken');

var feedback = async () => {
    var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    return messages;
}

/* GET home page. */
router.get('/', admin, async (req, res) => {
    var categories = await CategoryModel.find({});
    var category = { id: '', name: '' };
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/category', { title: 'View Categories', categories, category, message, user, feeds, formatTimeFeedback, path: 'category' });
});

router.post('/search',async (req, res) => {
    var search = req.body.search
    var categories = await CategoryModel.find({
        $or: [
            { name: new RegExp(search, "i") },
        ]
    });
    var category = { id: '', name: '' };
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/category', { title: 'View Categories', categories, category, message, user, feeds, formatTimeFeedback, path: 'category' });
});

// create category
router.post('/', async (req, res) => {
    var category = req.body;
    try {
        await CategoryModel.create(category);
        req.session.message = {
            type: 'success',
            content: 'Product added successfully'
        };
    } catch (error) {
        console.error('Error adding product: ', err);
        req.session.message = {
            type: 'danger',
            content: 'Failed to add product'
        };
    }
    res.redirect('category');
})

//update category
router.get('/edit/:id', admin, async (req, res) => {
    const id = req.params.id;
    var categories = await CategoryModel.find({});
    var category = await CategoryModel.findById(id);
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/category', { title: 'View Categories', categories, category, message, user, feeds, formatTimeFeedback, path: 'category' });
});

router.post('/edit/:id', async (req, res) => {
    const id = req.params.id;
    var category = req.body;
    try {
        await CategoryModel.findByIdAndUpdate(id, category);
        console.log('Update category succeed');
        // Đặt thông báo thành công
        req.session.message = {
            type: 'success',
            content: 'Update category succeed'
        };
    } catch (err) {
        console.log('Update failed. Error: ')
        // Đặt thông báo lỗi
        req.session.message = {
            type: 'danger',
            content: 'Update failed'
        };
    }
    res.redirect('/category');
})

//delete category
router.get('/delete/:id', admin, async (req, res) => {
    var id = req.params.id;
    try {
        await CategoryModel.findByIdAndDelete(id);
        console.log('Delete brand succeed !');
        req.session.message = {
            type: 'success',
            content: 'Product deleted successfully'
        };
    } catch (err) {
        console.log('Delete brand fail. Error: ' + err);
        req.session.message = {
            type: 'danger',
            content: 'Failed to delete product'
        };
    };
    res.redirect('/category');
})


module.exports = router;
