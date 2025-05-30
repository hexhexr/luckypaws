// pages/api/create-payment.js
import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

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
    success_url: 'https://luckypaws.vercel.app/receipt',
    cancel_url: 'https://luckypaws.vercel.app',
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
    // --- NEW LOGS HERE ---
    console.log('--- BACKEND DEBUG START ---');
    console.log('Speed API raw response object:', JSON.stringify(payment, null, 2));
    console.log('Speed API payment.expires_at (raw):', payment.expires_at, 'Type:', typeof payment.expires_at);
    console.log('Speed API payment.created (raw):', payment.created, 'Type:', typeof payment.created);
    console.log('Speed API payment.ttl (raw):', payment.ttl, 'Type:', typeof payment.ttl);
    console.log('Server Date.now() at API call:', Date.now());
    // --- END NEW LOGS ---


    // Validate Speed API response
    if (
      !payment.id ||
      !payment.payment_method_options?.lightning?.payment_request
    ) {
      console.error('Invalid response from Speed API:', JSON.stringify(payment, null, 2));
      return res.status(500).json({ message: 'Invalid response from Speed API', payment });
    }

    const invoice = payment.payment_method_options.lightning.payment_request;

    let expiresAt = null;
    if (typeof payment.expires_at === 'number' && payment.expires_at > 0) {
      expiresAt = payment.expires_at; // CONFIRMED: already in milliseconds
    } else if (typeof payment.expires_at === 'string') {
      const parsedExpiresAt = Number(payment.expires_at);
      if (!isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
        expiresAt = parsedExpiresAt; // CONFIRMED: already in milliseconds
      }
    }

    // --- NEW LOGS HERE ---
    console.log('Calculated expiresAt (milliseconds) for Firebase/Frontend:', expiresAt);
    if (expiresAt) {
      const currentTime = Date.now();
      const remainingSeconds = Math.floor((expiresAt - currentTime) / 1000);
      console.log(`Time remaining on server (expiresAt - now): ${remainingSeconds} seconds`);
      if (remainingSeconds <= 0) {
          console.warn('WARNING: Invoice already expired or about to expire on server side!');
      }
    } else {
         console.warn('WARNING: expiresAt could not be properly determined from Speed API response.');
    }
    console.log('--- BACKEND DEBUG END ---');
    // --- END NEW LOGS ---


    let btc = 'N/A';
    const requestedAmountUSD = parseFloat(amount);

    if (payment.amount_in_satoshis && typeof payment.amount_in_satoshis === 'number' && payment.amount_in_satoshis > 0) {
      btc = (payment.amount_in_satoshis / 100000000).toFixed(8);
    } else {
      try {
        const btcRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        );
        const btcData = await btcRes.json();
        console.log('CoinGecko Data:', btcData);
        const rate = btcData?.bitcoin?.usd;

        if (rate && typeof rate === 'number' && rate > 0) {
          btc = (requestedAmountUSD / rate).toFixed(8);
        } else {
          console.warn('CoinGecko rate not found or invalid:', rate);
          btc = 'N/A - Rate Error';
        }
      } catch (e) {
        console.error('CoinGecko BTC fallback failed:', e);
        btc = 'N/A - CoinGecko Error';
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
      created: new Date().toISOString(),
      expiresAt: expiresAt,
      paidManually: false,
    });

    return res.status(200).json({ orderId: payment.id, invoice, btc, expiresAt });
  } catch (err) {
    console.error('Speed API error:', err);
    return res.status(500).json({ message: 'Speed API failed', error: err.message });
  }
}