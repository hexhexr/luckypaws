import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = {
  api: {
    bodyParser: false, // we need raw body for signature check
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.SPEED_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing SPEED_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Missing webhook secret' });
  }

  // 1. Read raw body as string
  let rawBody;
  try {
    rawBody = (await buffer(req)).toString();
  } catch (err) {
    console.error('❌ Failed to read raw body:', err);
    return res.status(500).json({ error: 'Failed to read body' });
  }

  // 2. Extract signature header (format: "v1,<base64_sig>")
  const headerSig = req.headers['webhook-signature'];
  if (!headerSig || !headerSig.startsWith('v1,')) {
    return res.status(400).json({ error: 'Missing or invalid webhook-signature header' });
  }
  const receivedSig = headerSig.split(',')[1].trim();

  // 3. Compute our own HMAC-SHA256 over the raw body, base64-encoded
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  // 4. Compare signatures
  if (computedSig !== receivedSig) {
    console.error('❌ Invalid webhook signature');
    console.error('Expected:', computedSig);
    console.error('Received:', receivedSig);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 5. Parse JSON payload
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('❌ Invalid JSON in webhook body');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = payload.event_type;
  const payment = payload.data?.object;
  const orderId = payment?.id;

  // 6. Handle only "payment.confirmed" events
  if (event === 'payment.confirmed' && payment?.status === 'paid' && orderId) {
    try {
      const orderRef = db.collection('orders').doc(orderId);
      const existing = await orderRef.get();
      if (!existing.exists) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Update Firestore order to "paid"
      await orderRef.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
      });

      console.log('✅ Webhook: Payment confirmed for order', orderId);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('❌ Firestore update failed:', err);
      return res.status(500).json({ error: 'Failed to update order' });
    }
  }

  // Acknowledge other events
  return res.status(200).json({ received: true });
}
