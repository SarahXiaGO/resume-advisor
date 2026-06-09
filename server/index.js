const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Readable } = require('stream');
// Load both .env and .env.local (later files do not override already-set vars)
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Parse PDF/DOCX and extract text
app.post('/api/parse', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { mimetype, buffer, originalname } = req.file;
    let text = '';

    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.endsWith('.docx')
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, or TXT.' });
    }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from file. Try copying and pasting instead.' });
    }
    res.json({ text: text.trim() });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

// Proxy to Anthropic — key never leaves server
app.post('/api/analyze', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const { messages, system } = req.body;
    const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        // Raised from 3000: the structured payload (parsed resume + sections +
        // annotations + suggestions) overflowed 3000 and truncated the JSON.
        max_tokens: 8000,
        system,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    // Forward SSE stream to client.
    // Built-in fetch returns a web ReadableStream (no .pipe), so bridge it to a Node stream.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`QuantEdge server running on http://localhost:${PORT}`));
