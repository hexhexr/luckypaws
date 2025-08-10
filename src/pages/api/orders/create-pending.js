// src/pages/api/orders/create-pending.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, game, amount, method } = req.body;
  if (!username || !game || !amount || !method) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
    const orderRef = db.collection('orders').doc();
    const orderId = orderRef.id;

    await orderRef.set({
      orderId: orderId,
      username,
      game,
      amount: parseFloat(amount),
      method,
      status: 'pending',
      created: Timestamp.now(),
      read: false,
    });

    res.status(201).json({ success: true, orderId: orderId });
  } catch (err) {
    console.error('Error creating pending order:', err);
    res.status(500).json({ message: 'Failed to create order.' });
  }
}