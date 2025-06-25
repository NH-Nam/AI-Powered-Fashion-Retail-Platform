var express = require('express');
var router = express.Router();
const User = require('../models/UserModel');
const validator = require("validator");
const crypto = require('crypto');

//env variables
require('dotenv').config()
const { checkNotAuthenticated } = require('../middleware/authorize');

var { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/Email');

//token
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Đây là số vòng để tạo ra salt, thường được chọn từ 10-12

//router register
router.get('/register', checkNotAuthenticated, (req, res) => {
    //session alert
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('auth/register', { title: 'Register', message });
})

//router register
router.post('/register', async (req, res) => {
    try {
        var user = await User.findOne({ email: req.body.email });
        if (!user) {
            if (req.body.password == req.body.password_confirmation) {
                if (!validator.isEmail(req.body.email)) {
                    req.session.message = {
                        type: 'info',
                        content: 'email must be invalid'
                    };
                    return res.redirect('/register');
                }

                if ((!/^[a-zA-Z ]*$/.test(req.body.name))) {
                    req.session.message = {
                        type: 'info',
                        content: 'The name contains only letters and does not contain numbers!'
                    };
                    return res.redirect('/register');
                }
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{9,}$/;
                if (!passwordRegex.test(req.body.password)) {
                    req.session.message = {
                        type: 'info',
                        content: 'Password must have at least 9 characters, including numbers, upper and lower case letters and one special character.!'
                    };
                    return res.redirect('/register');
                }

                const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
                let newUser = req.body;
                newUser.password = hashedPassword;
                newUser.email_verified = false;
                const verificationToken = generateVerificationToken();
                newUser.emailToken = verificationToken;
                await User.create(newUser);

                await sendVerificationEmail(newUser.email, verificationToken);
                res.redirect('/verify-email');
            } else {
                req.session.message = {
                    type: 'warning',
                    content: 'Confirm password wrong!'
                };
                res.redirect('/register');
            }
        } else {
            req.session.message = {
                type: 'danger',
                content: 'Email already exists'
            };
            res.redirect('/register');
        }
    } catch (error) {
        res.status(400).send(error);
    }
});

// Route to verify user email
router.get('/verify', async (req, res) => {
    try {
        const verificationToken = req.query.token;
        const user = await User.findOne({ emailToken: verificationToken });

        if (!user) {
            return res.status(400).send('Invalid or expired token');
        }

        const updatedUser = await User.findByIdAndUpdate(user._id, { email_verified: true }, { new: true });
        console.log('User updated: ', updatedUser);

        req.session.message = {
            type: 'success',
            content: 'The account has been successfully authenticated. You can log in now!'
        };

        res.redirect('/login');
    } catch (error) {
        console.error('Error during verification: ', error);
        res.status(500).send("Error processing request.");
    }
});

function generateVerificationToken() {
    return crypto.randomBytes(20).toString('hex');
}

router.get('/verify-email', checkNotAuthenticated, (req, res) => {
    res.render('auth/verify-email', { title: 'Verification' })
})

router.get('/login', checkNotAuthenticated, (req, res) => {
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('auth/login', { title: 'Login', message });
})

router.post('/login', async (req, res) => {
    // Tìm người dùng dựa trên email hoặc username
    const user = await User.findOne({ email: req.body.email });
    if (user) {
        // So sánh mật khẩu đã nhập với mật khẩu đã mã hóa
        const match = await bcrypt.compare(req.body.password, user.password);
        if (match) {
            if (user.email_verified === true) {
                // Nếu email đã được xác minh
                const token = jwt.sign(
                    { userId: user._id, usertype: user.usertype },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                res.cookie('token', token, { httpOnly: true, sameSite: true });
                res.redirect('/redirect');
            } else {
                // Nếu email chưa được xác minh
                const verificationToken = generateVerificationToken();
                user.emailToken = verificationToken;
                await user.save();

                await sendVerificationEmail(user.email, verificationToken);
                res.redirect('/verify-email');
            }
        } else {
            req.session.message = {
                type: 'danger',
                content: 'Username or password is wrong!'
            };
            res.redirect('/login');
        }
    } else {
        req.session.message = {
            type: 'danger',
            content: 'Email is not exist!'
        };
        res.redirect('/login');
    }
})

router.get('/logout', (req, res) => {
    // Xóa cookie chứa JWT
    res.clearCookie('token');
    // Gửi phản hồi thông báo người dùng đã đăng xuất
    res.redirect('/');
});

router.get('/forgot-password', checkNotAuthenticated, (req, res) => {
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Xóa thông báo khỏi session
    res.render('auth/forgot-password', { title: 'Forgot Password', message });
})

router.post('/forgot-password', async (req, res) => {
    var email = req.body.email;
    var user = await User.findOne({ email: email });
    if (user) {
        if (!validator.isEmail(req.body.email)) {
            req.session.message = {
                type: 'info',
                content: 'email must be invalid'
            };
            return res.redirect('/register');
        }
        const verificationToken = generateVerificationToken();
        await User.findByIdAndUpdate(user.id, { emailToken: verificationToken })
        // Send the password reset email
        sendPasswordResetEmail(email, verificationToken);
        req.session.message = {
            type: 'success',
            content: 'Your request has been sent successfully, please access your email to reset your password!'
        };
        res.redirect('/forgot-password');
    } else {
        req.session.message = {
            type: 'danger',
            content: 'Can not find many emails in the system!'
        };
        res.redirect('/forgot-password');
    }
})

router.get('/reset/token=:id', async (req, res) => {
    try {
        var emailToken = req.params.id;
        user = await User.findOne({ emailToken: emailToken });
        if (user) {
            const message = req.session ? req.session.message : null;
            delete req.session.message; // Xóa thông báo khỏi session
            res.render('auth/reset-password', { title: 'Reset Password', user, message })
        } else {
            req.session.message = {
                type: 'danger',
                content: 'Invalid token. Your token was not found. Please check your most recent email!'
            };
            res.redirect('/login');
        }
    } catch (error) {

    }
})

router.post('/reset/token=:id', async (req, res) => {
    try {
        var email = req.body.email;
        var token = req.params.id;
        user = await User.findOne({ email: email });
        if (req.body.password == req.body.password_confirmation) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{9,}$/;
            if (!passwordRegex.test(req.body.password)) {
                req.session.message = {
                    type: 'info',
                    content: 'Password must have at least 9 characters, including numbers, upper and lower case letters and one special character.!'
                };
                return res.redirect('/reset/token='+req.params.id);
            }

            const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
            await User.findByIdAndUpdate(user.id, { password: hashedPassword })
            req.session.message = {
                type: 'success',
                content: 'You have successfully reset your password! You can login now!'
            };
            res.redirect('/login');
        } else {
            req.session.message = {
                type: 'warning',
                content: 'Confirm password wrong!'
            };
            res.redirect('/reset/token=' + token)
        }
    } catch (error) {
        req.session.message = {
            type: 'danger',
            content: 'Error reset Failed!'
        };
    }
})

router.get('/auth/google', checkNotAuthenticated, (req, res) => {
    res.render('auth/error', { title: 'Maintance' })
})

module.exports = router;
