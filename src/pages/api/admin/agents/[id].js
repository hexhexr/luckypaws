// pages/api/admin/agents/[id].js
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../../../lib/firebaseAdmin";

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { username, email, name, status } = req.body;
      await db.collection('agents').doc(id).update({
        username,
        email,
        name,
        status,
        updatedAt: new Date().toISOString()
      });
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update agent' });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { status } = req.body;
      await db.collection('agents').doc(id).update({
        status,
        updatedAt: new Date().toISOString()
      });
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update agent status' });
    }
  } else {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}