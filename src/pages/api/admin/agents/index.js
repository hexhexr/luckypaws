import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import { authorizeAdmin } from '../../../../lib/auth'; // Adjust path as needed

export default async function handler(req, res) {
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
      // Do not send passwordHash to the frontend
      delete data.passwordHash;
      return { id: doc.id, ...data };
    });

    return res.status(200).json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json({ message: 'Failed to fetch agents.' });
  }
}