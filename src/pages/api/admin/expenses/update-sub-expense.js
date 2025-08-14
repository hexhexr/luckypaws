// src/pages/api/admin/expenses/update-sub-expense.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, date, amount, description } = req.body;

  if (!id || !date || !amount || !description) {
    return res.status(400).json({ message: 'Missing required fields for update.' });
  }

  try {
    const subExpenseRef = db.collection('subExpenses').doc(id);
    await subExpenseRef.update({
      date: new Date(date),
      amount: parseFloat(amount),
      description,
    });
    res.status(200).json({ success: true, message: 'Sub-expense updated successfully.' });
  } catch (error) {
    console.error('Error updating sub-expense:', error);
    res.status(500).json({ message: 'Failed to update sub-expense.' });
  }
};

export default withAuth(handler);