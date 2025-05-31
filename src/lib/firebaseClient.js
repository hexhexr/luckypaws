// lib/firebaseClient.js
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth'; // Import Firebase Auth

const firebaseConfig = {
  apiKey: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).apiKey : process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).authDomain : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config).projectId : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Add other Firebase config properties if you have them, e.g., storageBucket, messagingSenderId, appId
};

// Initialize Firebase only if it hasn't been initialized already
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth(); // Get the Auth instance

export { db, auth }; // Export both db and auth
