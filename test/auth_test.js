// auth.test.js - Unit tests for authentication routes
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel'); // Adjust path as necessary

// Mock dotenv configuration for testing
require('dotenv').config({ path: '.env.test' }); // Use a test-specific .env file

// Mock the Email utility functions
jest.mock('../utils/Email', () => ({
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
}));
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/Email');

// Mock the authorize middleware for testing purposes
jest.mock('../middleware/authorize', () => ({
    checkNotAuthenticated: jest.fn((req, res, next) => next()),
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { userId: 'mockUserId', usertype: 'user' };
        next();
    }),
}));

// Create a simple Express app to test the router
const app = express();
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Mock res.render and req.session for tests that involve them
app.set('view engine', 'ejs'); // Assuming EJS is your view engine
app.set('views', __dirname + '/views'); // Set views directory if rendering tests need it

// Mock req.session
app.use((req, res, next) => {
    req.session = {}; // Initialize a mock session object
    res.render = jest.fn((view, data) => res.send(`Rendered ${view} with data: ${JSON.stringify(data)}`)); // Mock render
    res.redirect = jest.fn(path => res.send(`Redirected to: ${path}`)); // Mock redirect
    next();
});

// Import the router after setting up mocks and app
const authRouter = require('../routes/auth'); // Adjust path as necessary
app.use('/', authRouter); // Use the router

// --- Setup and Teardown for Database Mocks ---
let mockUser;

beforeAll(async () => {
    // Connect to an in-memory database or a dedicated test database
    // For this example, we'll mock the Mongoose User model methods directly
    // If using a real test DB, you'd connect here:
    // await mongoose.connect(process.env.MONGO_URI_TEST, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
    // Disconnect from test database
    // If using a real test DB, you'd disconnect here:
    // await mongoose.disconnect();
    jest.clearAllMocks();
});

beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock the User model methods for isolated testing
    User.findOne = jest.fn();
    User.create = jest.fn();
    User.findByIdAndUpdate = jest.fn();
    User.prototype.save = jest.fn(); // Mock save for instances
    bcrypt.hash = jest.fn(async (password) => `hashed_${password}`); // Mock bcrypt hash
    bcrypt.compare = jest.fn(async (password, hash) => hash === `hashed_${password}`); // Mock bcrypt compare
    jwt.sign = jest.fn(() => 'mockAccessToken'); // Mock JWT signing
});

// --- Test Suite for Registration ---
describe('POST /register', () => {
    it('should register a new user and send verification email', async () => {
        User.findOne.mockResolvedValue(null); // No existing user
        User.create.mockResolvedValue({ // Mock the created user
            _id: 'newUserId123',
            email: 'test@example.com',
            name: 'Test User',
            password: 'hashed_Password123!',
            email_verified: false,
            emailToken: 'mockVerificationToken',
            usertype: 'user',
            save: User.prototype.save // Attach mock save method
        });
        sendVerificationEmail.mockResolvedValue(true);

        const res = await request(app)
            .post('/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'Password123!',
                password_confirmation: 'Password123!'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Registration successful');
        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(User.create).toHaveBeenCalledTimes(1);
        expect(sendVerificationEmail).toHaveBeenCalledWith('test@example.com', expect.any(String));
    });

    it('should return 409 if email already exists', async () => {
        User.findOne.mockResolvedValue({ email: 'existing@example.com' }); // User already exists

        const res = await request(app)
            .post('/register')
            .send({
                name: 'Existing User',
                email: 'existing@example.com',
                password: 'Password123!',
                password_confirmation: 'Password123!'
            });

        expect(res.statusCode).toEqual(409);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Email already exists');
    });

    it('should return 400 for invalid email format', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                name: 'Test User',
                email: 'invalid-email', // Invalid email
                password: 'Password123!',
                password_confirmation: 'Password123!'
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Email must be a valid email address.');
    });

    it('should return 400 for invalid password format', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'short', // Invalid password
                password_confirmation: 'short'
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Password must have at least 9 characters');
    });

    it('should return 400 if passwords do not match', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'Password123!',
                password_confirmation: 'Mismatch123!'
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Password confirmation does not match.');
    });
});

// --- Test Suite for Email Verification ---
describe('GET /verify', () => {
    it('should verify user email and redirect to login', async () => {
        mockUser = { _id: 'userId456', emailToken: 'validToken', email_verified: false };
        User.findOne.mockResolvedValue(mockUser);
        User.findByIdAndUpdate.mockResolvedValue({ ...mockUser, email_verified: true, emailToken: null });

        const res = await request(app).get('/verify?token=validToken');

        expect(res.statusCode).toEqual(200); // Supertest will show 200 for a successful redirect
        expect(res.text).toContain('Redirected to: /login'); // Check redirect text
        expect(mockUser.email_verified).toBe(false); // Ensure mock is not directly mutated before update call
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith('userId456', { email_verified: true, emailToken: null }, { new: true });
        expect(app.request.session.message).toEqual({ type: 'success', content: 'Your account has been successfully verified. You can log in now!' });
    });

    it('should return 400 and redirect for invalid token', async () => {
        User.findOne.mockResolvedValue(null); // No user found

        const res = await request(app).get('/verify?token=invalidToken');

        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Redirected to: /login');
        expect(app.request.session.message).toEqual({ type: 'danger', content: 'Invalid or expired verification link.' });
    });
});

