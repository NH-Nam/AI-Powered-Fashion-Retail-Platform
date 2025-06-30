// chatbot.js - Optimized Backend Chatbot Route

const express = require('express');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config(); // Load environment variables

const router = express.Router();

// --- Configuration Constants ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const FALLBACK_QA_FILE = './chatbot_fallback_qa.json';

// --- Load Fallback QA Data ---
let productQA = {};
try {
    const raw = fs.readFileSync(FALLBACK_QA_FILE, 'utf8');
    productQA = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(productQA).length} Q&A pairs from ${FALLBACK_QA_FILE}`);
} catch (err) {
    // Log error but allow app to continue without fallback QA
    console.error(`Error loading fallback Q&A file "${FALLBACK_QA_FILE}":`, err.message);
    productQA = {}; // Ensure productQA is an empty object if file load fails
}

// --- Helper Functions ---

/**
 * Searches for a keyword-based match in the pre-loaded productQA.
 * @param {string} prompt - The user's input prompt.
 * @returns {string|null} - The matched answer or null if no match.
 */
function getKeywordMatchAnswer(prompt) {
    const lowerPrompt = prompt.toLowerCase();

    for (const [question, answer] of Object.entries(productQA)) {
        // Split question into keywords, filter out very short words that might cause false positives
        const keyWords = question.toLowerCase().split(/[\s\?,\.]+/).filter(word => word.length > 2);
        const matched = keyWords.some(word => lowerPrompt.includes(word));
        if (matched) {
            console.log(`Keyword match found for "${prompt}" using question "${question}".`);
            return answer;
        }
    }
    console.log(`No keyword match found for "${prompt}".`);
    return null;
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
    // Log the full error for debugging in development
    console.error('API Error:', err.message, process.env.NODE_ENV === 'development' ? err.stack : '');

    let statusCode = err.statusCode || 500;
    let message = err.message || 'An unexpected server error occurred.';

    // Handle specific types of errors from external services or invalid requests
    if (err.isAxiosError && err.response) {
        // Error from Axios (e.g., Gemini API)
        statusCode = err.response.status || 500;
        message = err.response.data?.error?.message || `External API error: ${err.message}`;
    } else if (err.name === 'ValidationError') { // Example for Joi/Yup validation errors
        statusCode = 400;
        message = `Validation Error: ${err.message}`;
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        // Only expose stack trace in development environment
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

// --- Routes ---

// POST /chatbot - Handles chatbot queries
router.post('/', async (req, res, next) => {
    try {
        const { prompt } = req.body;

        // Input Validation
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            // Use a custom error object for consistent handling by apiErrorHandler
            const error = new Error('Invalid input: The prompt cannot be empty.');
            error.statusCode = 400; // Bad Request
            throw error;
        }

        // 1. Check for keyword-based match in local fallback data
        const matchedAnswer = getKeywordMatchAnswer(prompt);
        if (matchedAnswer) {
            return res.status(200).json({ success: true, reply: matchedAnswer, source: 'fallback_qa' });
        }

        // 2. If no keyword match, call Gemini API
        if (!GEMINI_API_KEY) {
            const error = new Error('Gemini API key is not configured.');
            error.statusCode = 500; // Internal Server Error
            throw error;
        }

        try {
            const response = await axios.post(GEMINI_API_URL, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    // You can add more configuration here, e.g., temperature, max_output_tokens
                    temperature: 0.7,
                    maxOutputTokens: 200,
                },
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (reply) {
                return res.status(200).json({ success: true, reply: reply, source: 'gemini_api' });
            } else {
                // If Gemini returns no content, provide a default message
                return res.status(200).json({ success: true, reply: 'I\'m sorry, I could not find a suitable answer at this moment. Please try rephrasing your question.', source: 'gemini_api_no_reply' });
            }

        } catch (axiosError) {
            // Wrap Axios errors to be caught by the centralized handler
            console.error('Gemini API call failed:', axiosError.response?.data || axiosError.message);
            const error = new Error('Failed to get a response from the AI. Please try again later.');
            error.statusCode = axiosError.response?.status || 502; // Bad Gateway or specific status
            error.isAxiosError = true; // Mark as Axios error for handler
            error.response = axiosError.response; // Pass axios response data
            throw error;
        }

    } catch (error) {
        // Pass any caught errors to the centralized error handler
        next(error);
    }
});

// --- Apply Centralized API Error Handler at the end ---
router.use(apiErrorHandler);

module.exports = router;
