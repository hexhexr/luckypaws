// src/lib/authMiddleware.js
import { auth } from './firebaseAdmin'; 

/**
 * Verifies a Firebase ID token and checks for admin privileges.
 * @param {string} token The Firebase ID token from the client.
 * @returns {Promise<object>} The decoded token payload.
 * @throws {Error} If the token is invalid, expired, or the user is not an admin.
 */
export const verifyIdToken = async (token) => {
  if (!token) {
    throw new Error('Authorization token not found.');
  }
  try {
    const decodedToken = await auth.verifyIdToken(token);
    // You can also check for specific roles like 'agent' here if needed
    // For admin routes, we check the 'admin' claim.
    if (!decodedToken.admin) {
        throw new Error('User does not have administrative privileges.');
    }
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error.message);
    throw new Error(`Unauthorized: ${error.message}`);
  }
};

/**
 * Middleware for protecting API routes that require admin access.
 * @param {function} handler The original API route handler.
 * @returns {function} A new handler that includes admin token verification.
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