const twilio = require('twilio');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const {
      members,
      groupName,
      amount,
      currency,
      adminName,
    } = JSON.parse(event.body || '{}');

    if (!members || !members.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No members provided' }) };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ sent: 0, total: members.length, mode: 'demo', message: 'Twilio not configured — reminders logged only' }),
      };
    }

    const client = twilio(accountSid, authToken);

    const results = await Promise.allSettled(
      members
        .filter(m => m.phone && !m.paid)
        .map(m => {
          const msg = `Hi ${m.name.split(' ')[0]} 👋\n\n*${groupName}* reminder from ${adminName}.\n\nYour contribution of *${currency}${Number(amount).toLocaleString()}* is due this month.\n\nPlease confirm with your admin once paid. Thank you! 🙏\n\n_Sent via Stokmate — stokmate.co.za_`;
          return client.messages.create({
            from: fromNumber,
            to: `whatsapp:${m.phone}`,
            body: msg,
          });
        })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sent, failed, total: members.filter(m => m.phone && !m.paid).length }),
    };
  } catch (err) {
    console.error('WhatsApp send error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send reminders' }),
    };
  }
};
