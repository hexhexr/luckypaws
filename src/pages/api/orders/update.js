import { db } from '../../../lib/firebaseAdmin';
import { withAuth } from '../../../lib/authMiddleware'; // Import the authentication middleware

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { id, update } = req.body;

  if (!id || !update || typeof update !== 'object') {
    return res.status(400).json({ message: 'Missing or invalid fields' });
  }

  try {
    await db.collection('orders').doc(id).update(update);
    res.status(200).json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Order update error:', err);
    res.status(500).json({ message: 'Failed to update order' });
  }
};

export default withAuth(handler); // Wrap the handler with the authentication middleware