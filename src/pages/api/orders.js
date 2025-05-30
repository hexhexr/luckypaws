import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { id, limit = 100 } = req.query;

  try {
    if (id) {
      const doc = await db.collection('orders').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res.status(200).json({ id: doc.id, ...doc.data() });
    }

    // The query now explicitly excludes statuses that should not appear on the main dashboard.
    // This is the initial data load before the real-time listener takes over.
    const query = db.collection('orders')
                  .where('status', 'in', ['pending', 'paid'])
                  .orderBy('created', 'desc')
                  .limit(Number(limit));

    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json(orders);
  } catch (err) {
    console.error('Fetch order error:', err);
    res.status(500).json({ message: 'Failed to fetch order(s)' });
  }
}