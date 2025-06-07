// pages/api/auth/set-admin-claim.js
import { firebaseAdmin } from '../../../lib/firebaseAdmin'; // Your initialized Admin SDK instance
import { verifyIdToken } from '../../../lib/auth'; // Re-use the token verification function

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const decodedToken = await verifyIdToken(req);

  if (!decodedToken) {
    return res.status(401).json({ message: 'Unauthorized: Invalid ID token.' });
  }

  const userEmail = decodedToken.email;
  const userUid = decodedToken.uid;
  const superAdminEmail = process.env.FIREBASE_SUPER_ADMIN_EMAIL;

  if (!superAdminEmail) {
    console.error("FIREBASE_SUPER_ADMIN_EMAIL is not set in Vercel environment variables!");
    return res.status(500).json({ message: 'Server configuration error: Super Admin email not defined.' });
  }

  try {
    if (userEmail === superAdminEmail) {
      // Set 'admin' custom claim for the super-admin
      await firebaseAdmin.auth().setCustomUserClaims(userUid, { role: 'admin' });

      // Optionally, also update Firestore /users document for display/data persistence
      await firebaseAdmin.firestore().collection('users').doc(userUid).set({
        email: userEmail,
        role: 'admin', // Keep this for data, but rules use claims
        lastLogin: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({ message: 'Admin claim set successfully.' });
    } else {
      // For any other authenticated user, ensure they don't have admin claims
      // and/or clear any accidental admin claims if they somehow got one.
      await firebaseAdmin.auth().setCustomUserClaims(userUid, { role: 'user' }); // Or just {} to clear.
      return res.status(403).json({ message: 'Forbidden: Not a designated super admin email.' });
    }
  } catch (error) {
    console.error("Error setting custom claims:", error);
    return res.status(500).json({ message: 'Failed to set admin claim.' });
  }
}