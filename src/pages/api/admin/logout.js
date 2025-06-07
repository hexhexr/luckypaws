// src/pages/api/admin/logout.js
import { clearAuthCookie } from '../../../lib/auth'; // Import from your server-side lib/auth.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    clearAuthCookie(res); // Clear the authentication cookie

    // If you're also managing client-side Firebase auth sessions, you would call firebase.auth().signOut()
    // on the client-side after this API call or in a separate client-side action.

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ message: 'Logout failed.' });
  }
}