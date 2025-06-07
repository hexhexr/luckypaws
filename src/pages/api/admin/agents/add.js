// src/pages/api/admin/agents/add.js
import { db, firebaseAdmin } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import { authorizeAdmin } from '../../../../lib/auth'; // Adjust path as needed
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Authorize the request using the admin token
  const authResult = await authorizeAdmin(req);
  if (!authResult.authenticated) {
    return res.status(403).json({ message: authResult.message });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password, pageCode, role, email } = req.body; // Added 'email' for Firebase Auth user

  // Basic validation
  if (!username || !password || !pageCode || !email) {
    return res.status(400).json({ message: 'Missing username, password, page code, or email.' });
  }

  try {
    // 1. Check if username already exists in Firestore 'agents' collection
    const existingAgent = await db.collection('agents').where('username', '==', username).limit(1).get();
    if (!existingAgent.empty) {
      return res.status(409).json({ message: 'Agent with this username already exists.' });
    }

    // 2. Check if email already exists in Firebase Authentication
    try {
      await firebaseAdmin.auth().getUserByEmail(email);
      return res.status(409).json({ message: 'An account with this email already exists in Firebase Authentication.' });
    } catch (firebaseError) {
      // If error.code is 'auth/user-not-found', it means email is not in use, which is good.
      if (firebaseError.code !== 'auth/user-not-found') {
        throw firebaseError; // Re-throw other Firebase errors
      }
    }

    // 3. Hash the provided password
    const hashedPassword = await bcrypt.hash(password, 10); // Hash password with 10 salt rounds

    // 4. Create a new user in Firebase Authentication
    const newUser = await firebaseAdmin.auth().createUser({
      email: email,
      password: password, // Firebase Auth handles hashing for its own storage
      displayName: username,
      // Other optional fields like photoURL, phoneNumber, etc.
    });

    // 5. Set custom claims for the new user (e.g., 'agent' role)
    const agentRole = role || 'agent'; // Default role to 'agent'
    await firebaseAdmin.auth().setCustomUserClaims(newUser.uid, { role: agentRole });

    // 6. Store agent details in Firestore, referencing the Firebase Auth UID
    const agentRef = db.collection('agents').doc(newUser.uid); // Use Firebase Auth UID as Firestore doc ID
    await agentRef.set({
      username,
      email, // Store email for reference
      pageCode,
      role: agentRole, // Store role in Firestore as well for data purposes
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
      addedByAdminId: authResult.adminId, // Track which admin added this agent (uses correct ID from authorizeAdmin)
      // Do NOT store passwordHash in Firestore if you're using Firebase Auth
    });

    return res.status(201).json({
      message: 'Agent created successfully!',
      agentId: newUser.uid, // Return the Firebase Auth UID
      username,
      email,
      pageCode,
      role: agentRole,
    });
  } catch (error) {
    console.error('Error adding agent:', error);
    // Handle Firebase Auth specific errors
    if (error.code && error.code.startsWith('auth/')) {
      return res.status(400).json({ message: `Firebase Auth Error: ${error.message}` });
    }
    return res.status(500).json({ message: 'Failed to add agent.' });
  }
}