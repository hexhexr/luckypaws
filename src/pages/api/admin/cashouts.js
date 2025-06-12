// pages/api/admin/cashouts.js
import { db } from '../../../lib/firebaseAdmin'; // Corrected path
import { withAuth } from '../../../lib/authMiddleware'; // Import the authentication middleware

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // The 'withAuth' middleware handles authentication, so the manual 'x-admin-auth' check is redundant here.
  // It's commented out because withAuth will handle proper token verification.
  // const adminAuth = req.headers['x-admin-auth']; 
  // if (adminAuth !== process.env.ADMIN_SECRET_KEY && process.env.NODE_ENV !== 'development') {
  //   console.warn('Unauthorized access attempt to /api/admin/cashouts');
  //   return res.status(401).json({ message: 'Unauthorized' });
  // }

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
};

export default withAuth(handler); // Wrap the handler with the authentication middleware