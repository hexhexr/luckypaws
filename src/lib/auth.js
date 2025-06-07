// lib/auth.js
import { verify } from 'jsonwebtoken';
import { serialize, parse } from 'cookie'; // Make sure to import 'parse'

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

// Function to check auth on server-side
export function isAuthenticated(req) {
  const cookies = parse(req.headers.cookie || '');
  const adminAuth = cookies[ADMIN_AUTH_COOKIE_NAME];

  // For this simple admin_auth, we just check its presence and value.
  // If you were using JWT, you'd verify the token here.
  return adminAuth === 'authenticated'; // Simple check for the 'authenticated' string
}

/**
 * Authorizes admin access for API routes.
 * Checks for the 'admin_auth' cookie.
 * @param {object} req - The Next.js API request object.
 * @returns {object} An object with 'authenticated' (boolean) and 'message' (string, if not authenticated).
 */
export async function authorizeAdmin(req) {
  if (isAuthenticated(req)) {
    return { authenticated: true };
  }
  return { authenticated: false, message: 'Unauthorized: Admin access required.' };
}