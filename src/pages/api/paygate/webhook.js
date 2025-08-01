// src/pages/api/paygate/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  // Paygate sends a GET request to the callback URL
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, value_coin, number } = req.query;

  if (!orderId) {
    return res.status(400).json({ error: 'Missing order ID.' });
  }

  const orderRef = db.collection('orders').doc(orderId);

  try {
    const doc = await orderRef.get();
    if (!doc.exists) {
        return res.status(404).json({error: 'Order not found.'});
    }

    // Update the order in your database to "paid"
    await orderRef.update({
      status: 'paid',
      paidAt: Timestamp.now(),
      read: false, 
      amountReceived: parseFloat(value_coin || doc.data().amount),
      transactionSignature: number || 'N/A', 
    });
    
    res.status(200).json({ success: true, message: "Callback received." });

  } catch (err) {
    console.error(`Firestore update failed for Paygate order ${orderId}:`, err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
}