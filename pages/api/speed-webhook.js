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

  // 🔐 Get raw buffer without conversion
  const rawBodyBuffer = await buffer(req);

  // 🔐 Signature verification
  const headerSig = req.headers['webhook-signature'];
  if (!headerSig?.startsWith('v1,')) {
    return res.status(400).json({ error: 'Invalid signature header' });
  }
  const receivedSig = headerSig.split(',')[1].trim();

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBodyBuffer) // Use buffer directly
    .digest('base64');

  if (!crypto.timingSafeEqual(Buffer.from(computedSig), Buffer.from(receivedSig))) {
    console.error('❌ Signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(rawBodyBuffer.toString());
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = payload.event_type;
  const payment = payload.data?.object;
  
  // Use metadata field for order ID
  const orderId = payment?.metadata?.orderId;

  if (event === 'payment.confirmed' && payment?.status === 'paid' && orderId) {
    try {
      const orderRef = db.collection('orders').doc(orderId);
      const doc = await orderRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: 'Order not found' });
      }

      await orderRef.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentDetails: payment
      });

      console.log(`✅ Updated order ${orderId}`);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firebase error:', err);
      return res.status(500).json({ error: 'Database update failed' });
    }
  }

  return res.status(200).json({ received: true });
}