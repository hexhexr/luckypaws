import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = {
  api: {
    bodyParser: false, // required to get raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const secret = process.env.SPEED_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing SPEED_WEBHOOK_SECRET');
    return res.status(500).json({ message: 'Missing secret' });
  }

  let rawBody;
  try {
    rawBody = (await buffer(req)).toString();
  } catch (err) {
    console.error('Error reading raw body:', err);
    return res.status(500).json({ message: 'Failed to read raw body' });
  }

  const headerSig = req.headers['webhook-signature'] || '';
  const receivedSig = headerSig.split(',')[1]; // ✅ remove 'v1,' prefix

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (computedSig !== receivedSig) {
    console.error('❌ Invalid webhook signature');
    console.error('Expected:', computedSig);
    console.error('Received:', receivedSig);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('Invalid JSON body');
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  const event = payload.event_type;
  const payment = payload.data?.object;
  const orderId = payment?.id;

  if (event === 'payment.confirmed' && payment?.status === 'paid' && orderId) {
    try {
      const orderRef = db.collection('orders').doc(orderId);
      const existing = await orderRef.get();

      if (!existing.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }

      await orderRef.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
      });

      console.log('✅ Webhook: Payment confirmed for order:', orderId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ Firestore update failed:', err);
      return res.status(500).json({ message: 'Failed to update order' });
    }
  }

  return res.status(200).json({ received: true });
}
