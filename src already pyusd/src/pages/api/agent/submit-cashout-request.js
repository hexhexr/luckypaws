// pages/api/agent/submit-cashout-request.js
import { db } from '../../../lib/firebaseAdmin';
import { serverTimestamp } from 'firebase-admin/firestore';
// BUG FIX: Replaced incorrect admin 'withAuth' with the correct 'withAgentAuth' middleware.
import { withAgentAuth } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // The agent's identity is now securely provided by the withAgentAuth middleware
  // via the decoded token, preventing spoofing from the request body.
  const { uid: agentId, name: agentName, email: agentEmail } = req.decodedToken;
  const { amount } = req.body;

  // Basic validation for the amount from the request body
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'A valid positive amount is required.' });
  }

  try {
    // Add the cashout request to the dedicated collection for agent requests.
    // This keeps agent commission/salary requests separate from customer cashouts.
    await db.collection('agentCashoutRequests').add({
      agentId,
      agentName: agentName || agentEmail, // Use name from token, fallback to email
      agentEmail,
      amount: parseFloat(amount),
      status: 'pending', // Initial status is 'pending' for admin approval
      requestedAt: serverTimestamp(), // Use server timestamp for accuracy
    });

    res.status(200).json({ success: true, message: 'Cashout request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting agent cashout request:', error);
    res.status(500).json({ message: 'Failed to submit cashout request.', error: error.message });
  }
};

// Wrap the handler with the correct agent authentication middleware.
export default withAgentAuth(handler);