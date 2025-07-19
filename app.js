var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session'); // NEW: For session management
require('dotenv').config(); // NEW: Load environment variables from .env file

// --- Import Routers ---
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');     // NEW: Import authentication routes
var chatbotRouter = require('./routes/chatbot'); // NEW: Import chatbot routes

var app = express();

// --- View Engine Setup ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- Middleware Chain ---

// Logging middleware
app.use(logger('dev'));

// Body parsers for JSON and URL-encoded data
app.use(express.json()); // To parse JSON bodies (e.g., for API requests)
app.use(express.urlencoded({ extended: false })); // To parse URL-encoded bodies

// Cookie parser middleware
app.use(cookieParser());

// Session middleware
// Requires a secret for signing the session ID cookie.
// Store this in an environment variable for production.
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_dev', // Use env var for production!
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        httpOnly: true, // Prevent client-side JS from reading cookie
        sameSite: 'Lax', // Protect against CSRF attacks
    }
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Route Handlers ---
// Mount your routers here. Order matters for middleware/routes.
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/', authRouter);     // NEW: Mount authentication routes
app.use('/chatbot', chatbotRouter); // NEW: Mount chatbot routes under /chatbot


// --- Error Handling ---

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// Main error handler middleware
// This will catch any errors thrown by previous middleware/routes
// that were not handled by a more specific error handler (like apiErrorHandler in auth/chatbot routers).
app.use(function(err, req, res, next) {
    // Set locals, only providing error details in development environment
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // Render the error page (assuming it's an HTML error page for browser requests)
    // If the client requested JSON, you might want to send a JSON error response here
    // based on req.accepts('json')
    res.status(err.status || 500);
    console.error('App-level Error:', err.message, process.env.NODE_ENV === 'development' ? err.stack : '');
    res.render('error');
});

module.exports = app;
