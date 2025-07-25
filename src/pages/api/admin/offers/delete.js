// src/pages/api/admin/offers/delete.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ message: 'Offer ID is required.' });
  }

  try {
    await db.collection('offers').doc(id).delete();
    res.status(200).json({ success: true, message: 'Offer deleted successfully.' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ message: 'Failed to delete offer.' });
  }
};

export default withAuth(handler);