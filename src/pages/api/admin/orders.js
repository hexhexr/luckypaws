// pages/api/admin/orders.js
import { db } from '../../lib/firebaseAdmin.js';
import { withAdminAuth } from '../../lib/withAdminAuth'; // Import the middleware

async function ordersHandler(req, res) {
  const { id, limit = 100 } = req.query;

  try {
    if (id) {
      const doc = await db.collection('orders').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res.status(200).json({ id: doc.id, ...doc.data() });
    }

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

export default withAdminAuth(ordersHandler); // Wrap the handler