// pages/api/admin/agents/create.js
import { auth, db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, password, name } = req.body;

  if (!email || !password || !name || password.length < 6) {
    return res.status(400).json({ message: 'Missing fields or password is too short (min 6 characters).' });
  }

  try {
    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: true, // You might want to set this to true for agents
      disabled: false,
    });

    // Set custom claim to identify the user as an agent
    await auth.setCustomUserClaims(userRecord.uid, { agent: true, admin: false });

    // Create a corresponding user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.displayName,
      agent: true, // Explicitly set role
      admin: false,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: `Agent ${name} created successfully.`, uid: userRecord.uid });

  } catch (error) {
    console.error('Error creating agent:', error);
    let errorMessage = 'Failed to create agent.';
    if (error.code === 'auth/email-already-exists') {
        errorMessage = 'This email address is already in use by another account.';
    } else if (error.code === 'auth/invalid-password') {
        errorMessage = 'Password must be at least 6 characters long.';
    }
    return res.status(500).json({ message: errorMessage, error: error.code });
  }
};

export default withAuth(handler);