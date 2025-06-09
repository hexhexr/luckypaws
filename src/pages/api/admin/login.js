// pages/api/admin/login.js
import { firebaseAdmin } from '../../../lib/firebaseAdmin'; // Ensure this path is correct for your Firebase Admin SDK setup
import { getAuth } from 'firebase-admin/auth'; // Import Firebase Admin Auth

const adminAuth = getAuth(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  // Retrieve admin credentials from environment variables
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const FIREBASE_ADMIN_UID = process.env.FIREBASE_ADMIN_UID; // The UID of your Firebase user designated as admin

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !FIREBASE_ADMIN_UID) {
    console.error('Admin login API: Missing one or more required environment variables (ADMIN_USERNAME, ADMIN_PASSWORD, FIREBASE_ADMIN_UID).');
    return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
  }

  // Simple hardcoded check against environment variables for the admin account
  // For production, consider hashing ADMIN_PASSWORD and comparing it securely,
  // or using a more robust identity provider.
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    try {
      // Create a custom token for the pre-defined admin UID
      // This token will allow the client-side Firebase Auth to sign in
      const customToken = await adminAuth.createCustomToken(FIREBASE_ADMIN_UID);
      console.log(`Custom token generated for admin UID: ${FIREBASE_ADMIN_UID}`);

      // Return the custom token to the client
      return res.status(200).json({ success: true, token: customToken });

    } catch (error) {
      console.error('Error creating custom token for admin:', error);
      return res.status(500).json({ error: 'Failed to generate authentication token.' });
    }
  } else {
    // If credentials do not match
    console.log(`Admin login attempt failed for username: ${username}`);
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
}