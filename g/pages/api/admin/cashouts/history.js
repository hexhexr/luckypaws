// pages/api/admin/cashouts/history.js
import { db } from '../../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const cashoutsSnapshot = await db.collection('cashouts').orderBy('time', 'desc').limit(50).get();
    const cashouts = cashoutsSnapshot.docs.map(doc => doc.data());
    res.status(200).json(cashouts);
  } catch (error) {
    console.error('Error fetching cashout history:', error);
    res.status(500).json({ message: 'Failed to fetch cashout history.' });
  }
}