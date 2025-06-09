// lib/withAdminAuth.js
import { firebaseAdmin } from './firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { serialize } from 'cookie';

const auth = getAuth(firebaseAdmin);

export default function withAdminAuth(handler) {
  return async (req, res) => {
    try {
      const sessionCookie = req.cookies.admin_session || ''; // Correctly looks for 'admin_session'

      const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

      req.adminUser = decodedClaims;

      return handler(req, res);
    } catch (error) {
      console.error('Admin authentication failed:', error.message);

      // Clear the session cookie if it's invalid/expired
      res.setHeader('Set-Cookie', serialize('admin_session', '', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: -1, // Expire the cookie immediately
      }));

      return res.status(401).json({ message: 'Unauthorized' });
    }
  };
}