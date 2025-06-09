// lib/withAdminAuth.js
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseAdmin } from './firebaseAdmin'; // Your Firebase Admin SDK initialization

const adminAuth = getAuth(firebaseAdmin);
const db = getFirestore(firebaseAdmin);

export const withAdminAuth = (handler) => {
  return async (req, res) => {
    // Check for Authorization header
    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
      console.warn('Authentication failed: No ID token provided.');
      return res.status(401).json({ message: 'Unauthorized: No authentication token.' });
    }

    try {
      // Verify the ID token using Firebase Admin SDK
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Check for 'admin' role in Firestore user document
      const userDoc = await db.collection('users').doc(uid).get();

      if (!userDoc.exists) {
        console.warn(`Authentication failed: User document for UID ${uid} not found.`);
        return res.status(403).json({ message: 'Forbidden: User profile not found.' });
      }

      const userData = userDoc.data();

      if (userData.role !== 'admin') {
        console.warn(`Authorization failed: User ${uid} is not an admin. Role: ${userData.role}`);
        return res.status(403).json({ message: 'Forbidden: Not an admin.' });
      }

      // Attach user information to the request for the handler to use
      req.adminUser = decodedToken;
      req.adminUserData = userData;

      // Proceed to the original API route handler
      return handler(req, res);

    } catch (error) {
      console.error('Firebase ID token verification failed:', error.message);
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ message: 'Unauthorized: Authentication token expired. Please log in again.' });
      }
      if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
        return res.status(401).json({ message: 'Unauthorized: Invalid authentication token.' });
      }
      return res.status(401).json({ message: 'Unauthorized: Authentication failed.' });
    }
  };
};