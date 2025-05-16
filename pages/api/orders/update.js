import { db } from '../../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ message: 'Missing orderId or status' });

  try {
    const updateFields = { status };
    if (status === 'paid') updateFields.paidManually = true;

    await db.collection('orders').doc(orderId).update(updateFields);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update error:', err);
    return res.status(500).json({ message: 'Update failed' });
  }
}
