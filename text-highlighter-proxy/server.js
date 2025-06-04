import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

// Initialize express app
const app = express();

// Apply middleware
app.use(cors());

// Proxy endpoint
app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL parameter missing');

    try {
        const response = await fetch(url);
        const html = await response.text();
        res.send(html);
    } catch (error) {
        res.status(500).send(`Error fetching URL: ${error.message}`);
    }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});