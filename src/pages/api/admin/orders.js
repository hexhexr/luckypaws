// pages/api/admin/orders.js
import { db } from '../../lib/firebaseAdmin'; // Ensure correct path to your firebaseAdmin.js
import withAdminAuth from '../../lib/withAdminAuth'; // Import the withAdminAuth middleware

async function handler(req, res) {
  const { id, limit = 100 } = req.query;

  try {
    if (req.method === 'GET') {
      if (id) {
        const doc = await db.collection('orders').doc(id).get();
        if (!doc.exists) {
          return res.status(404).json({ message: 'Order not found' });
        }
        return res.status(200).json({ id: doc.id, ...doc.data() });
      }

      const query = db.collection('orders')
                    .orderBy('created', 'desc')
                    .limit(Number(limit));

      const snapshot = await query.get();
      const orders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Convert Timestamp to ISO string or just keep it as is if client can handle Timestamp
        created: doc.data().created ? doc.data().created.toDate().toISOString() : null 
      }));

      return res.status(200).json(orders);
    } else if (req.method === 'DELETE') {
      // Handle DELETE request for orders (e.g., permanent deletion)
      if (!id) {
        return res.status(400).json({ message: 'Order ID is required for deletion.' });
      }
      await db.collection('orders').doc(id).delete();
      return res.status(200).json({ success: true, message: 'Order deleted successfully.' });
    } else {
      res.status(405).json({ message: 'Method Not Allowed' });
    }
  } catch (err) {
    console.error('API Error for /api/admin/orders:', err);
    res.status(500).json({ message: 'Failed to process request.' });
  }
}

// Export the handler wrapped with the authentication middleware
export default withAdminAuth(handler);