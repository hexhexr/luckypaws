// pages/api/customer-deposits.js
import { db } from '../../lib/firebaseAdmin';
import { withAuth } from '../../lib/authMiddleware'; // This API is admin-protected

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // BUG FIX: The field name is 'created', not 'createdAt'. This caused the query to fail.
    const depositsSnapshot = await db
      .collection('orders')
      .where('status', '==', 'paid')
      .orderBy('created', 'desc') // Corrected field name
      .limit(10)
      .get();

    const lastDeposits = depositsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        amount: parseFloat(data.amount || 0),
        // Ensure timestamp is sent in a consistent, serializable format
        created: data.created?.toDate ? data.created.toDate().toISOString() : null,
      };
    });

    res.status(200).json({
      success: true,
      deposits: lastDeposits,
    });

  } catch (error) {
    console.error('Error fetching customer deposits:', error);
    res.status(500).json({ message: `Failed to fetch customer deposits: ${error.message}` });
  }
};

export default withAuth(handler); // Wrap the handler with admin authentication