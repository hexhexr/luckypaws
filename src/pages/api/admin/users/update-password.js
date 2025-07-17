// src/pages/api/admin/users/update-password.js
import { auth } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Ensure the caller is an admin
  const callingAdminUid = req.decodedToken.uid;
  const { uid, newPassword } = req.body;

  if (!uid || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'User ID and a new password (min 6 characters) are required.' });
  }

  try {
    // An admin can update any user's password
    await auth.updateUser(uid, {
      password: newPassword,
    });

    // For enhanced security, it's a good practice to revoke the user's refresh tokens
    // This will force them to log in again with the new password.
    await auth.revokeRefreshTokens(uid);

    res.status(200).json({ success: true, message: 'User password updated successfully. The user will be required to log in again.' });
  } catch (error) {
    console.error(`Error updating password for user ${uid} by admin ${callingAdminUid}:`, error);
    res.status(500).json({ message: 'Failed to update user password.', error: error.message });
  }
};

export default withAuth(handler);