import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const secret = process.env.SPEED_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing SPEED_WEBHOOK_SECRET in env');
    return res.status(500).json({ error: 'Missing secret' });
  }

  // 🔐 Step 1: get raw body exactly as received
  const rawBody = (await buffer(req)).toString();

  // 🔐 Step 2: extract TrySpeed signature (format: v1,<base64>)
  const headerSig = req.headers['webhook-signature'];
  if (!headerSig || !headerSig.startsWith('v1,')) {
    return res.status(400).json({ error: 'Missing or invalid webhook-signature header' });
  }
  const receivedSig = headerSig.split(',')[1].trim();

  // 🔐 Step 3: compute our own HMAC
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  // 🔐 Step 4: compare securely
  if (computedSig !== receivedSig) {
    console.error('❌ Invalid webhook signature');
    console.error('Expected:', computedSig);
    console.error('Received:', receivedSig);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ✅ Parse payload and handle payment
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = payload.event_type;
  const payment = payload.data?.object;
  const orderId = payment?.id;

  if (event === 'payment.confirmed' && payment.status === 'paid' && orderId) {
    try {
      const ref = db.collection('orders').doc(orderId);
      const exists = await ref.get();
      if (!exists.exists) {
        return res.status(404).json({ error: 'Order not found' });
      }

      await ref.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
      });

      console.log('✅ Payment confirmed for order', orderId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ Firebase error:', err);
      return res.status(500).json({ error: 'Firestore update failed' });
    }
  }

  return res.status(200).json({ received: true });
}
