const https = require('https');

function twilioPost(accountSid, authToken, body) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const payload = new URLSearchParams(body).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const { members, groupName, amount, currency, adminName } = JSON.parse(event.body || '{}');
    if (!members || !members.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No members' }) };

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, total: members.length, mode: 'demo' }) };
    }

    const unpaid = members.filter(m => m.phone && !m.paid);
    const results = await Promise.allSettled(
      unpaid.map(m => {
        const msg = `Hi ${m.name.split(' ')[0]} 👋\n\n*${groupName}* reminder from ${adminName}.\n\nYour contribution of *${currency}${Number(amount).toLocaleString()}* is due this month.\n\nPlease confirm with your admin once paid. Thank you! 🙏\n\n_Sent via Stokmate_`;
        return twilioPost(accountSid, authToken, { From: fromNumber, To: `whatsapp:${m.phone}`, Body: msg });
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return { statusCode: 200, headers, body: JSON.stringify({ sent, failed: unpaid.length - sent, total: unpaid.length }) };
  } catch (err) {
    console.error('send-reminder error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send' }) };
  }
};
