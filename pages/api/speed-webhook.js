import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { event, data } = req.body;

  if (event === 'payment.status.updated' && data?.id && data.status === 'paid') {
    try {
      await db.collection('orders').doc(data.id).update({ status: 'paid' });
      return res.status(200).json({ received: true });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to update order status' });
    }
  }

  return res.status(200).json({ received: true });
}
