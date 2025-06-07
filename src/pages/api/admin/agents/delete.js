import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import { authorizeAdmin } from '../../../../lib/auth'; // Adjust path as needed

export default async function handler(req, res) {
  const authResult = await authorizeAdmin(req);
  if (!authResult.authenticated) {
    return res.status(403).json({ message: authResult.message });
  }

  if (req.method !== 'POST') { // Or DELETE, depending on preference
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({ message: 'Missing agent ID.' });
  }

  try {
    await db.collection('agents').doc(agentId).delete();
    return res.status(200).json({ success: true, message: 'Agent deleted successfully.' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return res.status(500).json({ message: 'Failed to delete agent.' });
  }
}