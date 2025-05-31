// pages/api/agent/submit-cashout-request.js
import { db } from '../../../lib/firebaseAdmin'; // Use firebaseAdmin for server-side writes
import { serverTimestamp } from 'firebase-admin/firestore'; // Import serverTimestamp from admin SDK

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { agentId, agentName, amount } = req.body;

  // Basic validation
  if (!agentId || !agentName || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Agent ID, Name, and a valid positive Amount are required.' });
  }

  try {
    // Add the cashout request to a new collection
    // This collection will store requests from agents for their own cashouts (e.g., salary, commission)
    // It's distinct from the 'cashouts' collection which tracks customer cashouts.
    await db.collection('agentCashoutRequests').add({
      agentId: agentId,
      agentName: agentName,
      amount: parseFloat(amount),
      status: 'pending', // Initial status: pending, can be approved/rejected by admin
      requestedAt: serverTimestamp(), // Use serverTimestamp for consistency
    });

    res.status(200).json({ success: true, message: 'Cashout request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting agent cashout request:', error);
    res.status(500).json({ message: 'Failed to submit cashout request.', error: error.message });
  }
}
