import { db } from '../../lib/firebaseAdmin';
import { withAuth } from '../../lib/authMiddleware'; // Import the authentication middleware

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username } = req.query;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const snapshot = await db
      .collection('cashouts') // Assuming cashouts are tracked in a 'cashouts' collection
      .where('username', '==', username.trim().toLowerCase())
      .where('createdAt', '>=', twentyFourHoursAgo) // Assuming a 'createdAt' field
      .get();

    let totalCashouts = 0;
    snapshot.forEach(doc => {
      const amt = parseFloat(doc.data()?.amount || 0); // Assuming 'amount' field in cashouts
      if (!isNaN(amt)) totalCashouts += amt;
    });

    const maxLimit = 300; // Your defined maximum limit
    const remaining = Math.max(0, maxLimit - totalCashouts);

    return res.status(200).json({
      success: true,
      username,
      totalCashoutsToday: totalCashouts,
      remainingLimit: remaining,
    });
  } catch (err) {
    console.error('Error getting cashout limit:', err);
    return res.status(500).json({ message: `Internal error: ${err.message}` });
  }
};

export default withAuth(handler); // Wrap the handler with the authentication middleware