// pages/api/agent/record-logout.js
import { db } from '../../../lib/firebaseAdmin';
import { query, collection, where, orderBy, limit, getDocs } from 'firebase/firestore'; // Import Firestore functions

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

    // Find the most recent un-logged-out session for this agent today
    // Note: Firebase Admin SDK's `collection().where().orderBy().limit().get()`
    // is used here, which is different from client-side Firestore.
    // The `query` and `collection` imports are for client-side, but the admin SDK
    // has its own methods.
    const q = db.collection('agents').doc(agentId).collection('workHours')
      .where('date', '==', today)
      .where('logoutTime', '==', null) // Find sessions that haven't been logged out
      .orderBy('loginTime', 'desc')
      .limit(1);

    const snapshot = await q.get();

    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      const loginTime = new Date(snapshot.docs[0].data().loginTime);
      const durationMs = now.getTime() - loginTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60); // Duration in hours

      await docRef.update({
        logoutTime: now.toISOString(),
        durationHours: durationHours,
      });
      res.status(200).json({ success: true, message: 'Logout time recorded and duration calculated.' });
    } else {
      res.status(404).json({ success: false, message: 'No active login session found for today to log out.' });
    }

  } catch (error) {
    console.error('Error recording agent logout time:', error);
    res.status(500).json({ message: 'Failed to record logout time.', error: error.message });
  }
}
