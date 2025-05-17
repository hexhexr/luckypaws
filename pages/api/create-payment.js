import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, game, amount, method } = req.body;

  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // 1. Create invoice from Speed API
    const speedRes = await fetch('https://api.tryspeed.com/invoice', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SPEED_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        currency: 'USD',
        payment_method: method,
        success_url: 'https://yourdomain.com/success', // optional
      }),
    });

    const speedData = await speedRes.json();
    if (!speedRes.ok) {
      console.error('Speed API Error:', speedData);
      return res.status(500).json({ message: speedData.message || 'Invoice creation failed' });
    }

    // 2. Fetch BTC rate
    const btcRes = await fetch('https://api.coindesk.com/v1/bpi/currentprice/USD.json');
    const btcData = await btcRes.json();
    const btcRate = parseFloat(btcData.bpi.USD.rate.replace(/,/g, ''));

    const btc = (parseFloat(amount) / btcRate).toFixed(8);

    // 3. Save to Firebase
    const docRef = await db.collection('orders').add({
      username,
      game,
      amount: parseFloat(amount),
      btc,
      method,
      status: 'pending',
      orderId: speedData.id,
      invoice: speedData.invoice || null,
      address: speedData.address || null,
      created: new Date().toISOString(),
      paidManually: false,
    });

    // 4. Return response
    return res.status(200).json({
      orderId: speedData.id,
      invoice: speedData.invoice,
      address: speedData.address,
      btc,
    });

  } catch (err) {
    console.error('Create Payment Error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
