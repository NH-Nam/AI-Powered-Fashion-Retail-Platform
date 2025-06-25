const express = require('express');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Load dữ liệu từ file
let productQA = {};
try {
    const raw = fs.readFileSync('./chatbot_fallback_qa.json', 'utf8');
    productQA = JSON.parse(raw);
} catch (err) {
    console.error('Không đọc được file chatbot_fallback_qa.json:', err.message);
}

// Hàm tìm câu trả lời theo từ khóa (keyword-based match)
function getKeywordMatchAnswer(prompt) {
    const lowerPrompt = prompt.toLowerCase();

    for (const [question, answer] of Object.entries(productQA)) {
        const keyWords = question.toLowerCase().split(/[\s\?,\.]+/);
        const matched = keyWords.some(word => word.length > 2 && lowerPrompt.includes(word));
        if (matched) return answer;
    }

    return null;
}

// POST /
router.post('/', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Câu hỏi không hợp lệ.' });
    }

    // 1. Nếu có từ khóa liên quan đến câu hỏi trong file → trả lời theo file
    const matchedAnswer = getKeywordMatchAnswer(prompt);
    if (matchedAnswer) {
        return res.json({ reply: matchedAnswer });
    }

    // 2. Nếu không có từ khóa nào liên quan → gọi Gemini
    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{ parts: [{ text: prompt }] }]
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return res.json({ reply: reply || 'Không tìm thấy câu trả lời phù hợp.' });

    } catch (error) {
        console.error('Gemini API error:', error?.response?.data || error.message);
        return res.status(500).json({ error: 'Lỗi khi gọi Gemini API.' });
    }
});

module.exports = router;
