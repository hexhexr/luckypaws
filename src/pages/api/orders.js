// pages/api/orders.js
import { db } from '../../lib/firebaseAdmin.js';

// This endpoint is now ONLY for fetching a single public receipt. It is not authenticated.
export default async function handler(req, res) {
  const { id } = req.query;

  // FIX: This endpoint now ONLY supports fetching a single order by ID for the public receipt page.
  // List fetching has been removed to prevent leaking data.
  if (req.method !== 'GET' || !id) {
    return res.status(400).json({ message: 'Method not allowed or missing order ID.' });
  }

  try {
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const orderData = doc.data();

    // Return only the data needed for the receipt to minimize data exposure.
    const receiptData = {
        orderId: orderData.orderId,
        username: orderData.username,
        game: orderData.game,
        amount: orderData.amount,
        btc: orderData.btc,
        status: orderData.status,
        invoice: orderData.invoice, // Include for user reference
    };

    return res.status(200).json(receiptData);

  } catch (err) {
    console.error('Public receipt fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
}