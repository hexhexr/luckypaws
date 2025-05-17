import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, game, amount, method } = req.body;

  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
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
        success_url: 'https://luckypaw.vercel.app/receipt', // change if needed
      }),
    });

    const speedData = await speedRes.json();
    if (!speedRes.ok || !speedData?.id) {
      console.error('Speed API Error:', speedData);
      return res.status(500).json({ message: speedData.message || 'Invoice creation failed' });
    }

    let btc = '0.00000000';
    try {
      const btcRes = await fetch('https://api.coindesk.com/v1/bpi/currentprice/USD.json');
      const btcData = await btcRes.json();
      const btcRate = parseFloat(btcData.bpi.USD.rate.replace(/,/g, ''));
      if (btcRate > 0) {
        btc = (parseFloat(amount) / btcRate).toFixed(8);
      }
    } catch (e) {
      console.error('BTC rate fetch error:', e);
    }

    await db.collection('orders').doc(speedData.id).set({
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

    return res.status(200).json({
      orderId: speedData.id,
      invoice: speedData.invoice || null,
      address: speedData.address || null,
      btc,
    });

  } catch (err) {
    console.error('Create Payment Error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
