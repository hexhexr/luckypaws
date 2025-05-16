import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { username, game, amount, method } = req.body;
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');

  const payload = {
    amount: Number(amount),
    currency: 'USD',
    success_url: 'http://localhost:3000/success',
    cancel_url: 'http://localhost:3000/cancel',
  };

  const response = await fetch(`${apiUrl}/payments`, {
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
  const invoice = payment.payment_method_options?.lightning?.payment_request || null;
  const address = payment.payment_method_options?.on_chain?.address || null;
  const sats = method === 'lightning'
    ? payment.payment_method_options?.lightning?.amount || 0
    : payment.payment_method_options?.on_chain?.amount || 0;
  const btc = (sats / 1e8).toFixed(8);

  const order = {
    orderId: payment.id,
    username,
    game,
    amount,
    btc,
    method,
    status: 'pending',
    invoice,
    address,
    created: new Date().toISOString(),
  };

  await db.collection('orders').doc(order.orderId).set(order);
  res.status(200).json({ orderId: order.orderId, invoice, address, btc });
}
