// pages/api/admin/login.js
import { auth as adminAuth } from '../../../lib/firebaseAdmin'; // Firebase Admin Auth
import { db } from '../../../lib/firebaseAdmin'; // For Firestore if you store admin users there
import { serialize } from 'cookie';
import bcrypt from 'bcrypt'; // Assuming you hash passwords for local admins

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // --- Step 1: Verify admin credentials (e.g., against Firestore or environment variables) ---
    // For simplicity, let's assume you have an 'admins' collection in Firestore
    // or verify against hardcoded values for a very small admin setup.
    // **IMPORTANT:** For a real application, you should create actual Firebase Auth users for admins
    // and potentially use Custom Claims to mark them as admins.
    // If you use a custom admin system with username/password:
    const adminQuery = await db.collection('admins').where('username', '==', username).limit(1).get();

    if (adminQuery.empty) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const adminUserDoc = adminQuery.docs[0];
    const adminData = adminUserDoc.data();

    // Verify password (assuming bcrypt for hashed passwords)
    const passwordMatch = await bcrypt.compare(password, adminData.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // --- Step 2: Create a Firebase Custom Token (Optional but Recommended) ---
    // If you plan to use Firebase Auth client-side for admin (e.g., for user.getIdTokenResult().claims)
    // you would create a custom token here and send it to the client to sign in.
    // const customToken = await adminAuth.createCustomToken(adminUserDoc.id, { admin: true });
    // await adminAuth.setCustomUserClaims(adminUserDoc.id, { admin: true }); // Ensure claim is set

    // --- Step 3: Create a Firebase Session Cookie ---
    // For server-side protection, create a session cookie.
    // You can set the expiry time based on your security requirements.
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    // IMPORTANT: In a real app, you might first sign in with Firebase Auth on the client
    // and then get the ID token to create a session cookie.
    // For a backend-only admin system (which this seems to be implying),
    // you'd typically have a unique admin UID or rely purely on server-side checks for the cookie.
    // For simplicity here, we'll create a session cookie using the Firestore admin user's UID.
    const sessionCookie = await adminAuth.createSessionCookie(adminUserDoc.id, { expiresIn });

    // Set the session cookie as an HTTP-only cookie
    res.setHeader('Set-Cookie', serialize('admin_session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      maxAge: expiresIn / 1000, // Max age in seconds
      path: '/',
      sameSite: 'Lax', // Or 'Strict' for more security
    }));

    return res.status(200).json({ success: true, message: 'Logged in successfully!' });

  } catch (error) {
    console.error('Admin login API error:', error);
    return res.status(500).json({ message: 'Internal server error during login.' });
  }
}