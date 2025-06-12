// pages/api/set-admin-claim.js
// Temporarily removed withAuth for initial admin setup.
// REMEMBER TO RE-ADD 'withAuth' AFTER SETTING YOUR FIRST ADMIN USER FOR SECURITY!
import { auth } from '../../lib/firebaseAdmin'; // Adjust path as needed
// import { withAuth } from '../../lib/authMiddleware'; // Temporarily commented out

const handler = async (req, res) => {
  // This endpoint is critical for setting admin privileges. It should be highly protected.
  // TEMPORARY: withAuth has been removed to allow initial admin setup.
  // RE-ENABLE withAuth (and consider a super-admin check) immediately after first admin is set!
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uid, isAdmin } = req.body; // Expect uid and isAdmin (boolean) in the request body

  if (!uid || typeof isAdmin === 'undefined' || typeof isAdmin !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Missing or invalid user ID (uid) or isAdmin flag (boolean).' });
  }

  try {
    // Set the custom claim. 'admin: true' grants admin privileges. 'admin: false' revokes them.
    await auth.setCustomUserClaims(uid, { admin: isAdmin });
    console.log(`Successfully set custom claims for user ${uid}: { admin: ${isAdmin} }`);

    // Force a token refresh on the client side for the changes to take effect immediately
    await auth.revokeRefreshTokens(uid);
    console.log(`Revoked refresh tokens for user ${uid} to force token refresh.`);

    return res.status(200).json({ success: true, message: `Admin claim set to ${isAdmin} for user ${uid}. User token refreshed.` });

  } catch (error) {
    console.error('Error setting custom admin claim:', error);
    res.status(500).json({ success: false, message: 'Failed to set admin claim.', error: error.message });
  }
};

export default handler; // Exporting handler directly without withAuth