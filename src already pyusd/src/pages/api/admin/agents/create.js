// pages/api/admin/agents/create.js
import { auth, db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Correctly include pageCode as a required field
  const { email, password, name, pageCode } = req.body;

  if (!email || !password || !name || !pageCode || password.length < 6) {
    return res.status(400).json({ message: 'Missing fields, or password is too short. Name, Email, Password (min 6 chars), and Page Code are required.' });
  }

  // Add specific validation for the pageCode format
  if (typeof pageCode !== 'string' || !/^\d{4}$/.test(pageCode)) {
    return res.status(400).json({ message: 'Page Code is required and must be exactly 4 digits.' });
  }

  try {
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: true,
      disabled: false,
    });

    await auth.setCustomUserClaims(userRecord.uid, { agent: true, admin: false });

    // Save all details, including the crucial pageCode, to the agent's profile
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.displayName,
      pageCode: pageCode, // Store the assigned page code
      agent: true,
      admin: false,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: `Agent ${name} created successfully.`, uid: userRecord.uid });

  } catch (error) {
    console.error('Error creating agent:', error);
    let errorMessage = 'Failed to create agent.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'This email address is already in use by another account.';
    }
    return res.status(500).json({ message: errorMessage, error: error.code });
  }
};

export default withAuth(handler);