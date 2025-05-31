// pages/api/admin/login.js
import { auth as adminAuth } from '../../lib/firebaseAdmin'; // Import Firebase Admin Auth

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  // --- BEGIN DEBUGGING LOGS (REMOVE AFTER CONFIRMATION) ---
  console.log('--- Admin Login Attempt (Custom Token Flow) ---');
  console.log('Received Username:', username);
  console.log('Received Password:', password ? '********' : 'undefined');
  const VALID_ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const VALID_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  console.log('Expected Username (from env):', VALID_ADMIN_USERNAME);
  console.log('Expected Password (from env):', VALID_ADMIN_PASSWORD ? '********' : 'undefined');
  // --- END DEBUGGING LOGS ---

  // Perform the custom validation against environment variables
  if (username === VALID_ADMIN_USERNAME && password === VALID_ADMIN_PASSWORD) {
    try {
      // Assuming you have a specific Firebase UID for your "master" admin account.
      // This UID should be the same as the document ID in your 'users' collection for the admin.
      // You created this user in Firebase Auth in "Part 2" of the previous guide.
      const adminFirebaseUid = process.env.FIREBASE_ADMIN_UID; // YOU MUST SET THIS ENV VAR!
      
      if (!adminFirebaseUid) {
          console.error("FIREBASE_ADMIN_UID environment variable is not set!");
          return res.status(500).json({ success: false, message: "Server configuration error: Admin UID missing." });
      }

      // Generate a Firebase Custom Token for the specific admin UID
      const customToken = await adminAuth.createCustomToken(adminFirebaseUid, { admin: true });
      
      console.log('Admin login: Credentials MATCHED. Custom token generated.');
      
      // Return the custom token to the client
      return res.status(200).json({ success: true, message: 'Admin login successful.', token: customToken });

    } catch (error) {
      console.error('Error generating Firebase custom token:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate authentication token.' });
    }
  } else {
    console.log('Admin login: Credentials MISMATCH.');
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }
}
