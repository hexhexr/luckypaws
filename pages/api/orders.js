import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    if (id) {
      const doc = await db.collection('orders').doc(id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Order not found' });
      return res.status(200).json(doc.data());
    }

    const snapshot = await db.collection('orders').get();
    const orders = snapshot.docs.map(doc => doc.data());
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Order fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch order(s)' });
  }
}
