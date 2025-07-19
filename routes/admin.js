var express = require('express');
var router = express.Router();
var User = require('../models/UserModel');
var Feedback = require('../models/FeedbackModel');
var Product = require('../models/ProductModel');
var Order = require('../models/OrderModel');
//token
const jwt = require('jsonwebtoken');
require('dotenv').config();
//utils format time
var { formatDate, formatTimeFeedback } = require('../utils/Utility');

//middleware admin (Phân quyền)
const { admin } = require('../middleware/authorize');

var feedback = async () => {
    var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    return messages;
}

//trang chủ admin - chỉ amin mới vào được
router.get('/redirect', admin, async (req, res) => {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var users = await User.find({ usertype: 'User' });

    var feeds = await feedback();

    var products = await Product.find({ deleted: 0 });
    var discount_price = price = total_revenue = 0;
    products.forEach((product) => {
        discount_price += product.discount_price;
        price = parseFloat(((price + product.price) / 23000).toFixed(2));
    });
    var discount = parseFloat(((discount_price) / 23000).toFixed(2));
    var feedbacks = await Feedback.find({});
    var orders = await Order.find({})
    orders.forEach((order) => {
        total_revenue = parseFloat(((total_revenue + order.total_money) / 23000).toFixed(2));
    });

    const order_items = await Order.find()
        .populate('user_id')
        .sort({ created_at: 'desc' }).exec();

    res.render('admin/home', { title: 'Admin Home', user, feeds, products, discount, price, total_revenue, order_items, formatDate, feedbacks, orders, users, formatTimeFeedback });
})

router.post('/redirect/search', (req, res) => {
    res.redirect('/redirect')
})

module.exports = router;
