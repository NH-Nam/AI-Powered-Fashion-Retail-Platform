var express = require('express');
var router = express.Router();
var Order = require('../models/OrderModel');
var OrderDetail = require('../models/OrderDetailModel');
var Feedback = require('../models/FeedbackModel');
var Product = require('../models/ProductModel');

//dung chung
var User = require('../models/UserModel');
require('dotenv').config();
const jwt = require('jsonwebtoken');

//utils format time
var { formatDate, numberFormat, formatTimeFeedback } = require('../utils/Utility');

//middleware admin (Phân quyền)
const { admin } = require('../middleware/authorize');

var feedback = async () => {
    var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    return messages;
}

router.get('/', admin, async (req, res) => {
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);

    var orders = await Order.find({}).sort({ created_at: 'desc' })
    var feeds = await feedback();
    var totalOrder = 0;
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session

res.render('admin/order', { title: 'Manage Order', user, message, orders, feeds, formatTimeFeedback, totalOrder, path: 'order' })
})

//search
router.post('/search', admin, async (req, res) => {
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var search = req.body.search
    var orders = await Order.find({
        $or: [
            { email: search}
        ]
    });
    var totalOrder = 0;
    for (var order of orders) {
        var details = await OrderDetail.find({order_id: order._id})
        for(var detail of details) {
            totalOrder += detail.total_money;
        }
    }

    console.log(totalOrder);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session

    res.render('admin/order', { title: 'Manage Order', user, message, orders, feeds, formatTimeFeedback, totalOrder, numberFormat })
})

router.get('/detail/:id', admin, async (req, res) => {
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);

    var id = req.params.id;
    var order = await Order.findById({ _id: id })
    var details = await OrderDetail.find({ order_id: id }).populate('product_id')
    var feeds = await feedback();

    console.log(order)

    res.render('admin/order_detail', { title: 'Order Detail', user, order, details, formatDate, numberFormat, feeds, formatTimeFeedback })
})

router.get('/delivered/:id', admin, async (req, res) => {
    try {
        var id = req.params.id
        await Order.findByIdAndUpdate(id, { delivery_status: "Delivered", payment_status: "Paid" })
        req.session.message = {
            type: 'success',
            content: 'Order delivered successfully'
        };
        res.redirect('/order')
    } catch (error) {
        req.session.message = {
            type: 'danger',
            content: 'Order delivered failed'
        };
        res.redirect('/order')
    }
})

// Admin-only: cancel an order (keep details; mark delivery_status = 'Cancelled')
router.get('/cancel/:id', admin, async (req, res) => {
    try {
        const id = req.params.id;
        await Order.findByIdAndUpdate(id, { delivery_status: 'Cancelled' });
        // Restock products for this order
        const details = await OrderDetail.find({ order_id: id, deleted: 0 });
        for (const d of details) {
            try {
                await Product.findByIdAndUpdate(d.product_id, { $inc: { quantity: d.num } });
            } catch {}
        }
        req.session.message = {
            type: 'success',
            content: 'Order cancelled successfully'
        };
        res.redirect('/order');
    } catch (error) {
        req.session.message = {
            type: 'danger',
            content: 'Order cancellation failed'
        };
        res.redirect('/order');
    }
});

router.get('/delete/:id', admin, async (req, res) => {
    try {
        var id = req.params.id;
        await OrderDetail.deleteMany({ order_id: id });
        await Order.findByIdAndDelete(id)
        req.session.message = {
            type: 'success',
            content: 'Order deleted successfully'
        };
        res.redirect('/order')
    } catch (error) {
        req.session.message = {
            type: 'danger',
            content: 'Order deleted Failed'
        };
        res.redirect('/order')
    }
})

const puppeteer = require('puppeteer');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');

router.get('/print_pdf/:id', admin, async (req, res) => {
    try {
        const order = await Order.findById({ _id: req.params.id });
        const details = await OrderDetail.find({ order_id: req.params.id }).populate('product_id');

        const viewsDir = path.join(__dirname, '..', 'views');
        const html = await ejs.renderFile(path.join(viewsDir, 'admin', 'pdf.ejs'), { title: 'Order', order, details, numberFormat });

        const pdfFileName = `order_${req.params.id}.pdf`;
        const pdfPath = path.join(__dirname, '..', 'public', 'pdf', pdfFileName);

        // Cấu hình Puppeteer để tránh cảnh báo
        const browser = await puppeteer.launch({
            headless: 'new', // using the new headless mode as suggested by Puppeteer's warning message
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html);
        await page.pdf({ path: pdfPath, format: 'A4' });
        await browser.close();

        // Sử dụng header để gợi ý trình duyệt lưu vào thư mục download mặc định
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${pdfFileName}`);

        // Trả về file PDF cho người dùng để tải xuống
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
