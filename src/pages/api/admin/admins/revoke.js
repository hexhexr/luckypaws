// src/pages/api/admin/admins/revoke.js
import { auth, db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uid } = req.body;
  const callingAdminUid = req.decodedToken.uid;

  if (!uid) {
    return res.status(400).json({ message: 'User ID (uid) is required.' });
  }

  // Prevent an admin from revoking their own privileges
  if (uid === callingAdminUid) {
    return res.status(400).json({ message: "You cannot revoke your own admin privileges." });
  }

  try {
    // Set admin claim to false
    await auth.setCustomUserClaims(uid, { admin: false });

    // Update Firestore document
    await db.collection('users').doc(uid).update({
      admin: false,
    });
    
    // Force token refresh on client
    await auth.revokeRefreshTokens(uid);

    res.status(200).json({ success: true, message: 'Admin privileges revoked successfully.' });
  } catch (error) {
    console.error('Error revoking admin privileges:', error);
    res.status(500).json({ message: 'Failed to revoke admin privileges.', error: error.message });
  }
};

export default withAuth(handler);