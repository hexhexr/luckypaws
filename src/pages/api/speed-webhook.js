import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretEnv = process.env.SPEED_WEBHOOK_SECRET;
  if (!secretEnv) return res.status(500).json({ error: 'Missing webhook secret' });

  // Remove 'wsec_' prefix and decode base64 secret
  const secret = Buffer.from(secretEnv.replace(/^wsec_/, ''), 'base64');

  let rawBody;
  try {
    rawBody = (await buffer(req)).toString();
  } catch (err) {
    console.error('Failed to read raw body:', err);
    return res.status(500).json({ error: 'Failed to read body' });
  }

  // Required headers from TrySpeed webhook
  const headerSig = req.headers['webhook-signature'];
  const webhookId = req.headers['webhook-id'];
  const webhookTimestamp = req.headers['webhook-timestamp'];

  if (!headerSig || !webhookId || !webhookTimestamp) {
    return res.status(400).json({ error: 'Missing required webhook headers' });
  }

  // Signature is expected to be like: v1,<base64signature>
  if (!headerSig.startsWith('v1,')) {
    return res.status(400).json({ error: 'Invalid signature header format' });
  }

  const receivedSig = headerSig.split(',')[1].trim();

  // Construct the signed payload string
  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;

  // Compute expected signature
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64');

  // Timing safe compare
  const receivedSigBuffer = Buffer.from(receivedSig, 'base64');
  const computedSigBuffer = Buffer.from(computedSig, 'base64');
  if (
    receivedSigBuffer.length !== computedSigBuffer.length ||
    !crypto.timingSafeEqual(receivedSigBuffer, computedSigBuffer)
  ) {
    console.error('❌ Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Parse payload JSON
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Handle your business logic
  const payment = payload?.data?.object;
  const orderId = payment?.id;

  if (payload.event_type === 'payment.confirmed' && payment?.status === 'paid' && orderId) {
    try {
      const orderRef = db.collection('orders').doc(orderId);
      const existing = await orderRef.get();

      if (!existing.exists) return res.status(404).json({ error: 'Order not found' });

      await orderRef.update({ status: 'paid', paidAt: new Date().toISOString() });
      console.log('✅ Webhook: Payment confirmed for', orderId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firestore update failed:', err);
      return res.status(500).json({ error: 'Failed to update order' });
    }
  }

  // Acknowledge receipt for other events or if conditions don't match
  return res.status(200).json({ received: true });
}
