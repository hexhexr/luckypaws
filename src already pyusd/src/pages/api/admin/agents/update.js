// src/pages/api/admin/agents/update.js
import { auth, db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Admin identity is verified by the withAuth middleware
  const { uid, name, pageCode } = req.body;

  if (!uid || !name || !pageCode) {
    return res.status(400).json({ message: 'Agent UID, name, and page code are required.' });
  }

  if (typeof pageCode !== 'string' || !/^\d{4}$/.test(pageCode)) {
    return res.status(400).json({ message: 'Page Code must be exactly 4 digits.' });
  }

  try {
    // Update the user's display name in Firebase Authentication
    await auth.updateUser(uid, { displayName: name });

    // Update the agent's document in the Firestore 'users' collection
    await db.collection('users').doc(uid).update({
      name: name,
      pageCode: pageCode
    });

    res.status(200).json({ success: true, message: 'Agent details updated successfully.' });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ message: 'Failed to update agent details.', error: error.message });
  }
};

export default withAuth(handler);