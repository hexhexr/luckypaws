// src/pages/api/admin/expenses/add.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, category, amount, description } = req.body;

  if (!date || !category || !amount || !description) {
    return res.status(400).json({ message: 'Missing required expense fields.' });
  }
  
  const loggedInUserEmail = req.decodedToken.email;

  try {
    const expenseRef = db.collection('expenses').doc();
    
    await expenseRef.set({
      id: expenseRef.id,
      date: new Date(date), // Storing the date as a proper Date object
      category: category,
      amount: parseFloat(amount),
      description: description,
      recordedBy: loggedInUserEmail,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ success: true, message: 'Expense added successfully', id: expenseRef.id });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: 'Failed to add expense' });
  }
};

export default withAuth(handler);