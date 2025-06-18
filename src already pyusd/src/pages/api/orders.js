// pages/api/orders.js
import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { id, limit = 100 } = req.query;

  try {
    // Handle request for a single specific order
    if (id) {
      const doc = await db.collection('orders').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }
      // Return the single document's data
      return res.status(200).json({ id: doc.id, ...doc.data() });
    }

    // Handle request for a list of orders
    // BUG FIX: Removed the restrictive 'where' clause. The frontend (admin dashboard)
    // is designed to handle and filter all statuses. This ensures the initial data load
    // is consistent with the subsequent real-time snapshot listener.
    const query = db.collection('orders')
                  .orderBy('created', 'desc')
                  .limit(Number(limit));

    const snapshot = await query.get();
    const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            // Ensure timestamp is consistently formatted as an ISO string for serialization
            created: data.created?.toDate ? data.created.toDate().toISOString() : data.created
        };
    });

    return res.status(200).json(orders);
  } catch (err) {
    console.error('Fetch order error:', err);
    res.status(500).json({ message: 'Failed to fetch order(s)' });
  }
}