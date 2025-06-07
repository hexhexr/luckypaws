import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import { authorizeAdmin } from '../../../../lib/auth'; // Adjust path as needed
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const authResult = await authorizeAdmin(req);
  if (!authResult.authenticated) {
    return res.status(403).json({ message: authResult.message });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password, pageCode, role } = req.body;

  if (!username || !password || !pageCode) {
    return res.status(400).json({ message: 'Missing username, password, or page code.' });
  }

  try {
    // Check if username already exists
    const existingAgent = await db.collection('agents').where('username', '==', username).limit(1).get();
    if (!existingAgent.empty) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Hash password with salt rounds

    const agentRef = db.collection('agents').doc();
    await agentRef.set({
      username,
      passwordHash: hashedPassword,
      pageCode,
      role: role || 'agent', // Default role to 'agent'
      createdAt: new Date().toISOString(),
      addedByAdminId: authResult.agentId, // Track which admin added this agent
    });

    return res.status(201).json({ success: true, message: 'Agent added successfully.', agentId: agentRef.id });
  } catch (error) {
    console.error('Error adding agent:', error);
    return res.status(500).json({ message: 'Failed to add agent.' });
  }
}