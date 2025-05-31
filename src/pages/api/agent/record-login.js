// pages/api/agent/record-login.js
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({ message: 'Agent ID is required.' });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Create a new login session document
    const loginDocRef = await db.collection('agents').doc(agentId).collection('workHours').add({
      loginTime: now.toISOString(),
      logoutTime: null, // Will be updated on logout
      date: today,
      agentId: agentId, // Redundant but good for queries
    });

    res.status(200).json({ success: true, message: 'Login time recorded.', loginSessionId: loginDocRef.id });
  } catch (error) {
    console.error('Error recording agent login time:', error);
    res.status(500).json({ message: 'Failed to record login time.', error: error.message });
  }
}
