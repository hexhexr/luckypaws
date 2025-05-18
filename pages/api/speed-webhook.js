import { db } from '../../lib/firebaseAdmin';
import crypto from 'crypto';
import getRawBody from 'raw-body';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to read raw payload
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const secret = process.env.SPEED_WEBHOOK_SECRET;

  let raw;
  try {
    raw = await getRawBody(req);
  } catch (err) {
    console.error('❌ Error reading raw body:', err);
    return res.status(400).json({ message: 'Invalid body' });
  }

  // Extract and format the webhook signature
  const rawSignature = req.headers['webhook-signature'];
  const signature = rawSignature?.split(',')[1]; // Remove "v1," prefix if present

  const computedSig = crypto.createHmac('sha256', secret).update(raw).digest('hex');

  // Debug log
  console.log('🚨 Webhook debug log:');
  console.log('> Raw body:', raw.toString());
  console.log('> Header Signature:', signature);
  console.log('> Computed Signature:', computedSig);

  if (signature !== computedSig) {
    console.warn('❌ Invalid webhook signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    console.error('❌ JSON parse error:', err);
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  const { event_type, data } = payload;

  // Support new format: TrySpeed uses `event_type` like "payment.confirmed"
  if (event_type === 'payment.confirmed' && data?.object?.status === 'paid') {
    const orderId = data.object.id;
    try {
      await db.collection('orders').doc(orderId).update({ status: 'paid' });
      console.log('✅ Firebase updated for order ID:', orderId);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ Firebase update error:', err);
      return res.status(500).json({ message: 'Failed to update order status' });
    }
  }

  return res.status(200).json({ received: true });
}
