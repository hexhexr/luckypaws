import { db } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  try {
    const snapshot = await db.collection('orders').get();
    const orders = snapshot.docs.map(doc => doc.data());
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
}
