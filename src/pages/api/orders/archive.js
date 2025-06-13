// pages/api/orders/archive.js
import { db } from '../../../lib/firebaseAdmin.js';
import { withAuth } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ message: 'Missing order ID' });
  }

  try {
    const orderRef = db.collection('orders').doc(id);
    await orderRef.update({
      status: 'archived',
      archivedAt: new Date().toISOString(),
    });
    res.status(200).json({ success: true, message: 'Order archived successfully.' });
  } catch (err) {
    console.error('Failed to archive order:', err);
    res.status(500).json({ message: 'Archive failed. See server logs for details.' });
  }
};

export default withAuth(handler);