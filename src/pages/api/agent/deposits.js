// src/pages/api/agent/deposits.js
import { db } from '../../../lib/firebaseAdmin';
import { withAgentAuth } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const depositsSnapshot = await db
      .collection('orders')
      .where('status', '==', 'paid')
      .orderBy('created', 'desc')
      .limit(15)
      .get();

    const deposits = await Promise.all(
      depositsSnapshot.docs.map(async (doc) => {
        const orderData = doc.data();
        let facebookName = 'N/A';

        // BUG FIX: Look up the facebookName from the 'customers' collection,
        // which is the correct source of truth managed by the agent.
        if (orderData.username) {
          const customerSnapshot = await db.collection('customers').where('username', '==', orderData.username).limit(1).get();
          if (!customerSnapshot.empty) {
            facebookName = customerSnapshot.docs[0].data().facebookName || 'N/A';
          }
        }

        return {
          id: doc.id,
          username: orderData.username,
          amount: parseFloat(orderData.amount || 0),
          game: orderData.game,
          facebookName: facebookName, // This will now be correctly populated
          created: orderData.created?.toDate ? orderData.created.toDate().toISOString() : orderData.created,
        };
      })
    );

    res.status(200).json({ success: true, deposits });

  } catch (error) {
    console.error('Error fetching agent deposits:', error);
    res.status(500).json({ message: `Failed to fetch deposits: ${error.message}` });
  }
};

export default withAgentAuth(handler);