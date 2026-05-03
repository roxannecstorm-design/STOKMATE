const crypto = require('crypto');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function verifyPayFastSignature(data, receivedSignature, passphrase) {
  const params = { ...data };
  delete params.signature;
  if (passphrase) params.passphrase = passphrase;

  const queryString = Object.keys(params)
    .sort()
    .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');

  return crypto.createHash('md5').update(queryString).digest('hex') === receivedSignature;
}

function verifyPayFastIP(ip) {
  const validIPs = [
    '41.74.179.194', '41.74.179.195', '41.74.179.196',
    '41.74.179.197', '41.74.179.198', '41.74.179.199',
    '41.74.179.200', '41.74.179.201',
  ];
  return validIPs.includes(ip);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const params = Object.fromEntries(new URLSearchParams(event.body));

    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['client-ip'];
    if (process.env.NODE_ENV === 'production' && !verifyPayFastIP(clientIP)) {
      console.warn('PayFast notify from unrecognised IP:', clientIP);
      return { statusCode: 400, body: 'Invalid IP' };
    }

    const isValid = verifyPayFastSignature(params, params.signature, process.env.PAYFAST_PASSPHRASE);
    if (!isValid) {
      console.error('PayFast signature mismatch');
      return { statusCode: 400, body: 'Invalid signature' };
    }

    const { payment_status, m_payment_id, custom_str1: userId, custom_str2: groupId, amount_gross } = params;

    if (payment_status === 'COMPLETE') {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        group_id: groupId,
        payfast_payment_id: m_payment_id,
        amount: parseFloat(amount_gross),
        status: 'active',
        activated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
      });

      await supabase.from('vault_entries').insert({
        group_id: groupId,
        action: 'subscription_activated',
        performed_by: userId,
        details: { payment_id: m_payment_id, amount: amount_gross },
      });
    } else if (payment_status === 'CANCELLED') {
      await supabase.from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('group_id', groupId).eq('user_id', userId);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('PayFast notify error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
