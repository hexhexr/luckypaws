// src/pages/api/agent/add-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { withAgentAuth } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Agent details are securely taken from the verified token
  const { uid: agentId, name: agentName } = req.decodedToken;
  const { username, amount, method, transactionId } = req.body;

  if (!username || !amount || !method || !transactionId || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'All fields are required, and the amount must be a valid number.' });
  }

  try {
    const orderRef = db.collection('orders').doc(); // Create a new document reference

    // Create a new order document that mirrors your other paid deposits
    await orderRef.set({
      orderId: orderRef.id,
      username: username.toLowerCase().trim(),
      amount: parseFloat(amount),
      method: method.toLowerCase(), // 'chime' or 'cashapp'
      game: 'N/A (Manual Deposit)', // Set a default game value
      status: 'paid',
      created: Timestamp.now(),
      paidAt: Timestamp.now(),
      read: false, // Mark as unread for admin dashboard
      paymentGateway: 'Manual',
      addedByAgentId: agentId,
      addedByAgentName: agentName,
      transactionId: transactionId.trim(), // The crucial reference ID
    });

    res.status(201).json({ success: true, message: 'Deposit added successfully!', id: orderRef.id });

  } catch (error) {
    console.error('Error adding manual deposit:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

export default withAgentAuth(handler);