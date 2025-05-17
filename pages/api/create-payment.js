import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, game, amount, method } = req.body;
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const apiKey = process.env.SPEED_SECRET_KEY;
  if (!apiKey) {
    console.error('No SPEED_SECRET_KEY in env');
    return res.status(500).json({ message: 'Server misconfiguration' });
  }

  const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');

  try {
    // 1) Create invoice via /invoices endpoint
    const speedRes = await fetch('https://api.tryspeed.com/invoices', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'speed-version': '2022-10-15',
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        currency: 'USD',
        payment_method: method,          // "lightning" or "onchain"
        success_url: 'https://luckypaw.vercel.app/receipt',
      }),
    });

    const speedData = await speedRes.json();
    if (!speedRes.ok || !speedData.id) {
      console.error('Speed API Error:', speedData);
      return res.status(500).json({ message: speedData.errors?.[0]?.message || 'Invoice creation failed' });
    }

    const orderId = speedData.id;
    const invoice = speedData.invoice || null;
    const address = speedData.address || null;

    // 2) Fetch BTC rate
    let btc = '0.00000000';
    try {
      const btcRes = await fetch('https://api.coindesk.com/v1/bpi/currentprice/USD.json');
      const { bpi } = await btcRes.json();
      const rate = parseFloat(bpi.USD.rate.replace(/,/g, ''));
      if (rate > 0) btc = (parseFloat(amount) / rate).toFixed(8);
    } catch (e) {
      console.error('BTC fetch error:', e);
    }

    // 3) Save to Firestore
    await db.collection('orders').doc(orderId).set({
      username,
      game,
      amount: parseFloat(amount),
      btc,
      method,
      status: 'pending',
      orderId,
      invoice,
      address,
      created: new Date().toISOString(),
      paidManually: false,
    });

    // 4) Return to client
    return res.status(200).json({ orderId, invoice, address, btc });
  } catch (err) {
    console.error('Create Payment Error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
