// pages/api/admin/cashouts/add.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, amount, description } = req.body;

  if (!username || typeof amount === 'undefined' || amount === null || isNaN(parseFloat(amount))) {
    return res.status(400).json({ message: 'Missing or invalid username or amount' });
  }
  
  const loggedInUserEmail = req.decodedToken.email; // from withAuth middleware

  try {
    const cashoutRef = db.collection('profitLoss').doc();
    await cashoutRef.set({
      id: cashoutRef.id,
      username: username.toLowerCase().trim(),
      amount: parseFloat(amount),
      type: 'cashout', // Explicitly mark as cashout
      description: description || 'Manual admin entry',
      time: new Date().toISOString(),
      addedBy: loggedInUserEmail, // Track which admin added it
      status: 'completed' // Manual entries are considered complete
    });

    res.status(201).json({ success: true, message: 'Cashout added successfully', cashoutId: cashoutRef.id });
  } catch (error) {
    console.error('Error adding cashout:', error);
    res.status(500).json({ message: 'Failed to add cashout' });
  }
};

export default withAuth(handler);