// --- Test Suite for Login ---
describe('POST /login', () => {
    it('should login a verified user and set cookie', async () => {
        mockUser = {
            _id: 'userId789',
            email: 'verified@example.com',
            password: 'hashed_MySecretPassword!',
            email_verified: true,
            usertype: 'user',
            save: User.prototype.save
        };
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true); // Password matches

        const res = await request(app)
            .post('/login')
            .send({ email: 'verified@example.com', password: 'MySecretPassword!' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Login successful!');
        expect(res.header['set-cookie'][0]).toContain('token=mockAccessToken');
        expect(res.body.redirectTo).toBe('/user-dashboard');
    });

    it('should return 401 for non-existent email', async () => {
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
            .post('/login')
            .send({ email: 'nonexistent@example.com', password: 'password' });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Email not found');
    });

    it('should return 401 for incorrect password', async () => {
        mockUser = { email: 'user@example.com', password: 'hashed_correctpassword', email_verified: true };
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(false); // Password does not match

        const res = await request(app)
            .post('/login')
            .send({ email: 'user@example.com', password: 'wrongpassword' });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Incorrect password');
    });

    it('should return 403 for unverified email and resend verification', async () => {
        mockUser = {
            _id: 'userId001',
            email: 'unverified@example.com',
            password: 'hashed_Password123!',
            email_verified: false,
            usertype: 'user',
            save: User.prototype.save
        };
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        sendVerificationEmail.mockResolvedValue(true);

        const res = await request(app)
            .post('/login')
            .send({ email: 'unverified@example.com', password: 'Password123!' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Email not verified. A new verification email has been sent.');
        expect(sendVerificationEmail).toHaveBeenCalledWith('unverified@example.com', expect.any(String));
        expect(mockUser.save).toHaveBeenCalledTimes(1); // Ensure token is updated
    });
});

// --- Test Suite for Forgot Password ---
describe('POST /forgot-password', () => {
    it('should send password reset email for existing user', async () => {
        mockUser = { _id: 'userIdReset', email: 'reset@example.com', save: User.prototype.save };
        User.findOne.mockResolvedValue(mockUser);
        sendPasswordResetEmail.mockResolvedValue(true);

        const res = await request(app)
            .post('/forgot-password')
            .send({ email: 'reset@example.com' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('A password reset link has been sent to your email.');
        expect(mockUser.save).toHaveBeenCalledTimes(1);
        expect(sendPasswordResetEmail).toHaveBeenCalledWith('reset@example.com', expect.any(String));
    });

    it('should return 200 even for non-existent email (security measure)', async () => {
        User.findOne.mockResolvedValue(null); // No user found

        const res = await request(app)
            .post('/forgot-password')
            .send({ email: 'nonexistent@example.com' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('If your email is registered, a password reset link has been sent.');
        expect(sendPasswordResetEmail).not.toHaveBeenCalled(); // No email sent
    });

    it('should return 400 for invalid email format', async () => {
        const res = await request(app)
            .post('/forgot-password')
            .send({ email: 'invalid-email' }); // Invalid email

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Please provide a valid email address.');
    });
});

// --- Test Suite for Reset Password ---
describe('POST /reset/token=:id', () => {
    it('should reset password with valid token and email', async () => {
        mockUser = { _id: 'resetUser123', email: 'reset@example.com', emailToken: 'validResetToken' };
        User.findOne.mockResolvedValue(mockUser);
        User.findByIdAndUpdate.mockResolvedValue(true);

        const res = await request(app)
            .post('/reset/token=validResetToken')
            .send({
                email: 'reset@example.com',
                password: 'NewPassword123!',
                password_confirmation: 'NewPassword123!'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Your password has been successfully reset.');
        expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', saltRounds);
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith('resetUser123', { password: expect.any(String), emailToken: null });
    });

    it('should return 400 for password mismatch', async () => {
        mockUser = { email: 'reset@example.com', emailToken: 'validResetToken' };
        User.findOne.mockResolvedValue(mockUser);

        const res = await request(app)
            .post('/reset/token=validResetToken')
            .send({
                email: 'reset@example.com',
                password: 'NewPassword123!',
                password_confirmation: 'Mismatch123!'
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Password confirmation does not match.');
    });

    it('should return 400 for invalid new password format', async () => {
        mockUser = { email: 'reset@example.com', emailToken: 'validResetToken' };
        User.findOne.mockResolvedValue(mockUser);

        const res = await request(app)
            .post('/reset/token=validResetToken')
            .send({
                email: 'reset@example.com',
                password: 'short',
                password_confirmation: 'short'
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Password must have at least 9 characters');
    });

    it('should return 400 for invalid token or email combination', async () => {
        User.findOne.mockResolvedValue(null); // User not found with that token/email combo

        const res = await request(app)
            .post('/reset/token=invalidOrExpiredToken')
            .send({
                email: 'user@example.com',
                password: 'NewPassword123!',
                password_confirmation: 'NewPassword123!'
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Invalid or expired reset token for this email.');
    });
});

// --- Test Suite for Logout ---
describe('GET /logout', () => {
    it('should clear token cookie and redirect to home', async () => {
        const res = await request(app).get('/logout');

        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Redirected to: /');
        // Check if Set-Cookie header attempts to clear the token
        expect(res.header['set-cookie'][0]).toContain('token=;');
        expect(res.header['set-cookie'][0]).toContain('Expires='); // Indicates cookie expiration
    });
});
