// src/lib/authMiddleware.js
// Make sure src/lib/firebaseAdmin.js initializes Firebase Admin SDK and exports 'auth'
import { auth } from './firebaseAdmin'; 

/**
 * Verifies a Firebase ID token.
 * @param {string} token The Firebase ID token from the client.
 * @returns {Promise<object>} The decoded token payload.
 * @throws {Error} If the token is invalid, expired, or user is not authorized.
 */
export const verifyIdToken = async (token) => {
  if (!token) {
    throw new Error('Authorization token not found.');
  }
  try {
    const decodedToken = await auth.verifyIdToken(token);
    // Optional: Add custom claim checks here if you use them for roles (e.g., admin, agent)
    // Example: if (!decodedToken.admin) { throw new Error('Not authorized as admin.'); }
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error.message);
    throw new Error('Unauthorized: Invalid or expired token.');
  }
};

/**
 * Middleware for protecting API routes.
 * @param {function} handler The original API route handler.
 * @returns {function} A new handler that includes token verification.
 */
export const withAuth = (handler) => async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    req.decodedToken = decodedToken; // Attach decoded token to request for further use
    return handler(req, res);
  } catch (error) {
    return res.status(403).json({ success: false, message: error.message });
  }
};