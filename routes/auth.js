// auth.js - Optimized Backend Authentication Routes

var express = require('express');
var router = express.Router();
const User = require('../models/UserModel');
const validator = require("validator");
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// --- Configuration Constants ---
const saltRounds = 10; // Number of rounds for bcrypt hashing
require('dotenv').config(); // Load environment variables

// --- Custom Middleware & Utilities ---
const { checkNotAuthenticated, authenticateToken } = require('../middleware/authorize'); // Assumed updated/new middleware
var { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/Email');

// --- Helper Functions for Validation ---

/**
 * Validates user registration input.
 * @param {object} data - The request body containing registration data.
 * @returns {{isValid: boolean, message: string|null}} - Validation result.
 */
function validateRegistrationInput(data) {
    if (!validator.isEmail(data.email)) {
        return { isValid: false, message: 'Email must be a valid email address.' };
    }
    if (!/^[a-zA-Z ]*$/.test(data.name)) {
        return { isValid: false, message: 'The name can only contain letters and spaces.' };
    }
    // Password must have at least 9 characters, including numbers, upper and lower case letters and one special character.
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{9,}$/;
    if (!passwordRegex.test(data.password)) {
        return { isValid: false, message: 'Password must have at least 9 characters, including numbers, upper and lower case letters and one special character.' };
    }
    if (data.password !== data.password_confirmation) {
        return { isValid: false, message: 'Password confirmation does not match.' };
    }
    return { isValid: true, message: null };
}

// --- API Error Handling Middleware ---

/**
 * Centralized error handling for API routes.
 * Sends consistent JSON error responses.
 * @param {Error} err - The error object.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
function apiErrorHandler(err, req, res, next) {
    console.error('API Error:', err.message);
    // Determine status code and message
    let statusCode = err.statusCode || 500;
    let message = err.message || 'An unexpected error occurred.';

    // Specific error types can be handled here
    if (err.name === 'ValidationError') { // Example for Mongoose validation errors
        statusCode = 400;
        message = err.message;
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token.';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired.';
    }

    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined // Include stack in dev
    });
}

// --- Routes ---

// GET /register - Renders registration form
router.get('/register', checkNotAuthenticated, (req, res) => {
    // Session message handling for rendering HTML forms
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Clear message from session
    res.render('auth/register', { title: 'Register', message });
});

// POST /register - Handles user registration (API-focused error handling)
router.post('/register', async (req, res, next) => {
    try {
        const validationResult = validateRegistrationInput(req.body);
        if (!validationResult.isValid) {
            // For API-like POST requests, send JSON response
            return res.status(400).json({ success: false, message: validationResult.message });
        }

        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already exists.' }); // 409 Conflict
        }

        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const verificationToken = generateVerificationToken();

        const newUser = await User.create({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            email_verified: false,
            emailToken: verificationToken,
            usertype: 'user' // Default user type, if applicable
        });

        await sendVerificationEmail(newUser.email, verificationToken);
        // For successful API registration, send JSON response
        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            redirectTo: '/verify-email' // Suggest redirect for frontend
        });

    } catch (error) {
        // Pass error to centralized error handler
        next(error);
    }
});

// GET /verify - Verifies user email (remains redirect-based as it's a GET from email link)
router.get('/verify', async (req, res, next) => {
    try {
        const verificationToken = req.query.token;
        const user = await User.findOne({ emailToken: verificationToken });

        if (!user) {
            req.session.message = { type: 'danger', content: 'Invalid or expired verification link.' };
            return res.redirect('/login');
        }

        await User.findByIdAndUpdate(user._id, { email_verified: true, emailToken: null }, { new: true }); // Clear token after use

        req.session.message = {
            type: 'success',
            content: 'Your account has been successfully verified. You can log in now!'
        };
        res.redirect('/login');
    } catch (error) {
        console.error('Error during email verification:', error);
        req.session.message = { type: 'danger', content: 'An error occurred during verification. Please try again.' };
        res.redirect('/login');
    }
});

// GET /verify-email - Renders email verification instruction page
router.get('/verify-email', checkNotAuthenticated, (req, res) => {
    res.render('auth/verify-email', { title: 'Verification' });
});

// GET /login - Renders login form
router.get('/login', checkNotAuthenticated, (req, res) => {
    const message = req.session ? req.session.message : null;
    delete req.session.message; // Clear message from session
    res.render('auth/login', { title: 'Login', message });
});

// POST /login - Handles user login (API-focused error handling)
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials: Email not found.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials: Incorrect password.' });
        }

        if (!user.email_verified) {
            // Re-send verification email if not verified
            const verificationToken = generateVerificationToken();
            user.emailToken = verificationToken;
            await user.save();
            await sendVerificationEmail(user.email, verificationToken);
            return res.status(403).json({ success: false, message: 'Email not verified. A new verification email has been sent.' });
        }

        const token = jwt.sign(
            { userId: user._id, usertype: user.usertype },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'Lax', // 'Strict', 'Lax', or 'None'
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            token: token, // Optionally send token to frontend if needed for client-side use (e.g., Axios headers)
            user: { id: user._id, name: user.name, email: user.email, usertype: user.usertype },
            redirectTo: user.usertype === 'admin' ? '/admin-dashboard' : '/user-dashboard' // Example redirect
        });

    } catch (error) {
        next(error);
    }
});

// GET /logout - Clears JWT cookie and redirects
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// GET /forgot-password - Renders forgot password form
router.get('/forgot-password', checkNotAuthenticated, (req, res) => {
    const message = req.session ? req.session.message : null;
    delete req.session.message;
    res.render('auth/forgot-password', { title: 'Forgot Password', message });
});

// POST /forgot-password - Handles password reset request (API-focused error handling)
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // For security, always respond as if email was processed, even if not found
            return res.status(200).json({ success: true, message: 'If your email is registered, a password reset link has been sent.' });
        }

        const verificationToken = generateVerificationToken();
        user.emailToken = verificationToken; // Reuse emailToken for password reset token
        await user.save(); // Save the token to the user document

        await sendPasswordResetEmail(email, verificationToken);

        res.status(200).json({
            success: true,
            message: 'A password reset link has been sent to your email. Please check your inbox.',
            redirectTo: '/forgot-password'
        });
    } catch (error) {
        next(error);
    }
});

// GET /reset/token=:id - Renders password reset form
router.get('/reset/token=:id', async (req, res, next) => {
    try {
        const emailToken = req.params.id;
        const user = await User.findOne({ emailToken: emailToken });

        if (!user) {
            req.session.message = { type: 'danger', content: 'Invalid or expired password reset link.' };
            return res.redirect('/login');
        }

        const message = req.session ? req.session.message : null;
        delete req.session.message;
        res.render('auth/reset-password', { title: 'Reset Password', user, message, token: emailToken }); // Pass token to view
    } catch (error) {
        console.error('Error rendering reset password page:', error);
        req.session.message = { type: 'danger', content: 'An unexpected error occurred.' };
        res.redirect('/login');
    }
});

// POST /reset/token=:id - Handles password reset (API-focused error handling)
router.post('/reset/token=:id', async (req, res, next) => {
    try {
        const { email, password, password_confirmation } = req.body;
        const token = req.params.id;

        const user = await User.findOne({ email: email, emailToken: token }); // Ensure token matches user email

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token for this email.' });
        }

        if (password !== password_confirmation) {
            return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{9,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must have at least 9 characters, including numbers, upper and lower case letters and one special character.' });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        // Update password and clear the emailToken after successful reset
        await User.findByIdAndUpdate(user._id, { password: hashedPassword, emailToken: null });

        res.status(200).json({
            success: true,
            message: 'Your password has been successfully reset. You can login now!',
            redirectTo: '/login'
        });
    } catch (error) {
        next(error);
    }
});

// --- Example Protected Route (using authenticateToken middleware) ---
// This route is just an example to demonstrate how authenticateToken would be used.
router.get('/protected-data', authenticateToken, (req, res) => {
    // If authenticateToken passes, req.user will contain user information
    res.status(200).json({
        success: true,
        message: 'You have access to protected data!',
        user: req.user // User info from the token
    });
});

// --- Fallback Route (Example for an "error" page, or a maintenance page) ---
router.get('/auth/google', checkNotAuthenticated, (req, res) => {
    res.render('auth/error', { title: 'Maintenance' }); // Using a generic error/maintenance view
});

// --- Token Generation Utility (kept for internal use) ---
function generateVerificationToken() {
    return crypto.randomBytes(20).toString('hex');
}

// --- Apply Centralized API Error Handler at the end ---
router.use(apiErrorHandler);

module.exports = router;

