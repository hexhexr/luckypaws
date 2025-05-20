// pages/api/admin/cashouts/add.js
import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, amount, description } = req.body;

  if (!username || !amount) {
    return res.status(400).json({ message: 'Missing username or amount' });
  }

  try {
    const cashoutRef = db.collection('profitLoss').doc(); // Auto-generate ID
    await cashoutRef.set({
      id: cashoutRef.id, // Store ID within the document
      username: username,
      amount: parseFloat(amount), // Ensure amount is stored as a number
      type: 'cashout', // Explicitly mark as cashout
      description: description || '', // Optional description
      time: new Date().toISOString(), // Timestamp for the cashout
      addedBy: 'admin', // You might want to track which admin added it
    });

    res.status(201).json({ success: true, message: 'Cashout added successfully', cashoutId: cashoutRef.id });
  } catch (error) {
    console.error('Error adding cashout:', error);
    res.status(500).json({ message: 'Failed to add cashout' });
  }
}