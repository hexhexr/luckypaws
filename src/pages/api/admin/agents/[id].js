// pages/api/admin/agents/[id].js
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from '../../../lib/firebaseAdmin';  // Corrected import path

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  const { id } = req.query;

  // PUT method: To update full agent details (username, email, name, status)
  if (req.method === 'PUT') {
    try {
      const { username, email, name, status } = req.body;

      // Ensure all fields are provided
      if (!username || !email || !name || !status) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Update the agent's details in Firestore
      await db.collection('agents').doc(id).update({
        username,
        email,
        name,
        status,
        updatedAt: new Date().toISOString(),  // Add timestamp
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating agent:', error);
      return res.status(500).json({ error: 'Failed to update agent' });
    }
  } 
  // PATCH method: To update only the agent's status
  else if (req.method === 'PATCH') {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      // Update only the status field
      await db.collection('agents').doc(id).update({
        status,
        updatedAt: new Date().toISOString(),  // Add timestamp
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating agent status:', error);
      return res.status(500).json({ error: 'Failed to update agent status' });
    }
  } else {
    // Method not allowed
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
