// pages/api/create-payment.js
import { db } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, game, amount, method } = req.body;
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const url = `${apiUrl}/payments`;
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const uniqueReference = `${username.replace(/\s+/g, '_')}-${Date.now()}`;

  const payload = {
    amount: Number(amount),
    currency: 'USD',
    success_url: `${baseUrl}/receipt`,
    cancel_url: `${baseUrl}/`,
    reference: uniqueReference,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'speed-version': '2022-10-15',
      },
      body: JSON.stringify(payload),
    });

    const payment = await response.json();

    if (!response.ok || !payment.id || !payment.payment_method_options?.lightning?.payment_request) {
      return res.status(500).json({ message: 'Invalid response from payment gateway', details: payment.message });
    }

    const invoice = payment.payment_method_options.lightning.payment_request;
    const expiresAt = payment.expires_at;
    let btc = 'N/A';

    if (payment.amount_in_satoshis > 0) {
      btc = (payment.amount_in_satoshis / 100000000).toFixed(8);
    } else {
        try {
            const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const btcData = await btcRes.json();
            const rate = btcData?.bitcoin?.usd;
            if (rate > 0) btc = (parseFloat(amount) / rate).toFixed(8);
        } catch (e) { console.error('CoinGecko fallback failed:', e); }
    }

    await db.collection('orders').doc(payment.id).set({
      orderId: payment.id,
      username,
      game,
      amount,
      btc,
      method,
      status: 'pending',
      invoice,
      created: Timestamp.now(), // THE FIX IS HERE
      expiresAt,
      read: false,
      reference: uniqueReference,
    });

    return res.status(200).json({ orderId: payment.id, invoice, btc, expiresAt });
  } catch (err) {
    console.error('Payment creation error:', err);
    return res.status(500).json({ message: 'Payment creation failed', error: err.message });
  }
}