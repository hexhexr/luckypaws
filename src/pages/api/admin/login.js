// src/pages/api/admin/login.js
// This API route handles custom username/password validation for admin login
// and generates a Firebase Custom Token upon success.

import { auth as adminAuth } from '../../../lib/firebaseAdmin'; // Corrected import path

export default async function handler(req, res) {
  // Ensure only POST requests are allowed for login attempts.
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  // Load environment variables directly within the handler
  const VALID_ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const VALID_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  // Perform the custom validation against environment variables
  if (username === VALID_ADMIN_USERNAME && password === VALID_ADMIN_PASSWORD) {
    try {
      // Get the Firebase UID for your "master" admin account from environment variables.
      const adminFirebaseUid = process.env.FIREBASE_ADMIN_UID;
      
      if (!adminFirebaseUid) {
          console.error("FIREBASE_ADMIN_UID environment variable is not set!");
          return res.status(500).json({ success: false, message: "Server configuration error: Admin UID missing." });
      }

      // --- ADD THIS CONSOLE.LOG ---
      console.log('Attempting to create custom token for UID:', adminFirebaseUid);
      // --- END ADDITION ---

      // Generate a Firebase Custom Token for the specific admin UID
      const customToken = await adminAuth.createCustomToken(adminFirebaseUid, { admin: true });
      
      console.log('Admin login: Credentials MATCHED. Custom token generated.');
      
      // Return the custom token to the client
      return res.status(200).json({ success: true, message: 'Admin login successful.', token: customToken });

    } catch (error) {
      console.error('Error generating Firebase custom token:', error);
      // Log the full error object for more details
      console.error('Full error details:', error); 
      return res.status(500).json({ success: false, message: 'Failed to generate authentication token.' });
    }
  } else {
    console.log('Admin login: Credentials MISMATCH.');
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }
}
