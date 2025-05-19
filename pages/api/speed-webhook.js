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
  if (!headerSig || typeof headerSig !== 'string' || !headerSig.startsWith('v1,')) {
    return res.status(400).json({ error: 'Invalid signature header' });
  }

  const receivedSig = headerSig.split(',')[1]?.trim();
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBodyBuffer)
    .digest('base64');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(computedSig),
    Buffer.from(receivedSig)
  );

  if (!isValid) {
    console.error('❌ Webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBodyBuffer.toString('utf8'));
  } catch (err) {
    console.error('Invalid JSON payload:', err);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = payload?.event_type;
  const payment = payload?.data?.object;

  if (!event || !payment) {
    return res.status(400).json({ error: 'Invalid webhook structure' });
  }

  console.log(`✅ Received event: ${event} for payment ID: ${payment.id}`);

  if (event === 'payment.confirmed') {
    return handlePaymentConfirmed(payment, res);
  }

  return res.status(200).json({ received: true });
}

async function handlePaymentConfirmed(payment, res) {
  if (payment.status !== 'paid') {
    console.log(`Ignored non-paid payment: ${payment.id}`);
    return res.status(200).json({ received: true });
  }

  const orderId = payment.metadata?.orderId || payment.id;
  const username = payment.metadata?.username || 'N/A';
  const game = payment.metadata?.game || 'N/A';
  const amount = payment.metadata?.amount || 'N/A';

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
      updatedAt: new Date().toISOString(),
      paymentId: payment.id,
      username,
      game,
      amount,
    });

    console.log(`✅ Updated order ${orderId} to paid with user ${username}, game ${game}`);
    return res.status(200).json({ success: true, orderId });

  } catch (err) {
    console.error('❌ Failed to update Firebase order:', err);
    return res.status(500).json({ error: 'Internal error while updating payment' });
  }
}
