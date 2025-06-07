import { parse } from 'cookie';
import { db } from './firebaseAdmin'; // Adjust path as needed

export const authenticateRequest = async (req) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionCookie = cookies.session;

  if (!sessionCookie) {
    return { authenticated: false, message: 'Authentication required.' };
  }

  try {
    const sessionData = JSON.parse(sessionCookie);
    if (!sessionData.agentId || !sessionData.username || !sessionData.role) {
      return { authenticated: false, message: 'Invalid session data.' };
    }

    // Optionally, verify session against a stored session in Firebase
    // For now, we trust the cookie data, but for higher security, check server-side session tokens
    const agentRef = db.collection('agents').doc(sessionData.agentId);
    const agentDoc = await agentRef.get();

    if (!agentDoc.exists || agentDoc.data().username !== sessionData.username || agentDoc.data().role !== sessionData.role) {
      return { authenticated: false, message: 'Session invalid or user not found.' };
    }

    return { authenticated: true, agent: agentDoc.data(), agentId: agentDoc.id, role: agentDoc.data().role };

  } catch (error) {
    console.error('Session validation error:', error);
    return { authenticated: false, message: 'Invalid session.' };
  }
};

export const authorizeAdmin = async (req) => {
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    return authResult; // Return authentication failure
  }
  if (authResult.role !== 'admin') {
    return { authenticated: false, message: 'Admin access required.' };
  }
  return authResult; // Authenticated and is admin
};

export const authorizeAgent = async (req) => {
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    return authResult; // Return authentication failure
  }
  if (authResult.role !== 'agent' && authResult.role !== 'admin') {
    return { authenticated: false, message: 'Agent or Admin access required.' };
  }
  return authResult; // Authenticated and is agent or admin
};