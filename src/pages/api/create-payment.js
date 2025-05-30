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
    success_url: 'https://luckypaws.vercel.app/receipt', // Ensure this URL is correct for your app
    cancel_url: 'https://luckypaws.vercel.app', // Ensure this URL is correct for your app
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

    // --- NEW LOGGING START ---
    console.log('--- DEBUG: Speed API Response Start ---');
    console.log('Raw Speed API payment object:', JSON.stringify(payment, null, 2));
    console.log('Current server time (Date.now()):', Date.now());
    if (payment.expires_at) {
        console.log('Speed API expires_at:', payment.expires_at, '(Unix ms timestamp)');
        const remainingTimeOnServer = Math.max(0, Math.floor((payment.expires_at - Date.now()) / 1000));
        console.log(`Remaining time on server before expiry: ${remainingTimeOnServer} seconds`);
        if (remainingTimeOnServer <= 0) {
            console.error('ERROR: Invoice expires_at is already in the past or very short on server!');
        }
    } else {
        console.warn('WARNING: Speed API did not return expires_at in the response.');
    }
    console.log('--- DEBUG: Speed API Response End ---');
    // --- NEW LOGGING END ---

    // Validate Speed API response
    if (
      !payment.id ||
      !payment.payment_method_options?.lightning?.payment_request
    ) {
      console.error('Invalid response from Speed API: Missing ID or invoice', JSON.stringify(payment, null, 2));
      return res.status(500).json({ message: 'Invalid response from Speed API', payment });
    }

    const invoice = payment.payment_method_options.lightning.payment_request;

    let expiresAt = null;
    if (typeof payment.expires_at === 'number' && payment.expires_at > 0) {
      expiresAt = payment.expires_at; // Use directly as it's already in milliseconds
    } else if (typeof payment.expires_at === 'string') {
      const parsedExpiresAt = Number(payment.expires_at);
      if (!isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
        expiresAt = parsedExpiresAt; // Use directly as it's already in milliseconds
      }
    }

    // --- LOGGING for expiresAt AFTER parsing ---
    console.log('Parsed expiresAt to be sent to frontend:', expiresAt);
    if (expiresAt && (expiresAt - Date.now() <= 0)) {
        console.error('ERROR: Parsed expiresAt is past current server time!');
    }
    // --- End Logging ---

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
    console.error('Speed API or payment processing error:', err.message || err);
    return res.status(500).json({ message: 'Payment creation failed', error: err.message });
  }
}