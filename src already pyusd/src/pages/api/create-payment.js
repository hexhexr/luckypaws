// pages/api/create-payment.js
import { db } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// FIX: Simple in-memory store for rate limiting. For a scaled production environment, a solution like Redis would be more robust.
const rateLimitStore = {};
const RATE_LIMIT_COUNT = 10; // Max 10 requests per IP
const RATE_LIMIT_WINDOW = 60 * 1000; // per 1 minute window

export default async function handler(req, res) {
  // FIX: Implement IP-based rate limiting to prevent abuse.
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = [];
    }

    // Clear old request timestamps from memory
    rateLimitStore[ip] = rateLimitStore[ip].filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

    if (rateLimitStore[ip].length >= RATE_LIMIT_COUNT) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ message: 'Too many requests. Please try again in a minute.' });
    }

    rateLimitStore[ip].push(now);
  } catch (e) {
      console.error("Rate limiting error:", e)
      // If rate limiting fails, proceed with the request but log the error.
  }


  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, game, amount, method } = req.body;
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const apiUrl = process.env.SPEED_API_BASE_URL || 'https://api.tryspeed.com';
  const url = `${apiUrl}/payments`;
  const authHeader = Buffer.from(`${process.env.SPEED_SECRET_KEY}:`).toString('base64');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const uniqueReference = `${username.replace(/\s+/g, '_')}-${Date.now()}`;

  // Intentionally define paymentId outside the try block
  let paymentId = null;

  try {
    const payload = {
      amount: Number(amount),
      currency: 'USD',
      // BUG FIX: The success_url requires the payment ID to show the correct receipt.
      // This will be dynamically replaced after we get the ID from the Speed API response.
      success_url: `${baseUrl}/receipt?id={payment_id}`,
      cancel_url: `${baseUrl}/`,
      reference: uniqueReference,
    };

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

    if (!response.ok || !payment.id || !payment.payment_method_options?.lightning?.payment_request) {
      console.error('Invalid response from payment gateway:', payment);
      return res.status(500).json({ message: 'Invalid response from payment gateway', details: payment.message });
    }

    // Assign the received payment ID
    paymentId = payment.id;

    // Now, correctly fill the success_url for the database record
    const final_success_url = `${baseUrl}/receipt?id=${paymentId}`;

    const invoice = payment.payment_method_options.lightning.payment_request;
    const expiresAt = payment.expires_at;
    let btc = 'N/A';

    // Calculate BTC amount, with a fallback to CoinGecko for resilience
    if (payment.amount_in_satoshis > 0) {
      btc = (payment.amount_in_satoshis / 100000000).toFixed(8);
    } else {
        try {
            const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const btcData = await btcRes.json();
            const rate = btcData?.bitcoin?.usd;
            if (rate > 0) btc = (parseFloat(amount) / rate).toFixed(8);
        } catch (e) { console.error('CoinGecko fallback failed:', e); }
    }

    // Store the order in Firestore with all necessary details
    await db.collection('orders').doc(payment.id).set({
      orderId: payment.id,
      username,
      game,
      amount,
      btc,
      method,
      status: 'pending',
      invoice,
      created: Timestamp.now(),
      expiresAt,
      read: false,
      reference: uniqueReference,
      success_url: final_success_url, // Store the correct URL
    });

    return res.status(200).json({ orderId: payment.id, invoice, btc, expiresAt });
  } catch (err) {
    console.error('Payment creation error:', err);
    return res.status(500).json({ message: 'Payment creation failed', error: err.message });
  }
}