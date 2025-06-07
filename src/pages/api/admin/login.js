import { serialize } from 'cookie';
import { db } from '../../../lib/firebaseAdmin'; // Adjust path as needed
import bcrypt from 'bcryptjs'; // Import bcryptjs

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing credentials' });
  }

  try {
    // Check if it's the hardcoded admin (for initial setup/fallback)
    const { ADMIN_USER = 'admin', ADMIN_PASS = '123456' } = process.env;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      res.setHeader('Set-Cookie', serialize('admin_auth', 'authenticated', {
        path: '/',
        maxAge: 60 * 60, // 1 hour
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      }));
      return res.status(200).json({ success: true, role: 'admin' });
    }

    // Check in 'agents' collection for agent/admin roles
    const agentSnapshot = await db.collection('agents').where('username', '==', username).limit(1).get();

    if (agentSnapshot.empty) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const agentDoc = agentSnapshot.docs[0];
    const agentData = agentDoc.data();

    // Compare provided password with hashed password from Firestore
    const isPasswordValid = await bcrypt.compare(password, agentData.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Set a more specific cookie that includes agent ID and role
    res.setHeader('Set-Cookie', serialize('session', JSON.stringify({
      agentId: agentDoc.id,
      username: agentData.username,
      role: agentData.role || 'agent', // Default to 'agent' if not specified
    }), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week session
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }));

    // For admin, we also keep the simple admin_auth for existing checks if needed
    if (agentData.role === 'admin') {
      res.setHeader('Set-Cookie', serialize('admin_auth', 'authenticated', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      }));
    }

    return res.status(200).json({ success: true, role: agentData.role || 'agent' });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error during login.' });
  }
}