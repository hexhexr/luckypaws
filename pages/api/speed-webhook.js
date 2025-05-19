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
    return res.status(500).json({ error: 'Missing webhook secret' });
  }

  let rawBodyBuffer;
  try {
    rawBodyBuffer = await buffer(req);
  } catch (err) {
    console.error('Error reading request buffer:', err);
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  // Try multiple common header keys just in case
  const headerSig =
    req.headers['webhook-signature'] ||
    req.headers['x-webhook-signature'] ||
    req.headers['x-speed-signature'];

  if (!headerSig || typeof headerSig !== 'string' || !headerSig.startsWith('v1,')) {
    console.error('Invalid or missing signature header:', headerSig);
    return res.status(400).json({ error: 'Invalid signature header format' });
  }

  const receivedSig = headerSig.split(',')[1]?.trim();
  if (!receivedSig) {
    console.error('Signature not found in header:', headerSig);
    return res.status(400).json({ error: 'Missing signature in header' });
  }

  // Compute base64 HMAC signature of raw body
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBodyBuffer)
    .digest('base64');

  console.log('Received Signature:', receivedSig);
  console.log('Computed Signature:', computedSig);

  const valid =
    crypto.timingSafeEqual(
      Buffer.from(computedSig),
      Buffer.from(receivedSig)
    );

  if (!valid) {
    console.error('⚠️ Signature mismatch – webhook rejected');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBodyBuffer.toString('utf8'));
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const event = payload?.event_type;
  const payment = payload?.data?.object;

  if (!event || !payment) {
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  console.log(`✅ Received ${event} for ${payment.id}`);

  if (event === 'payment.confirmed') {
    return handlePaymentConfirmed(payment, res);
  }

  return res.status(200).json({ received: true });
}

async function handlePaymentConfirmed(payment, res) {
  if (payment.status !== 'paid') {
    console.warn(`Payment ${payment.id} is not paid`);
    return res.status(200).json({ received: true });
  }

  const orderId = payment.metadata?.orderId || payment.id;
  if (!orderId) {
    return res.status(400).json({ error: 'Missing order ID in metadata' });
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const doc = await orderRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = doc.data().status;
    if (currentStatus === 'paid') {
      return res.status(200).json({ message: 'Already marked as paid' });
    }

    await orderRef.update({
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentId: payment.id,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Order ${orderId} marked as paid`);
    return res.status(200).json({ success: true, orderId });

  } catch (err) {
    console.error('❌ Firebase update error:', err);
    return res.status(500).json({ error: 'Failed to update order' });
  }
}
