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
    .update(rawBodyBuffer)
    .digest('base64');

  if (!crypto.timingSafeEqual(Buffer.from(computedSig), Buffer.from(receivedSig))) {
    console.error('Signature mismatch');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBodyBuffer.toString('utf8'));
  } catch (err) {
    console.error('Error parsing JSON payload:', err);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const event = payload?.event_type;
  const payment = payload.data?.object;

  if (!event || !payment) {
    console.error('Invalid payload structure');
    return res.status(400).json({ error: 'Invalid payload structure' });
  }

  console.log(`Received ${event} event for payment: ${payment.id}`);

  switch (event) {
    case 'payment.created':
      console.log(`Payment created: ${payment.id}`);
      return res.status(200).json({ received: true });

    case 'payment.confirmed':
      return handlePaymentConfirmed(payment, res);

    default:
      console.log(`Unhandled event type: ${event}`);
      return res.status(200).json({ received: true });
  }
}

async function handlePaymentConfirmed(payment, res) {
  if (payment.status !== 'paid') {
    console.log(`Payment ${payment.id} not in paid status`);
    return res.status(200).json({ received: true });
  }

  const orderId = payment.metadata?.orderId;
  if (!orderId) {
    console.error('Payment confirmed event missing orderId');
    return res.status(400).json({ error: 'Missing orderId in metadata' });
  }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const doc = await orderRef.get();

    if (!doc.exists) {
      console.warn(`Order not found: ${orderId}`);
      return res.status(404).json({ error: `Order not found: ${orderId}` });
    }

    const currentStatus = doc.data()?.status;
    if (currentStatus === 'paid') {
      console.log(`Order ${orderId} already marked as paid`);
      return res.status(200).json({ success: true, orderId });
    }

    await orderRef.update({
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentId: payment.id,
      updatedAt: new Date().toISOString(),
    });

    console.log(`Updated order ${orderId} to paid status`);
    return res.status(200).json({ success: true, orderId });

  } catch (err) {
    console.error('Firebase update error:', err);
    return res.status(500).json({ error: 'Failed to update order status' });
  }
}