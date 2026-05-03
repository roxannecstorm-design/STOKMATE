const https = require('https');

function post(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'AI not configured', fallback: true }) };
  }

  try {
    const { message, groupContext, history = [] } = JSON.parse(event.body || '{}');
    if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No message' }) };

    const systemPrompt = `You are Stokmate AI, a warm and practical assistant for savings groups (stokvels, pardner, sou-sou, tontines).
${groupContext ? `Group context: ${groupContext}` : ''}
Keep responses concise (3-6 lines), practical, and warm. Use numbered steps for processes.`;

    const payload = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ]
    });

    const result = await post({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    if (result.status !== 200) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'AI error', fallback: true }) };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ response: result.body.content[0].text })
    };
  } catch (err) {
    console.error('ai-chat error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'AI unavailable', fallback: true }) };
  }
};
