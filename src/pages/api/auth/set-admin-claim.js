// src/pages/api/auth/set-admin-claim.js
import { firebaseAdmin } from '../../../lib/firebaseAdmin'; // Your initialized Admin SDK instance
import { verifyIdToken } from '../../../lib/auth'; // Re-use the token verification function

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify the ID token sent from the client
  const decodedToken = await verifyIdToken(req);

  if (!decodedToken) {
    return res.status(401).json({ message: 'Unauthorized: Invalid ID token.' });
  }

  const userEmail = decodedToken.email;
  const userUid = decodedToken.uid;
  const superAdminEmail = process.env.FIREBASE_SUPER_ADMIN_EMAIL; // Ensure this is set in Vercel

  if (!superAdminEmail) {
    console.error("FIREBASE_SUPER_ADMIN_EMAIL is not set in Vercel environment variables!");
    return res.status(500).json({ message: 'Server configuration error: Super Admin email not defined.' });
  }

  try {
    if (userEmail === superAdminEmail) {
      // Set 'admin' custom claim for the super-admin's UID
      await firebaseAdmin.auth().setCustomUserClaims(userUid, { role: 'admin' });

      // Optionally, also update Firestore /users document for display/data persistence
      // Note: Firebase Security Rules should primarily rely on custom claims for access control.
      await firebaseAdmin.firestore().collection('users').doc(userUid).set({
        email: userEmail,
        role: 'admin', // Store role for data purposes, but claims are for security rules
        lastLogin: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({ message: 'Admin claim set successfully.' });
    } else {
      // For any other authenticated user who is not the super admin email,
      // ensure they don't have admin claims (or set a default 'user' role)
      await firebaseAdmin.auth().setCustomUserClaims(userUid, { role: 'user' }); // Clear any accidental claims
      return res.status(403).json({ message: 'Forbidden: Your email is not a designated super admin.' });
    }
  } catch (error) {
    console.error("Error setting custom claims:", error);
    return res.status(500).json({ message: 'Failed to set admin claim.' });
  }
}