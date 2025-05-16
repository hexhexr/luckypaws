import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ message: 'Missing orderId' });

  try {
    await db.collection('orders').doc(orderId).delete();
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
}
