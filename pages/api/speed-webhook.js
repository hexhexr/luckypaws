import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = {
  api: {
    bodyParser: false, // We need raw body for signature validation
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const secret = process.env.SPEED_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ message: 'Missing webhook secret' });

  let rawBody;
  try {
    rawBody = (await buffer(req)).toString();
  } catch (err) {
    return res.status(500).json({ message: 'Failed to parse body' });
  }

  const signature = req.headers['webhook-signature'];
  if (!signature) {
    return res.status(400).json({ message: 'Missing signature header' });
  }

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (signature !== computedSig) {
    console.error('❌ Invalid webhook signature');
    return res.status(400).json({ message: 'Invalid signature' });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  const { event_type, data } = parsed;

  if (event_type === 'payment.confirmed' && data?.object?.id && data.object.status === 'paid') {
    try {
      const orderId = data.object.id;
      await db.collection('orders').doc(orderId).update({
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firestore update failed:', err);
      return res.status(500).json({ message: 'Failed to update order' });
    }
  }

  return res.status(200).json({ received: true });
}
