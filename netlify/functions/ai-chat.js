const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { message, groupContext, history = [] } = JSON.parse(event.body || '{}');

    if (!message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No message provided' }) };
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are Stokmate AI, a warm and practical assistant for savings groups worldwide.
You help with stokvels (South Africa), pardner (UK/Caribbean), sou-sou (US/West Africa), tontines, and all community savings clubs.

${groupContext ? `Current group context:\n${groupContext}\n` : ''}

Your expertise:
- Resolving payment disputes fairly and diplomatically
- Drafting group constitutions and contribution rules
- Handling member exits, late payments, and conflict resolution
- Payout order management for rotating groups
- Legal and practical advice for savings groups in different countries
- WhatsApp communication templates for admins

Response style:
- Keep responses concise and actionable (3-6 lines)
- Use numbered steps for processes
- Be warm but professional
- Use relevant emojis sparingly (1-2 max per response)
- South African context by default unless stated otherwise`;

    const messages = [
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: response.content[0].text }),
    };
  } catch (err) {
    console.error('AI chat error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'AI unavailable', fallback: true }),
    };
  }
};
