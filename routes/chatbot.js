const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'ShopToys';

let cachedClient = null;
async function getDb() {
    if (cachedClient) return cachedClient.db(DB_NAME);
    const client = await MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    cachedClient = client;
    return client.db(DB_NAME);
}

async function fetchProducts() {
    const db = await getDb();
    return db.collection('products').find({ deleted: 0 }).sort({ updated_at: -1 }).toArray();
}

router.post('/ask-ai', async (req, res) => {
    try {
        const userQuestion = req.body.question;
        // Initialize chat history in session if not present
        if (!req.session.chatHistory) req.session.chatHistory = [];
        // Add user message to history
        req.session.chatHistory.push({ role: 'user', text: userQuestion });
        // Limit history to last 10 messages
        if (req.session.chatHistory.length > 10) {
            req.session.chatHistory = req.session.chatHistory.slice(-10);
        }
        const products = await fetchProducts();
        const productContext = products.map(
            p => `- ${p.title} (Quantity: ${p.quantity}, Price: ${p.price})`
        ).join('\n');
        // Build conversation context for Gemini
        const historyText = req.session.chatHistory
            .map(msg => (msg.role === 'user' ? `User: ${msg.text}` : `Bot: ${msg.text}`))
            .join('\n');
        const prompt = `You are a helpful assistant for a fashion retail shop. Always answer in Vietnamese unless the user specifically requests another language. Here is the current product list:\n${productContext}\n\nConversation so far:\n${historyText}\n\nUser question: ${userQuestion}`;
        const geminiRes = await axios.post(
            GEMINI_API_URL,
            { contents: [{ parts: [{ text: prompt }] }] },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const geminiReply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
        // Add bot reply to history
        req.session.chatHistory.push({ role: 'bot', text: geminiReply });
        res.json({ reply: geminiReply });
    } catch (err) {
        console.error('Gemini API error:', err.message);
        res.status(500).json({ reply: 'Sorry, there was an error processing your request.' });
    }
});

// Endpoint to clear chat history
router.post('/clear-history', (req, res) => {
    req.session.chatHistory = [];
    res.json({ success: true });
});

module.exports = router;
