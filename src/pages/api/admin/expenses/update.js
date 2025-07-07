// src/pages/api/admin/expenses/update.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, date, category, amount, description } = req.body;

  if (!id || !date || !category || !amount || !description) {
    return res.status(400).json({ message: 'Missing required fields for update.' });
  }

  try {
    const expenseRef = db.collection('expenses').doc(id);
    await expenseRef.update({
      date: new Date(date),
      category,
      amount: parseFloat(amount),
      description,
    });
    res.status(200).json({ success: true, message: 'Expense updated successfully.' });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ message: 'Failed to update expense.' });
  }
};

export default withAuth(handler);