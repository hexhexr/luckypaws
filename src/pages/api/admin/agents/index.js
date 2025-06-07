// src/pages/api/admin/agents/index.js
import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import { authorizeAdmin } from '../../../../lib/auth'; // Adjust path as needed

export default async function handler(req, res) {
  // Authorize the request using the admin token
  const authResult = await authorizeAdmin(req);
  if (!authResult.authenticated) {
    return res.status(403).json({ message: authResult.message });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const agentsSnapshot = await db.collection('agents').orderBy('createdAt', 'desc').get();
    const agents = agentsSnapshot.docs.map(doc => {
      const data = doc.data();
      // Do not send sensitive data like passwordHash to the frontend
      delete data.passwordHash; // This should no longer be stored if using Firebase Auth
      return { id: doc.id, ...data };
    });

    return res.status(200).json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json({ message: 'Failed to fetch agents.' });
  }
}