// pages/api/admin/agents/index.js
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdmin } from "../../../../lib/firebaseAdmin";

const db = getFirestore(firebaseAdmin);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('agents').get();
      const agents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.status(200).json(agents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}