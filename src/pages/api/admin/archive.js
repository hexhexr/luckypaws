// pages/api/admin/archive.js
import { db } from '../../../lib/firebaseAdmin.js';
import { withAdminAuth } from '../../../lib/withAdminAuth'; // Import the middleware

async function archiveHandler(req, res) {
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
    console.log(`Order ${id} archived successfully by admin ${req.adminUser.uid}`);
    res.status(200).json({ success: true, message: 'Order archived successfully.' });
  } catch (err) {
    console.error('Failed to archive order:', err);
    res.status(500).json({ message: 'Archive failed. See server logs for details.' });
  }
}

export default withAdminAuth(archiveHandler); // Wrap the handler