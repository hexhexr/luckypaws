// pages/api/admin/cashouts.js
import { db } from '../../../lib/firebaseAdmin';
import { withAuth } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // FIX: Target the 'cashouts' collection, which is the correct source of truth.
    const cashoutsRef = db.collection('cashouts');
    const snapshot = await cashoutsRef.orderBy('time', 'desc').limit(100).get();

    const cashouts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(cashouts);
  } catch (error) {
    console.error('Error fetching cashout history:', error);
    res.status(500).json({ message: 'Failed to fetch cashout history.' });
  }
};

export default withAuth(handler);