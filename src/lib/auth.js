// lib/auth.js
import { firebaseAdmin } from './firebaseAdmin'; // Your initialized Admin SDK instance

/**
 * Verifies Firebase ID Token from request headers.
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

  // Check custom claim for admin role
  if (decodedToken.role === 'admin') {
    return { authenticated: true, adminId: decodedToken.uid }; // Return the actual admin's UID
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

  // Check custom claim for agent role
  if (decodedToken.role === 'agent' || decodedToken.role === 'admin') { // Admins can also act as agents
    return { authenticated: true, agentId: decodedToken.uid }; // Return the actual agent's UID
  } else {
    return { authenticated: false, message: 'Forbidden: Agent access required.' };
  }
}