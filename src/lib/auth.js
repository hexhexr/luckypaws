// lib/auth.js
import { verify } from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
// Assuming firebaseAdmin is initialized and accessible if needed for other parts of auth.
// For authorizeAdmin, we primarily rely on isAuthenticated and env vars.

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // Use a strong secret from environment variables

export const ADMIN_AUTH_COOKIE_NAME = 'admin_auth';

// Function to set the auth cookie (for login API)
export function setAuthCookie(res) {
  const token = 'authenticated'; // Or a proper JWT token if you implement one
  res.setHeader('Set-Cookie', serialize(ADMIN_AUTH_COOKIE_NAME, token, {
    path: '/',
    maxAge: 60 * 60, // 1 hour
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }));
}

// Function to clear the auth cookie (for logout API)
export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(ADMIN_AUTH_COOKIE_NAME, '', {
    path: '/',
    maxAge: -1, // Expire the cookie immediately
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }));
}

// Function to check auth on server-side (for getServerSideProps)
export function isAuthenticated(req) {
  const cookies = parse(req.headers.cookie || '');
  const adminAuth = cookies[ADMIN_AUTH_COOKIE_NAME];

  return adminAuth === 'authenticated';
}

/**
 * Authorizes admin access for API routes.
 * Checks for the 'admin_auth' cookie and returns the FIREBASE_ADMIN_UID as adminId.
 * @param {object} req - The Next.js API request object.
 * @returns {object} An object with 'authenticated' (boolean), 'message' (string, if not authenticated),
 * and 'adminId' (string, if authenticated and FIREBASE_ADMIN_UID is set).
 */
export async function authorizeAdmin(req) {
  if (isAuthenticated(req)) {
    const adminUid = process.env.FIREBASE_ADMIN_UID;
    if (!adminUid) {
      console.warn("FIREBASE_ADMIN_UID environment variable is not set. Admin ID will be 'UNKNOWN_ADMIN_ID'.");
      return { authenticated: true, adminId: 'UNKNOWN_ADMIN_ID' }; // Fallback if UID not set
    }
    return { authenticated: true, adminId: adminUid };
  }
  return { authenticated: false, message: 'Unauthorized: Admin access required.' };
}