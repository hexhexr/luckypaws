import { db } from '../../lib/firebaseAdmin.js';
import crypto from 'crypto';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['speed-signature'];
  const expectedSig = crypto
    .createHmac('sha256', process.env.SPEED_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (!sig || sig !== expectedSig) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.body;
  if (event.event_type === 'payment.updated') {
    const paymentId = event.data?.object?.id;
    const newStatus = event.data?.object?.status === 'paid' ? 'paid' : 'pending';
    await db.collection('orders').doc(paymentId).update({ status: newStatus });
  }

  res.status(200).json({ received: true });
}
