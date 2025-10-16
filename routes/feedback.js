var express = require('express');
var router = express.Router();
var User = require('../models/UserModel');
var Feedback = require('../models/FeedbackModel');
//token
const jwt = require('jsonwebtoken');
require('dotenv').config();

//utils format time
var { formatDate, formatTimeFeedback } = require('../utils/Utility');
var { sendInformationEmail } = require('../utils/Email');
//middleware admin (Phân quyền)
const { admin } = require('../middleware/authorize');

var feedback = async () => {
    var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    return messages;
}

//trang của admin - chỉ amin mới vào được
router.get('/', admin, async (req, res) => {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feedbacks = await Feedback.find().sort({ created_at: 'desc' });
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/feedback', { title: 'Manage Feedbacks', user, feedbacks, formatDate, message, feeds, formatTimeFeedback, path: 'feedback' })
})

router.post('/search', admin, async (req, res) => {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var search = req.body.search
    var feedbacks = await Feedback.find({
        $or: [
            { fullname: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
        ]
    });
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/feedback', { title: 'Manage Feedbacks', user, feedbacks, formatDate, message, feeds, formatTimeFeedback, path: 'feedback' })
})

router.get('/markRead/:id', admin, async (req, res) => {
    var id = req.params.id;
    try {
        await Feedback.findByIdAndUpdate(id, { status: 1 })
        req.session.message = {
            type: 'success',
            content: 'Feedback marked successfully'
        };
        res.redirect('/feedback');
    } catch (error) {
        console.error(error);
        req.session.message = {
            type: 'danger',
            content: 'Marked Failed'
        };
        res.redirect('/feedback')
    }
})

router.get('/send_email/:id', admin, async (req, res) => {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feedback = await Feedback.findById(req.params.id);
    // var feeds = await feedback();
    var feeds = await Feedback.find().populate('user_id').limit(3);
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/email_info', { title: 'Manage Feedbacks', user, feedback, message, feeds, formatTimeFeedback })
})


//gui mail
router.post('/send_user_email/:id', admin, async (req, res) => {
    try {
        var feedback = await Feedback.findById(req.params.id);
        const detail = {
            greeting: req.body.greeting,
            firstline: req.body.firstline,
            body: req.body.body,
            lastline: req.body.lastline,
            url: req.body.url,
        };
        content = 'Email Feedback'
        sendInformationEmail(feedback.email, detail, content);
        req.session.message = {
            type: 'success',
            content: 'Feedback for user successfully'
        };
        res.redirect('/feedback');
    } catch (error) {
        req.session.message = {
            type: 'danger',
            content: 'Feedback for user Failed'
        };
        res.redirect('/feedback');
    }
})

//delete
router.get('/delete/:id', admin, async (req, res) => {
    var id = req.params.id;
    try {
        var feedback = await Feedback.findById(id);
        if(feedback.status != 1){
            req.session.message = {
                type: 'warning',
                content: 'Please mark it as read and then delete it!'
            };
            return res.redirect('/feedback');
        }
        await Feedback.findByIdAndDelete(id)
        req.session.message = {
            type: 'success',
            content: 'Feedback deleted successfully'
        };
        res.redirect('/feedback');
    } catch (error) {
        console.error(error);
        req.session.message = {
            type: 'danger',
            content: 'Delete Failed'
        };
        res.redirect('/feedback')
    }
})

module.exports = router;
