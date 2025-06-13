// pages/api/admin/agents/revoke.js
import { auth, db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ message: 'User ID (uid) is required.' });
  }

  try {
    // Set agent claim to false
    await auth.setCustomUserClaims(uid, { agent: false });

    // Update Firestore document
    await db.collection('users').doc(uid).update({
      agent: false,
    });
    
    // Force token refresh on client
    await auth.revokeRefreshTokens(uid);

    res.status(200).json({ success: true, message: 'Agent privileges revoked successfully.' });
  } catch (error) {
    console.error('Error revoking agent privileges:', error);
    res.status(500).json({ message: 'Failed to revoke agent privileges.', error: error.message });
  }
};

export default withAuth(handler);