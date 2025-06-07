import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import { authorizeAdmin } from '../../../../lib/auth'; // Adjust path as needed
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const authResult = await authorizeAdmin(req);
  if (!authResult.authenticated) {
    return res.status(403).json({ message: authResult.message });
  }

  if (req.method !== 'POST') { // Or PATCH, depending on preference
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { agentId, username, password, pageCode, role } = req.body;

  if (!agentId) {
    return res.status(400).json({ message: 'Missing agent ID.' });
  }

  const updates = {};
  if (username) updates.username = username;
  if (pageCode) updates.pageCode = pageCode;
  if (role) updates.role = role;
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No fields provided for update.' });
  }

  try {
    const agentRef = db.collection('agents').doc(agentId);
    const agentDoc = await agentRef.get();

    if (!agentDoc.exists) {
      return res.status(404).json({ message: 'Agent not found.' });
    }

    // If username is being updated, check for uniqueness
    if (username && username !== agentDoc.data().username) {
      const existingAgent = await db.collection('agents').where('username', '==', username).limit(1).get();
      if (!existingAgent.empty && existingAgent.docs[0].id !== agentId) {
        return res.status(409).json({ message: 'Username already exists for another agent.' });
      }
    }

    await agentRef.update(updates);
    return res.status(200).json({ success: true, message: 'Agent updated successfully.' });
  } catch (error) {
    console.error('Error updating agent:', error);
    return res.status(500).json({ message: 'Failed to update agent.' });
  }
}