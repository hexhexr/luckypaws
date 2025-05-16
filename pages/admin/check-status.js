import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing order ID' });

  try {
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Order not found' });

    const data = doc.data();
    res.status(200).json({ status: data.status, ...data });
  } catch (err) {
    res.status(500).json({ error: 'Error checking status' });
  }
}
