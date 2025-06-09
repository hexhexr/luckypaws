// lib/withAdminAuth.js
import { firebaseAdmin } from './firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { serialize } from 'cookie'; // Make sure 'cookie' package is installed (npm install cookie)

const auth = getAuth(firebaseAdmin);

export default function withAdminAuth(handler) {
  return async (req, res) => {
    try {
      // Get the session cookie from the request
      const sessionCookie = req.cookies.admin_session || '';

      // Verify the session cookie
      // The checkRevoked param is important to ensure the cookie hasn't been revoked
      const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

      // If successful, attach the decoded claims (admin user info) to the request
      // You might not need to attach it directly to req if your handler doesn't use it,
      // but it's good practice for context.
      req.adminUser = decodedClaims; 

      // Proceed to the actual API route handler
      return handler(req, res);
    } catch (error) {
      // If session cookie is invalid, expired, or not present
      console.error('Admin authentication failed:', error.message);

      // Clear the session cookie if it's invalid/expired to prevent re-attempts
      res.setHeader('Set-Cookie', serialize('admin_session', '', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: -1, // Expire the cookie immediately
      }));

      return res.status(401).json({ message: 'Unauthorized: Invalid or expired session.' });
    }
  };
}