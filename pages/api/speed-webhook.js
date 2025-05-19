import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const secret = process.env.SPEED_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing SPEED_WEBHOOK_SECRET in env');
    return res.status(500).json({ error: 'Missing webhook secret' });
  }

  // 🔐 Get raw buffer without conversion
  let rawBodyBuffer: Buffer;
  try {
    rawBodyBuffer = await buffer(req);
  } catch (err) {
    console.error('Error reading request buffer:', err);
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  // 🔐 Signature verification
  const headerSig = req.headers['webhook-signature'];
  if (typeof headerSig !== 'string' || !headerSig.startsWith('v1,')) {
    return res.status(400).json({ error: 'Invalid signature header format' });
  }
  const receivedSig = headerSig.split(',')[1]?.trim();
  if (!receivedSig) {
    return res.status(400).json({ error: 'Missing signature in header' });
  }

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBodyBuffer) // Use buffer directly
    .digest('base64');

  if (!crypto.timingSafeEqual(Buffer.from(computedSig), Buffer.from(receivedSig))) {
    console.error('❌ Signature mismatch:', { received: receivedSig, computed: computedSig });
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  // Parse payload
  let payload: any;
  try {
    const rawBodyString = rawBodyBuffer.toString('utf8');
    payload = JSON.parse(rawBodyString);
  } catch (err) {
    console.error('Error parsing JSON payload:', err);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const event = payload?.event_type;
  const payment = payload?.data?.object;

  // Use metadata field for order ID
  const orderId = payment?.metadata?.orderId;

  if (event === 'payment.confirmed' && payment?.status === 'paid' && orderId) {
    try {
      const orderRef = db.collection('orders').doc(orderId);
      const doc = await orderRef.get();

      if (!doc.exists) {
        console.warn(`⚠️ Webhook received for non-existent order: ${orderId}`);
        return res.status(404).json({ error: `Order not found: ${orderId}` });
      }

      await orderRef.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentDetails: payment,
      });

      console.log(`✅ Successfully updated order ${orderId} to paid`);
      return res.status(200).json({ success: true, orderId: orderId });
    } catch (err) {
      console.error('🔥 Firebase update error for order:', orderId, err);
      return res.status(500).json({ error: 'Failed to update order status' });
    }
  } else if (event) {
    console.log(`🔔 Received webhook event: ${event}`, { payload });
    // Optionally handle other webhook events here
  } else {
    console.warn('⚠️ Received webhook with unknown event type', { payload });
  }

  return res.status(200).json({ received: true });
}