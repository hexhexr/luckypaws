import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const depositsSnapshot = await db
      .collection('orders')
      .where('status', '==', 'paid')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const lastDeposits = depositsSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username,
      amount: parseFloat(doc.data().amount || 0),
      createdAt: doc.data().createdAt,
    }));

    res.status(200).json({
      success: true,
      deposits: lastDeposits,
    });

  } catch (error) {
    console.error('Error fetching customer deposits:', error);
    res.status(500).json({ message: `Failed to fetch customer deposits: ${error.message}` });
  }
}
