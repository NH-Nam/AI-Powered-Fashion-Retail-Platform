const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to check if user is NOT authenticated (e.g., for login/register pages)
function checkNotAuthenticated(req, res, next) {
    // This is a placeholder. In a real app, you'd check for a session or JWT existence.
    // For now, let's assume if there's a token, they are authenticated.
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
    if (token) {
        console.log('Already authenticated, redirecting.');
        return res.redirect('/'); // Or render an error page, or next(new Error('Already logged in'))
    }
    next();
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const token = req.cookies?.token; // Get token from cookie

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required: No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err.message);
            // If the token is invalid or expired
            res.clearCookie('token'); // Clear invalid token
            return res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token.' });
        }
        req.user = user; // Attach user payload to request object
        next();
    });
}

module.exports = {
    checkNotAuthenticated,
    authenticateToken
};