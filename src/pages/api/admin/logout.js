// pages/api/admin/logout.js
import { clearAuthCookie } from '../../../lib/auth'; // Adjust path as needed

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Use the utility to clear the cookie
  clearAuthCookie(res);

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}