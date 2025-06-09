// lib/firebaseClient.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth'; // Ensure this is imported for firebase.auth()

// Firebase configuration object, pulling from global __firebase_config or environment variables
const firebaseConfig = {
  apiKey: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).apiKey : process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).authDomain : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).projectId : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Add other Firebase config properties if you have them, e.g., storageBucket, messagingSenderId, appId
};

let app;
// Initialize Firebase app only if it hasn't been initialized already
if (!firebase.apps.length) {
  try {
    app = firebase.initializeApp(firebaseConfig);
    console.log("Firebase app initialized successfully.");
  } catch (e) {
    console.error("Error initializing Firebase app:", e);
    // If initialization fails, the 'app' variable might remain undefined,
    // which could lead to subsequent errors when trying to get auth or firestore instances.
  }
} else {
  // If app is already initialized, get the default app instance
  app = firebase.app();
  console.log("Firebase app already initialized.");
}

let dbInstance;
try {
  dbInstance = firebase.firestore();
  console.log("Firebase Firestore instance obtained.");
} catch (e) {
  console.error("Error getting Firebase Firestore instance:", e);
}

let authInstance;
try {
  authInstance = firebase.auth(); // Get the Auth instance
  console.log("Firebase Auth instance obtained.");
} catch (e) {
  console.error("Error getting Firebase Auth instance:", e);
  // This catch block will help pinpoint if firebase.auth() itself is throwing an error.
}

export const db = dbInstance;
export const auth = authInstance; // Export the Auth instance