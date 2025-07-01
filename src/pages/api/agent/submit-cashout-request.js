// pages/api/agent/submit-cashout-request.js
import { db } from '../../../lib/firebaseAdmin';
// FIX: Changed the import from serverTimestamp to Timestamp
import { Timestamp } from 'firebase-admin/firestore'; 
import { withAgentAuth } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uid: agentId, name: agentName, email: agentEmail } = req.decodedToken;
  const { username, facebookName, cashoutAmount, cashoutAddress } = req.body;

  if (!username || !facebookName || !cashoutAmount || !cashoutAddress || isNaN(parseFloat(cashoutAmount)) || parseFloat(cashoutAmount) <= 0) {
    return res.status(400).json({ message: 'All fields are required and amount must be a valid positive number.' });
  }

  try {
    await db.collection('agentCashoutRequests').add({
      agentId,
      agentName: agentName || agentEmail,
      agentEmail,
      username,
      facebookName,
      amount: parseFloat(cashoutAmount),
      address: cashoutAddress,
      status: 'pending',
      // FIX: Changed serverTimestamp() to Timestamp.now() to fix the TypeError
      requestedAt: Timestamp.now(), 
    });

    res.status(200).json({ success: true, message: 'Cashout request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting agent cashout request:', error);
    res.status(500).json({ message: 'Failed to submit cashout request.', error: error.message });
  }
};

export default withAgentAuth(handler);