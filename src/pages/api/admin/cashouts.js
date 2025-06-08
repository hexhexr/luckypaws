// pages/api/admin/cashouts.js
import { db } from '../../../lib/firebaseAdmin'; // Corrected path

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Add basic authentication check for admin panel
  // IMPORTANT: For production, implement robust authentication (e.g., JWT token validation)
  const adminAuth = req.headers['x-admin-auth']; // Or read from a cookie if set
  if (adminAuth !== process.env.ADMIN_SECRET_KEY && process.env.NODE_ENV !== 'development') {
    // In a real app, you'd verify a secure session token/JWT here
    console.warn('Unauthorized access attempt to /api/admin/cashouts');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const cashoutsRef = db.collection('profitLoss');
    // Fetch only documents where type is 'cashout_lightning'
    const snapshot = await cashoutsRef.where('type', '==', 'cashout_lightning').get();

    const cashouts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(cashouts);
  } catch (error) {
    console.error('Error fetching cashout history:', error);
    res.status(500).json({ message: 'Failed to fetch cashout history.' });
  }
}