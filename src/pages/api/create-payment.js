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
    console.log('Speed API payment object:', payment); // This log is crucial for debugging the exact `expires_at` value

    // Validate Speed API response
    if (
      !payment.id ||
      !payment.payment_method_options?.lightning?.payment_request
    ) {
      console.error('Invalid response from Speed API:', JSON.stringify(payment, null, 2));
      return res.status(500).json({ message: 'Invalid response from Speed API', payment });
    }

    const invoice = payment.payment_method_options.lightning.payment_request;

    // --- REVISED EXPIRY TIME FIX (Adjusted for 'seconds' if necessary) ---
    let expiresAt = null;
    // Check if payment.expires_at is a number or can be parsed as a number
    if (typeof payment.expires_at === 'number' && payment.expires_at > 0) {
      // Assuming Speed API returns 'expires_at' in seconds, convert to milliseconds
      expiresAt = payment.expires_at * 1000;
    } else if (typeof payment.expires_at === 'string') {
      const parsedExpiresAt = Number(payment.expires_at);
      if (!isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
        // Assuming Speed API returns 'expires_at' as a string representing seconds, convert to milliseconds
        expiresAt = parsedExpiresAt * 1000;
      }
    }
    // IMPORTANT: If your console.log reveals that payment.expires_at is ALREADY in milliseconds,
    // then remove the '* 1000' from the lines above.
    // --- END OF REVISED EXPIRY TIME FIX ---

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
      expiresAt: expiresAt, // This is the crucial part that depends on the unit from Speed API
      paidManually: false,
    });

    return res.status(200).json({ orderId: payment.id, invoice, btc, expiresAt });
  } catch (err) {
    console.error('Speed API error:', err);
    return res.status(500).json({ message: 'Speed API failed', error: err.message });
  }
}