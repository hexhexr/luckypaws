// pages/api/set-admin-claim.js
import { auth } from '../../lib/firebaseAdmin';
import { withAuth } from '../../lib/authMiddleware'; // Reinstated auth middleware

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // The 'withAuth' middleware already verifies that the calling user is an admin.
  // The user making this request must have an admin claim to proceed.

  const { uid, isAdmin } = req.body;

  if (!uid || typeof isAdmin === 'undefined' || typeof isAdmin !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Missing or invalid user ID (uid) or isAdmin flag (boolean).' });
  }

  try {
    // Set the custom claim.
    await auth.setCustomUserClaims(uid, { admin: isAdmin });
    console.log(`Successfully set custom claims for user ${uid}: { admin: ${isAdmin} }`);

    // Force a token refresh on the client side for the changes to take effect immediately.
    await auth.revokeRefreshTokens(uid);
    console.log(`Revoked refresh tokens for user ${uid} to force token refresh.`);

    return res.status(200).json({ success: true, message: `Admin claim set to ${isAdmin} for user ${uid}.` });

  } catch (error) {
    console.error('Error setting custom admin claim:', error);
    res.status(500).json({ success: false, message: 'Failed to set admin claim.', error: error.message });
  }
};

export default withAuth(handler);