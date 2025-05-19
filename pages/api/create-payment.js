import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { username, game, amount, method } = req.body;
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const url = `${apiUrl}/payments`;
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');

  const payload = {
    amount: Number(amount),
    currency: 'USD',
    success_url: 'https://luckypaw.vercel.app/receipt',
    cancel_url: 'https://luckypaw.vercel.app',
    metadata: {
      username,
      game,
      amount
    },
    description: `🎮 ${game} | 👤 ${username} | 💰 $${amount}`
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

    if (!payment.id || !payment.hosted_checkout_url) {
      return res.status(500).json({ message: 'Invalid response from Speed API', payment });
    }

    let btc = '0.00000000';
    const sats = payment.amount_in_satoshis || 0;

    if (sats > 0) {
      btc = (sats / 100000000).toFixed(8);
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    await db.collection('orders').doc(payment.id).set({
      orderId: payment.id,
      username,
      game,
      amount,
      btc,
      method,
      status: 'pending',
      hostedUrl: payment.hosted_checkout_url,
      created: new Date().toISOString(),
      expiresAt,
      paidManually: false,
    });

    return res.status(200).json({
      orderId: payment.id,
      hostedUrl: payment.hosted_checkout_url,
      btc,
      expiresAt
    });

  } catch (err) {
    console.error('Speed API error:', err);
    return res.status(500).json({ message: 'Speed API failed', error: err.message });
  }
}
