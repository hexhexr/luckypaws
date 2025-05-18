import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { username, game, amount, method = 'lightning' } = req.body;

  if (!username || !game || !amount) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const url = `${apiUrl}/payments`;
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');

  const payload = {
    amount: Number(amount),
    currency: 'USD',
    success_url: 'https://luckypaws.vercel.app/receipt',
    cancel_url: 'https://luckypaws.vercel.app',
    payment_method: method,
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

    let payment;
    try {
      payment = await response.json();
    } catch {
      const fallback = await response.text();
      throw new Error(`Unexpected response: ${fallback}`);
    }

    const invoice = payment.payment_method_options?.lightning?.payment_request || null;
    const sats = payment.payment_method_options?.lightning?.amount || 0;
    const btc = (sats / 100000000).toFixed(8);

    const order = {
      orderId: payment.id,
      username,
      game,
      amount,
      btc,
      method,
      status: 'pending',
      invoice,
      created: new Date().toISOString(),
    };

    await db.collection('orders').doc(order.orderId).set(order);
    return res.status(200).json({ invoice, btc, orderId: order.orderId });

  } catch (err) {
    console.error('Speed API Error:', err);
    return res.status(500).json({ message: 'Invoice creation failed' });
  }
}
