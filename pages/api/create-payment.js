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

    if (
      !payment.id ||
      (!payment.payment_method_options?.lightning?.payment_request &&
       !payment.payment_method_options?.on_chain?.address)
    ) {
      return res.status(500).json({ message: 'Invalid response from Speed API', payment });
    }

    const invoice = payment.payment_method_options?.lightning?.payment_request || null;
    const address = payment.payment_method_options?.on_chain?.address || null;

    let btc = '0.00000000';
    const sats = payment.amount_in_satoshis || 0;

    if (sats > 0) {
      btc = (sats / 100000000).toFixed(8);
    } else {
      try {
        const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const btcData = await btcRes.json();
        const rate = btcData.bitcoin.usd;
        if (rate > 0) btc = (parseFloat(amount) / rate).toFixed(8);
      } catch (e) {
        console.error('CoinGecko BTC fallback failed:', e);
      }
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
      address,
      created: new Date().toISOString(),
      paidManually: false,
    });

    return res.status(200).json({ orderId: payment.id, invoice, address, btc });
  } catch (err) {
    console.error('Speed API error:', err);
    return res.status(500).json({ message: 'Speed API failed', error: err.message });
  }
}
