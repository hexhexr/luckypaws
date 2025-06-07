// pages/api/admin/login.js
// Import the utility from lib/auth.js
import { setAuthCookie } from '../../../lib/auth'; // Adjust path if your lib folder is elsewhere

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;
  // Use environment variables for admin credentials
  const { ADMIN_USER = 'admin', ADMIN_PASS = '123456' } = process.env;

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing credentials' });
  }

  const isValid = username === ADMIN_USER && password === ADMIN_PASS;

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Use the utility function to set the authentication cookie
  setAuthCookie(res);

  return res.status(200).json({ success: true });
}