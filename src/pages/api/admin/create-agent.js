// pages/api/admin/create-agent.js
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from 'bcryptjs';
import { firebaseAdmin } from "../../../lib/firebaseAdmin";

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // Check if the username already exists
    const query = await db.collection('agents').where('username', '==', username).limit(1).get();
    if (!query.empty) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the agent document in Firestore
    const agentData = {
      username,
      password: hashedPassword,
      createdAt: new Date(),
    };

    const newAgentRef = await db.collection('agents').add(agentData);

    res.status(201).json({ success: true, message: 'Agent created successfully', agentId: newAgentRef.id });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ message: 'Failed to create agent.', error: error.message });
  }
}
