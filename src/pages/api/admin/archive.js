// pages/api/admin/orders/archive.js
import { db } from '../../../lib/firebaseAdmin'; // Ensure correct path
import withAdminAuth from '../../../lib/withAdminAuth'; // Import the withAdminAuth middleware

async function handler(req, res) {
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
      archivedAt: new Date().toISOString(), // Use ISO string for consistency
    });
    console.log(`Order ${id} archived successfully by admin.`);
    res.status(200).json({ success: true, message: 'Order archived successfully.' });
  } catch (err) {
    console.error('Failed to archive order:', err);
    res.status(500).json({ message: 'Archive failed. See server logs for details.' });
  }
}

// Export the handler wrapped with the authentication middleware
export default withAdminAuth(handler);