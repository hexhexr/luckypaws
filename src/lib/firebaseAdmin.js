// lib/firebaseAdmin.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    console.log('--- Debugging Firebase Admin Init ---');
    console.log('Raw FIREBASE_PRIVATE_KEY (first 50 chars):', rawPrivateKey ? rawPrivateKey.substring(0, 50) + '...' : 'Not set');
    console.log('Raw FIREBASE_PRIVATE_KEY length:', rawPrivateKey ? rawPrivateKey.length : 'Not set');

    // This is the line that processes the key for the SDK
    const processedPrivateKey = rawPrivateKey ? rawPrivateKey.replace(/\\\\n/g, '\n') : undefined;

    // Log processed key (first 50 chars to avoid revealing full key in logs)
    console.log('Processed privateKey (first 50 chars):', processedPrivateKey ? processedPrivateKey.substring(0, 50) + '...' : 'Not set');
    console.log('Processed privateKey length:', processedPrivateKey ? processedPrivateKey.length : 'Not set');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: processedPrivateKey,
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (err) {
    console.error('ERROR during Firebase Admin SDK initialization:', err);
    // Re-throw or handle the error appropriately if you want the API to fail gracefully with JSON
    // For now, this logging will help diagnose the problem in Vercel logs
    throw err; // Ensure the error is still propagated
  }
}

export const db = admin.firestore();