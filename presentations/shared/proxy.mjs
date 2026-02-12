/**
 * Gas Town Operations - Claude API Proxy for Presentation Widget
 *
 * Minimal proxy that forwards requests from the help/bug widget
 * to the Anthropic Claude API. Runs on localhost:3141.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node presentations/shared/proxy.mjs
 */

import { createServer } from 'node:http';

const PORT = 3141;
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

if (!API_KEY) {
    console.error('[proxy] ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('[proxy] Start with: ANTHROPIC_API_KEY=sk-ant-... node presentations/shared/proxy.mjs');
    process.exit(1);
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

const server = createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
    }

    if (req.method !== 'POST' || req.url !== '/api/chat') {
        res.writeHead(404, corsHeaders());
        res.end(JSON.stringify({ error: 'Not found. Use POST /api/chat' }));
        return;
    }

    // Read request body
    let body = '';
    for await (const chunk of req) body += chunk;

    let parsed;
    try {
        parsed = JSON.parse(body);
    } catch {
        res.writeHead(400, corsHeaders());
        res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        return;
    }

    const { messages, system } = parsed;
    if (!messages || !Array.isArray(messages)) {
        res.writeHead(400, corsHeaders());
        res.end(JSON.stringify({ error: 'Missing "messages" array in request body' }));
        return;
    }

    // Forward to Claude API
    try {
        const apiBody = {
            model: MODEL,
            max_tokens: 1024,
            messages,
        };
        if (system) apiBody.system = system;

        const apiRes = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(apiBody),
        });

        const apiData = await apiRes.text();

        res.writeHead(apiRes.status, corsHeaders());
        res.end(apiData);
    } catch (err) {
        console.error('[proxy] API request failed:', err.message);
        res.writeHead(502, corsHeaders());
        res.end(JSON.stringify({ error: 'Failed to reach Claude API: ' + err.message }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[proxy] Presentation widget proxy running on http://localhost:${PORT}`);
    console.log(`[proxy] Model: ${MODEL}`);
    console.log('[proxy] POST /api/chat to forward to Claude API');
});
