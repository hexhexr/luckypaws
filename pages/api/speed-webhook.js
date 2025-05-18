import { db } from '../../lib/firebaseAdmin';
import crypto from 'crypto';
import getRawBody from 'raw-body';

export const config = {
  api: {
    bodyParser: false, // Required to get raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const secret = process.env.SPEED_WEBHOOK_SECRET;

  let raw;
  try {
    raw = await getRawBody(req);
  } catch (err) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  // Verify signature
  const signature = req.headers['x-speed-signature'];
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(raw)
    .digest('hex');

  if (signature !== expectedSig) {
    console.warn('❌ Invalid webhook signature');
    return res.status(401).json({ message: 'Unauthorized: invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  const { event, data } = payload;

  if (event === 'payment.status.updated' && data?.id && data.status === 'paid') {
    try {
      await db.collection('orders').doc(data.id).update({ status: 'paid' });
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ Failed to update Firebase:', err);
      return res.status(500).json({ message: 'Failed to update order status' });
    }
  }

  return res.status(200).json({ received: true });
}
