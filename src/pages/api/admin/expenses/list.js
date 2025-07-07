// src/pages/api/admin/expenses/list.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const expensesSnapshot = await db.collection('expenses').orderBy('date', 'desc').get();
    const expenses = expensesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Failed to fetch expenses.' });
  }
};

export default withAuth(handler);