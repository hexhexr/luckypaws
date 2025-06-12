// pages/api/set-admin-claim.js
// Instead of re-initializing admin, use your existing firebaseAdmin setup
import { auth } from '../../lib/firebaseAdmin'; // Adjust path as needed
import { withAuth } from '../../lib/authMiddleware'; // Import the authentication middleware

const handler = async (req, res) => {
  // This endpoint is critical for setting admin privileges. It should be highly protected.
  // The 'withAuth' middleware will ensure *some* authenticated user is calling it.
  // You might want to add *another* layer of checking here, e.g., only allowing a specific
  // 'super_admin' UID from your environment variables to call this.
  if (req.method !== 'POST') { // It's safer to use POST for sensitive operations like this
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
    // If the error indicates that the requesting user (req.decodedToken.uid) doesn't have permission
    // to call setCustomUserClaims (e.g., if you set up IAM roles), you might want to return 403.
    res.status(500).json({ success: false, message: 'Failed to set admin claim.', error: error.message });
  }
};

export default withAuth(handler); // Wrap the handler with the authentication middleware