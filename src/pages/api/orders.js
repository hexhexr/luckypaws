import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { id, limit = 50, startAfter } = req.query;

  try {
    if (id) {
      const doc = await db.collection('orders').doc(id).get();
      if (!doc.exists) return res.status(404).json({ message: 'Order not found' });
      return res.status(200).json(doc.data());
    }

    let query = db.collection('orders').orderBy('created', 'desc').limit(Number(limit));
    if (startAfter) {
      const doc = await db.collection('orders').doc(startAfter).get();
      if (doc.exists) query = query.startAfter(doc);
    }

    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => doc.data());

    return res.status(200).json(orders);
  } catch (err) {
    console.error('Fetch order error:', err);
    res.status(500).json({ message: 'Failed to fetch order(s)' });
  }
}
