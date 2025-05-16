import { db } from '../../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ message: 'Missing orderId or status' });

  try {
    await db.collection('orders').doc(orderId).update({ status });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
}
