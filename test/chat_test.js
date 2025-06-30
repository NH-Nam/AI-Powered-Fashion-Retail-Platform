// chatbot.test.js - Unit tests for chatbot route
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const axios = require('axios');

// Mock dotenv configuration for testing
require('dotenv').config({ path: '.env.test' }); // Use a test-specific .env file

// Mock fs.readFileSync to control the fallback QA data
jest.mock('fs', () => ({
    readFileSync: jest.fn(),
}));

// Mock axios.post to control Gemini API responses
jest.mock('axios', () => ({
    post: jest.fn(),
}));

// Create a simple Express app to test the router
const app = express();
app.use(express.json()); // For parsing application/json

// Import the router after setting up mocks and app
const chatbotRouter = require('../routes/chatbot'); // Adjust path as necessary
app.use('/chatbot', chatbotRouter); // Mount the chatbot router under /chatbot

// Helper for testing the centralized error handler
// This simulates the main app.use(errorHandler) if it were at the top level
app.use((err, req, res, next) => {
    // Re-import the actual error handler from the chatbot router file
    // To ensure it's tested correctly, we'll assume apiErrorHandler is exported
    // or we'll copy its logic here for a proper test environment
    // For simplicity in this test, let's include a basic version or ensure it's used by router.use()
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected server error occurred.';
    res.status(statusCode).json({ success: false, error: message });
});


// --- Setup and Teardown ---
beforeEach(() => {
    // Reset mocks before each test
    fs.readFileSync.mockClear();
    axios.post.mockClear();

    // Default mock for successful QA file load
    fs.readFileSync.mockReturnValue(JSON.stringify({
        "Sản phẩm A là gì?": "Sản phẩm A là một thiết bị điện tử thông minh.",
        "Giá sản phẩm B bao nhiêu?": "Giá của sản phẩm B là 1,500,000 VND.",
        "Thông tin liên hệ của cửa hàng?": "Bạn có thể liên hệ chúng tôi qua số điện thoại 090-123-4567.",
        "Chính sách bảo hành?": "Sản phẩm của chúng tôi có chính sách bảo hành 1 năm."
    }));

    // Ensure GEMINI_API_KEY is set for tests
    process.env.GEMINI_API_KEY = 'mock_gemini_api_key';
});

afterEach(() => {
    // Clean up environment variables or other global states if needed
    delete process.env.GEMINI_API_KEY;
});

// --- Test Suite for POST /chatbot ---
describe('POST /chatbot', () => {
    it('should return 400 if prompt is missing', async () => {
        const res = await request(app)
            .post('/chatbot')
            .send({});

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Invalid input: The prompt cannot be empty.');
        expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Still attempts to load QA
        expect(axios.post).not.toHaveBeenCalled(); // No Gemini call
    });

    it('should return 400 if prompt is an empty string', async () => {
        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: '   ' }); // Empty string with spaces

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Invalid input: The prompt cannot be empty.');
        expect(fs.readFileSync).toHaveBeenCalledTimes(1);
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('should return answer from fallback QA if keyword match found', async () => {
        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: 'Giá của sản phẩm B là bao nhiêu?' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.reply).toEqual('Giá của sản phẩm B là 1,500,000 VND.');
        expect(res.body.source).toEqual('fallback_qa');
        expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Checks QA file
        expect(axios.post).not.toHaveBeenCalled(); // No Gemini call
    });

    it('should call Gemini API if no keyword match found', async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ content: { parts: [{ text: 'Đây là câu trả lời từ Gemini.' }] } }]
            }
        });

        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: 'Thời tiết hôm nay thế nào?' }); // No match in fallback QA

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.reply).toEqual('Đây là câu trả lời từ Gemini.');
        expect(res.body.source).toEqual('gemini_api');
        expect(fs.readFileSync).toHaveBeenCalledTimes(1);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('gemini-2.0-flash'), // Verify API URL
            { contents: [{ parts: [{ text: 'Thời tiết hôm nay thế nào?' }] }], generationConfig: expect.any(Object) },
            expect.any(Object)
        );
    });

    it('should return default message if Gemini API returns no content', async () => {
        axios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ content: { parts: [] } }] // Simulate no text content
            }
        });

        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: 'Câu hỏi mơ hồ.' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.reply).toContain('I\'m sorry, I could not find a suitable answer');
        expect(res.body.source).toEqual('gemini_api_no_reply');
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should return 502 if Gemini API call fails (e.g., network error)', async () => {
        axios.post.mockRejectedValueOnce({
            isAxiosError: true,
            message: 'Network Error',
            response: { status: 502, data: { error: { message: 'Upstream API is down' } } }
        });

        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: 'Hỏi về lỗi API.' });

        expect(res.statusCode).toEqual(502);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('External API error: Upstream API is down');
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should return 500 if GEMINI_API_KEY is not configured', async () => {
        delete process.env.GEMINI_API_KEY; // Unset the key for this test

        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: 'Test without key.' });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Gemini API key is not configured.');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('should handle error when chatbot_fallback_qa.json is unreadable', async () => {
        fs.readFileSync.mockImplementationOnce(() => {
            throw new Error('File not found or permissions issue');
        });

        axios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ content: { parts: [{ text: 'Trả lời từ Gemini sau khi file QA lỗi.' }] } }]
            }
        });

        const res = await request(app)
            .post('/chatbot')
            .send({ prompt: 'Một câu hỏi bất kỳ.' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.reply).toEqual('Trả lời từ Gemini sau khi file QA lỗi.');
        expect(res.body.source).toEqual('gemini_api');
        expect(fs.readFileSync).toHaveBeenCalledTimes(1); // Still attempts to load QA
        expect(axios.post).toHaveBeenCalledTimes(1); // Proceeds to call Gemini
    });
});
