// src/pages/api/admin/expenses/delete.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Expense ID is required.' });
  }

  try {
    await db.collection('expenses').doc(id).delete();
    res.status(200).json({ success: true, message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: 'Failed to delete expense.' });
  }
};

export default withAuth(handler);