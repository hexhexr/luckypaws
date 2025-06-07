// pages/api/admin/logout.js
// Import the utility from lib/auth.js
import { clearAuthCookie } from '../../../lib/auth'; // Adjust path if your lib folder is elsewhere

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Use the utility function to clear the authentication cookie
  clearAuthCookie(res);

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}