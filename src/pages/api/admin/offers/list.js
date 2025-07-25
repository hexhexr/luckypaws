// src/pages/api/admin/offers/list.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const snapshot = await db.collection('offers').orderBy('createdAt', 'desc').get();
    const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ message: 'Failed to fetch offers.' });
  }
};

export default withAuth(handler);