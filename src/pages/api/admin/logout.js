// pages/api/admin/logout.js
import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Clear the admin_auth cookie
  res.setHeader('Set-Cookie', serialize('admin_auth', '', {
    path: '/',
    maxAge: -1, // Expire the cookie immediately
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }));

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}