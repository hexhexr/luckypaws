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
    console.log('Speed API payment object:', payment); // Added for debugging Speed API response

    // Validate Speed API response
    if (
      !payment.id ||
      !payment.payment_method_options?.lightning?.payment_request
    ) {
      // Log the full payment object for better debugging in case of invalid response
      console.error('Invalid response from Speed API:', JSON.stringify(payment, null, 2));
      return res.status(500).json({ message: 'Invalid response from Speed API', payment });
    }

    // Lightning invoice from Speed API
    const invoice = payment.payment_method_options.lightning.payment_request;

    // --- START OF ROBUST EXPIRY TIME FIX ---
    let expiresAt = null;
    // Ensure payment.expires_at is a valid number (either number type or parsable string)
    if (typeof payment.expires_at === 'number' && payment.expires_at > 0) {
      expiresAt = payment.expires_at * 1000; // Convert to milliseconds
    } else if (typeof payment.expires_at === 'string') {
      const parsedExpiresAt = Number(payment.expires_at);
      if (!isNaN(parsedExpiresAt) && parsedExpiresAt > 0) {
        expiresAt = parsedExpiresAt * 1000; // Convert to milliseconds
      }
    }
    // --- END OF ROBUST EXPIRY TIME FIX ---

    // BTC calculation (use sats if available, fallback to CoinGecko)
    let btc = 'N/A'; // Default to 'N/A' to indicate calculation issues
    const requestedAmountUSD = parseFloat(amount); // Ensure amount is a number

    // Prioritize Speed API's amount_in_satoshis if available and valid
    if (payment.amount_in_satoshis && typeof payment.amount_in_satoshis === 'number' && payment.amount_in_satoshis > 0) {
      btc = (payment.amount_in_satoshis / 100000000).toFixed(8); // Convert sats to BTC
    } else {
      // Fallback to CoinGecko if sats are not provided or are zero
      try {
        const btcRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        );
        const btcData = await btcRes.json();
        console.log('CoinGecko Data:', btcData); // Added for debugging CoinGecko response
        const rate = btcData?.bitcoin?.usd; // Safely access nested property

        if (rate && typeof rate === 'number' && rate > 0) {
          btc = (requestedAmountUSD / rate).toFixed(8); // Calculate BTC from USD and rate
        } else {
          console.warn('CoinGecko rate not found or invalid:', rate); // Log if rate is problematic
          btc = 'N/A - Rate Error'; // More specific fallback message
        }
      } catch (e) {
        console.error('CoinGecko BTC fallback failed:', e); // Log CoinGecko fetch errors
        btc = 'N/A - CoinGecko Error'; // More specific fallback message
      }
    }

    // Save order with invoice for frontend QR code
    await db.collection('orders').doc(payment.id).set({
      orderId: payment.id,
      username,
      game,
      amount,
      btc, // Use the calculated BTC string
      method,
      status: 'pending',
      invoice, // IMPORTANT: raw Lightning invoice string here
      created: new Date().toISOString(),
      expiresAt: expiresAt, // Store the expiry timestamp in the database
      paidManually: false,
    });

    // Return invoice and orderId for frontend
    // Ensure btc and expiresAt are returned as part of the response
    return res.status(200).json({ orderId: payment.id, invoice, btc, expiresAt });
  } catch (err) {
    console.error('Speed API error:', err);
    return res.status(500).json({ message: 'Speed API failed', error: err.message });
  }
}