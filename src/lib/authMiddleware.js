// src/lib/authMiddleware.js
import { auth } from './firebaseAdmin';

/**
 * A higher-order factory function to create role-specific authentication middleware.
 */
const createAuthMiddleware = (requiredRole, allowUnverified = false) => (handler) => async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    
    if (allowUnverified) {
      req.decodedToken = decodedToken;
      return handler(req, res);
    }

    if (!decodedToken[requiredRole]) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges.' });
    }

    req.decodedToken = decodedToken;
    return handler(req, res);
  } catch (error) {
    console.error(`Auth middleware error:`, error.message);
    return res.status(403).json({ success: false, message: 'Forbidden: Invalid token.' });
  }
};

export const withAuth = createAuthMiddleware('admin');
export const withAgentAuth = createAuthMiddleware('agent');

/**
 * Middleware for protecting API routes that require ANY authenticated user (including anonymous).
 */
export const withAuthenticatedUser = createAuthMiddleware(null, true);