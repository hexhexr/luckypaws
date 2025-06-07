// src/lib/clientAuth.js - For client-side Firebase client SDK operations
import firebase from 'firebase/app';
import 'firebase/auth'; // Ensure Firebase Auth is imported
import 'firebase/firestore'; // Ensure Firestore is imported if you use it client-side

// IMPORTANT: This file assumes Firebase is initialized in pages/_app.js via src/lib/firebaseClient.js
// If you are initializing Firebase directly in this file, uncomment and configure firebaseConfig.
// const firebaseConfig = { /* ... your NEXT_PUBLIC_ env variables ... */ };
// if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

// Export the initialized instances for easy access
export const clientAuth = firebase.auth();
export const clientFirestore = firebase.firestore();

/**
 * Gets the current user's ID token for API calls.
 * @returns {string|null} The ID token if user is logged in, null otherwise.
 */
export async function getAuthToken() {
  const user = clientAuth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
}

/**
 * Checks if the current client-side user has a specific role based on custom claims.
 * @param {string} role - The role to check for ('admin' or 'agent').
 * @returns {boolean} True if the user has the role, false otherwise.
 */
export async function hasRole(role) {
  const user = clientAuth.currentUser;
  if (user) {
    // Force a token refresh to get the latest custom claims
    const idTokenResult = await user.getIdTokenResult(true);
    return idTokenResult.claims.role === role;
  }
  return false;
}

// Add other client-side auth helpers here as needed