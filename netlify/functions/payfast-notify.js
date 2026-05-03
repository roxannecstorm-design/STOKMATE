const https = require('https');
const crypto = require('crypto');

function supabaseRequest(url, serviceKey, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: new URL(url).hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function verifySignature(data, received, passphrase) {
  const params = { ...data };
  delete params.signature;
  if (passphrase) params.passphrase = passphrase;
  const str = Object.keys(params).sort()
    .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
  return crypto.createHash('md5').update(str).digest('hex') === received;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const params = Object.fromEntries(new URLSearchParams(event.body));
    const isValid = verifySignature(params, params.signature, process.env.PAYFAST_PASSPHRASE);
    if (!isValid) return { statusCode: 400, body: 'Invalid signature' };

    const { payment_status, m_payment_id, custom_str1: userId, custom_str2: groupId, amount_gross } = params;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && serviceKey && payment_status === 'COMPLETE') {
      await supabaseRequest(supabaseUrl, serviceKey, 'POST', '/rest/v1/vault_entries', {
        group_id: groupId,
        action: 'subscription_activated',
        performed_by: userId,
        details: { payment_id: m_payment_id, amount: amount_gross }
      });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('payfast-notify error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
