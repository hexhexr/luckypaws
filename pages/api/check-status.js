import { db } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'Missing order ID' });

  try {
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: 'Order not found' });

    const data = doc.data();
    return res.status(200).json({ status: data.status || 'pending' });
  } catch (err) {
    console.error('Check status error:', err);
    return res.status(500).json({ message: 'Failed to check order status' });
  }
}
