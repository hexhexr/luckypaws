// src/lib/authMiddleware.js
import { auth } from './firebaseAdmin';

/**
 * A higher-order factory function to create role-specific authentication middleware.
 * It verifies a Firebase ID token and checks for a specific claim (e.g., 'admin', 'agent').
 * @param {string} requiredRole The role to check for in the token's custom claims.
 * @returns {function} A middleware function that wraps an API handler to protect the route.
 */
const createAuthMiddleware = (requiredRole) => (handler) => async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      throw new Error('Authorization token not found.');
    }

    const decodedToken = await auth.verifyIdToken(token);

    // Check if the required role claim is present and true
    if (!decodedToken[requiredRole]) {
      throw new Error(`User does not have required '${requiredRole}' privileges.`);
    }

    // Attach the decoded token to the request object for use in the handler
    req.decodedToken = decodedToken;
    return handler(req, res);
  } catch (error) {
    console.error(`Auth middleware error for role '${requiredRole}':`, error.message);
    // Return a generic 403 Forbidden status for security reasons
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }
};

/**
 * Middleware for protecting API routes that require ADMIN access.
 * Usage: export default withAuth(handler);
 */
export const withAuth = createAuthMiddleware('admin');

/**
 * Middleware for protecting API routes that require AGENT access.
 * Usage: export default withAgentAuth(handler);
 */
export const withAgentAuth = createAuthMiddleware('agent');