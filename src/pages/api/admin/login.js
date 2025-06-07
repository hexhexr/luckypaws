// src/pages/api/admin/login.js
import { setAuthCookie } from '../../../lib/auth'; // Import from your server-side lib/auth.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // --- IMPORTANT: Implement your actual admin verification logic here ---
  // This could be checking a username/password against a database (NOT recommended for admin with Firebase Auth)
  // Or, if this route is for *agents*, it would verify agent credentials.
  // For *super admin* with Gmail, the logic is in /api/auth/set-admin-claim.js

  const { username, password } = req.body; // Example for traditional login fields

  // Placeholder for actual, secure authentication logic
  // REPLACE THIS with a secure credential check (e.g., hashing passwords)
  if (username === 'admin' && password === 'your_super_secure_password') {
    setAuthCookie(res); // Set the cookie after successful verification
    return res.status(200).json({ message: 'Login successful' });
  } else {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
}