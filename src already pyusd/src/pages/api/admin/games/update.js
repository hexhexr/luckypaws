// pages/api/admin/games/update.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id, name } = req.body;

  if (!id || !name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'Missing game ID or new name' });
  }

  try {
    await db.collection('games').doc(id).update({ name: name.trim() });
    res.status(200).json({ success: true, message: 'Game updated successfully' });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ message: 'Failed to update game' });
  }
};

export default withAuth(handler);