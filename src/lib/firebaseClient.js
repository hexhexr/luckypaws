// src/lib/firebaseClient.js
import firebase from 'firebase/app';
import 'firebase/auth'; // Required for authentication
import 'firebase/firestore'; // Required for Firestore database access

// Your Firebase client-side configuration (these environment variables must be NEXT_PUBLIC_)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export the initialized instances for easy access in client-side components
export const clientAuth = firebase.auth();
export const clientFirestore = firebase.firestore();

export default firebase; // Export the default firebase object