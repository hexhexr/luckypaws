// pages/api/admin/cashouts/add.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, amount, description } = req.body;

  if (!username || !username.trim() || typeof amount === 'undefined' || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Missing or invalid username or amount.' });
  }
  
  // Get admin identity from the verified token
  const loggedInUserEmail = req.decodedToken.email;

  try {
    // BUG FIX: Write to the 'cashouts' collection to unify all cashout data.
    // This ensures consistency with automated cashouts and correct reporting.
    const cashoutRef = db.collection('cashouts').doc();
    
    await cashoutRef.set({
      id: cashoutRef.id,
      username: username.toLowerCase().trim(),
      amountUSD: parseFloat(amount), // Standardize field name to amountUSD
      amountSats: 0, // Manual entries don't have a sats equivalent unless calculated
      type: 'cashout_manual', // Be specific about the type
      description: description || 'Manual admin entry',
      time: Timestamp.now(), // Use Firestore Server Timestamp
      addedBy: loggedInUserEmail, // Track which admin added it
      status: 'completed', // Manual entries are considered completed by definition
      destination: 'N/A (Manual)',
    });

    res.status(201).json({ success: true, message: 'Manual cashout added successfully', id: cashoutRef.id });
  } catch (error) {
    console.error('Error adding manual cashout:', error);
    res.status(500).json({ message: 'Failed to add manual cashout' });
  }
};

export default withAuth(handler);