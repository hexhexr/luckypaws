// src/lib/firebaseAdmin.js
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK only if it hasn't been initialized yet
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID, // Use private variable for Admin SDK
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL, // Use private variable for Admin SDK
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Important for Vercel
    }),
    // databaseURL: process.env.FIREBASE_DATABASE_URL, // Only if you use Realtime Database, use private variable
  });
}

// Export the initialized admin instance and Firestore/Auth instances
export const firebaseAdmin = admin;
export const db = admin.firestore(); // Export Firestore instance
export const auth = admin.auth(); // Export Auth instance for setting custom claims