// src/pages/api/admin/admins/create.js
import { auth, db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Admin identity is verified by withAuth middleware
  const { email, password, name } = req.body;

  if (!email || !password || !name || password.length < 6) {
    return res.status(400).json({ message: 'Missing fields, or password is too short. Name, Email, and Password (min 6 chars) are required.' });
  }

  try {
    // Create the user in Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: true, // Admins should be verified
      disabled: false,
    });

    // Set the custom claim to identify the user as an admin
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });

    // Create a corresponding document in the 'users' collection in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.displayName,
      admin: true, // Set the admin flag in the database
      agent: false, // Explicitly not an agent
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: `Admin ${name} created successfully.`, uid: userRecord.uid });

  } catch (error) {
    console.error('Error creating admin:', error);
    let errorMessage = 'Failed to create admin.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'This email address is already in use by another account.';
    }
    return res.status(500).json({ message: errorMessage, error: error.code });
  }
};

export default withAuth(handler);