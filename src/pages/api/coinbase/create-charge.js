// src/pages/api/coinbase/create-charge.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, game, amount } = req.body;
  if (!username || !game || !amount) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const COINBASE_API_KEY = process.env.COINBASE_COMMERCE_API_KEY;

  // This is the unique ID for your order in your system
  const orderId = `LUCKYPAWS-CB-${Date.now()}`;

  try {
    const response = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CC-Api-Key': COINBASE_API_KEY,
            'X-CC-Version': '2018-03-22'
        },
        body: JSON.stringify({
            name: 'Game Credits',
            description: `Credits for ${game}`,
            local_price: {
                amount: amount,
                currency: 'USD'
            },
            pricing_type: 'fixed_price',
            metadata: {
                orderId: orderId,
                username: username,
                game: game,
            },
            // The user will be sent back here after the payment
            redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/coinbase/receipt?orderId=${orderId}`,
            cancel_url: process.env.NEXT_PUBLIC_BASE_URL,
        }),
    });

    const charge = await response.json();

    if (!response.ok || !charge.data?.code) {
      console.error('Invalid response from Coinbase Commerce:', charge);
      return res.status(500).json({ message: 'Invalid response from payment gateway', details: charge.error?.message });
    }

    // Store the order in Firestore
    await db.collection('orders').doc(orderId).set({
      orderId: orderId,
      username,
      game,
      amount: parseFloat(amount),
      method: 'coinbase',
      status: 'pending', // Status is pending until webhook confirms payment
      created: Timestamp.now(),
      read: false,
      chargeCode: charge.data.code, // Save the unique code from Coinbase
    });

    // Send the charge code back to the frontend
    res.status(200).json({ chargeCode: charge.data.code });

  } catch (err) {
    console.error('Coinbase charge creation error:', err);
    res.status(500).json({ message: 'Payment creation failed', error: err.message });
  }
}