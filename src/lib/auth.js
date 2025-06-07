// src/lib/auth.js - This file should ONLY be imported by server-side API routes or getServerSideProps.
// It contains logic that uses the Firebase Admin SDK, which is not for client-side.

import { serialize, parse } from 'cookie';
import { firebaseAdmin } from './firebaseAdmin'; // Correct import path, ensure firebaseAdmin is properly exported there.
// import { verify } from 'jsonwebtoken'; // Only if you are using JWT_SECRET for anything else

export const ADMIN_AUTH_COOKIE_NAME = 'admin_auth';

// --- Cookie-based functions (if still needed for routes like /api/admin/login and logout) ---
export function setAuthCookie(res) {
  const token = 'authenticated'; // Or your actual session token if you implement one
  res.setHeader('Set-Cookie', serialize(ADMIN_AUTH_COOKIE_NAME, token, {
    path: '/',
    maxAge: 60 * 60, // 1 hour (adjust as needed)
    httpOnly: true, // Prevents client-side JavaScript access
    sameSite: 'lax', // Protects against CSRF attacks
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
  }));
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(ADMIN_AUTH_COOKIE_NAME, '', {
    path: '/',
    maxAge: -1, // Expire the cookie immediately
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }));
}

// Function to check auth on server-side (if using simple cookie for legacy checks)
export function isAuthenticated(req) {
  const cookies = parse(req.headers.cookie || '');
  const adminAuth = cookies[ADMIN_AUTH_COOKIE_NAME];
  return adminAuth === 'authenticated';
}

// --- Firebase ID Token Verification functions (primary for secure auth) ---

/**
 * Verifies Firebase ID Token from request headers.
 * This function should only be called on the server-side.
 * @param {object} req - The Next.js API request object.
 * @returns {object|null} Decoded ID token (user payload with claims) if valid, null otherwise.
 */
export async function verifyIdToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("ID Token verification failed:", error.message);
    return null;
  }
}

/**
 * Authorizes admin access for API routes based on verified ID token and user's custom claim.
 * @param {object} req - The Next.js API request object.
 * @returns {object} An object with 'authenticated' (boolean), 'message' (string), and 'adminId' (string).
 */
export async function authorizeAdmin(req) {
  const decodedToken = await verifyIdToken(req);

  if (!decodedToken) {
    return { authenticated: false, message: 'Unauthorized: No or invalid ID token.' };
  }

  if (decodedToken.role === 'admin') {
    return { authenticated: true, adminId: decodedToken.uid };
  } else {
    return { authenticated: false, message: 'Forbidden: Admin access required.' };
  }
}

/**
 * Authorizes agent access for API routes based on verified ID token and user's custom claim.
 * @param {object} req - The Next.js API request object.
 * @returns {object} An object with 'authenticated' (boolean), 'message' (string), and 'agentId' (string).
 */
export async function authorizeAgent(req) {
  const decodedToken = await verifyIdToken(req);

  if (!decodedToken) {
    return { authenticated: false, message: 'Unauthorized: No or invalid ID token.' };
  }

  // An agent or an admin can have agent access
  if (decodedToken.role === 'agent' || decodedToken.role === 'admin') {
    return { authenticated: true, agentId: decodedToken.uid };
  } else {
    return { authenticated: false, message: 'Forbidden: Agent access required.' };
  }
}