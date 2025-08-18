var express = require('express');
var router = express.Router();
var CategoryModel = require('../models/CategoryModel');
var Feedback = require('../models/FeedbackModel');
var Comment = require('../models/CommentModel');
var Reply = require('../models/ReplyModel');
var Favorite = require('../models/FavoriteModel');
const { admin } = require('../middleware/authorize');
const validator = require("validator");
//dung chung
//utils format time
var { formatDate, formatTimeFeedback } = require('../utils/Utility');
var User = require('../models/UserModel');
require('dotenv').config();
const jwt = require('jsonwebtoken');
//ma hoa passs
const bcrypt = require('bcrypt');
// const { findByIdAndDelete } = require('../models/CartModel');
const saltRounds = 10;

var feedback = async () => {
    var messages = await Feedback.find().populate('user_id').sort({ created_at: 'desc' }).limit(3);
    return messages;
}

/* GET home page. */
router.get('/', admin, async (req, res) => {
    var users = await User.find({}).sort({ created_at: 'desc' });
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/show_user', { title: 'Manage User', users, message, user, formatDate, feedback, feeds, formatTimeFeedback });
});

//search
router.post('/search', admin, async (req, res) => {
    var search = req.body.search;
    var users = await User.find({
        $or: [
            { name: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
        ]
    });
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/show_user', { title: 'Manage User', users, message, user, formatDate, feedback, feeds,formatTimeFeedback });
});

// create user
router.get('/add', admin, async (req, res) => {
    var item = { _id: '', name: '', google: '', image: '', usertype: '', phone: '', address: '', email: '', email_verified: '', password: '' };
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/ceup_user', { title: 'Add User', user, item, feeds, message,formatTimeFeedback });
})
router.post('/add', async (req, res) => {
    try {
        var user = await User.findOne({ email: req.body.email });
        if (!user) {
            if (req.body.password == req.body.password_confirm) {
                if (!validator.isEmail(req.body.email)) {
                    req.session.message = {
                        type: 'info',
                        content: 'email must be invalid'
                    };
                    return res.redirect('/user/add');
                }

                if ((!/^[a-zA-Z ]*$/.test(req.body.name))) {
                    req.session.message = {
                        type: 'info',
                        content: 'The name contains only letters and does not contain numbers!'
                    };
                    return res.redirect('/user/add');
                }
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{9,}$/;
                if (!passwordRegex.test(req.body.password)) {
                    req.session.message = {
                        type: 'info',
                        content: 'Password must have at least 9 characters, including numbers, upper and lower case letters and one special character.!'
                    };
                    return res.redirect('/user/add');
                }

                if (req.body.usertype != 'Admin' && req.body.usertype != 'User') {
                    req.session.message = {
                        type: 'info',
                        content: 'Please choose permission!'
                    };
                    return res.redirect('/user/add');
                }
                var data = req.body;
                const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
                data.password = hashedPassword;
                await User.create(data);
                req.session.message = {
                    type: 'success',
                    content: 'User added successfully'
                };
            } else {
                req.session.message = {
                    type: 'warning',
                    content: 'Confirm password wrong!'
                };
                return res.redirect('/user/add')
            }

        } else {
            req.session.message = {
                type: 'danger',
                content: 'Email already existed int the system!'
            };
            return res.redirect('/user/add')
        }
    } catch (error) {
        console.error(error);
        req.session.message = {
            type: 'danger',
            content: 'Failed to add user'
        };
    }
    res.redirect('/user');
})

// //update category
router.get('/edit/:id', admin, async (req, res) => {
    const id = req.params.id;
    var item = await User.findById(id);
    //token user
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    var user = await User.findById(decoded.userId);
    var feeds = await feedback();
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('admin/ceup_user', { title: 'Edit user', item, message, user, feeds, formatTimeFeedback });
});

router.post('/edit/:id', async (req, res) => {
    var decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const id = req.params.id;
    var data = req.body;
    const newUsertype = req.body.usertype;
    var user = await User.findById(id);
    try {
        if (data.password != '') {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{9,}$/;
            if (!passwordRegex.test(data.password)) {
                req.session.message = {
                    type: 'info',
                    content: 'Password must have at least 9 characters, including numbers, upper and lower case letters and one special character!'
                };
                return res.redirect('/user/edit/'+id);
            }
            const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
            data.password = hashedPassword;
        } else {
            data.password = user.password;
        }

        if (decoded.usertype != newUsertype && decoded.userId == user.id) {
            await User.findByIdAndUpdate(id, data);
            // Tạo lại token mới với usertype mới
            const user = await User.findById(id);
            const token = jwt.sign(
                { userId: user.id, usertype: newUsertype },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Gửi lại token mới dưới dạng cookie
            res.cookie('token', token, { httpOnly: true, sameSite: true });
            req.session.message = {
                type: 'success',
                content: 'Update user succeed. Usertype updated.'
            };
        } else {
            await User.findByIdAndUpdate(id, data);
            req.session.message = {
                type: 'success',
                content: 'Update user succeed'
            };
        }
        res.redirect('/user');
    } catch (error) {
        // console.error(error);
        req.session.message = {
            type: 'danger',
            content: 'Update user failed'
        };
    }
})

router.get('/delete/:id', admin, async (req, res) => {
    try {
        var id = req.params.id;
        var feedback = await Feedback.findOne({user_id: id})
        var comment = await Comment.findOne({user_id: id})
        var reply = await Reply.findOne({user_id: id})
        var favorite = await Favorite.findOne({user_id: id})
        if(!feedback && !comment && !reply && !favorite) {
            await User.findByIdAndDelete(id)
            req.session.message = {
                type: 'success',
                content: 'Delete user succeed'
            };
            res.redirect('/user')
        } else{
            req.session.message = {
                type: 'danger',
                content: 'You must delete the fields related to this user first: feedback, comment, reply, favorite product!'
            };
            res.redirect('/user')
        }
    } catch (error) {
        console.log(error)
        req.session.message = {
            type: 'danger',
            content: 'Delete user failed'
        };
        res.redirect('/user')
    }
})



module.exports = router;
