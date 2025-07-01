// pages/api/orders.js
import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  // Only handle requests with an 'id' parameter.
  const { id } = req.query;

  // If no ID is provided, it's a bad request. Do not return a list of orders.
  if (!id) {
    return res.status(400).json({ message: 'Order ID is required.' });
  }

  try {
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Order not found' });
    }
    // Return the single document's data
    return res.status(200).json({ id: doc.id, ...doc.data() });

  } catch (err) {
    console.error('Fetch order error:', err);
    res.status(500).json({ message: 'Failed to fetch order(s)' });
  }
}