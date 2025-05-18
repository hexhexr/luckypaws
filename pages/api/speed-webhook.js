import { db } from '../../lib/firebaseAdmin';
import crypto from 'crypto';
import getRawBody from 'raw-body';

export const config = {
  api: {
    bodyParser: false,
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

  const signatureHeader = req.headers['x-speed-signature'] ||
                          req.headers['x-webhook-signature'] ||
                          req.headers['x-signature'] ||
                          req.headers['x-tryspeed-signature'];

  const computedSig = crypto.createHmac('sha256', secret).update(raw).digest('hex');

  // Debug log
  console.log('🚨 Webhook debug log:');
  console.log('> Raw body:', raw.toString());
  console.log('> Header Signature:', signatureHeader);
  console.log('> Computed Signature:', computedSig);
  console.log('> Headers:', req.headers);

  if (signatureHeader !== computedSig) {
    console.warn('❌ Invalid webhook signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString());
  } catch (err) {
    console.error('❌ JSON parse error:', err);
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  const { event, data } = payload;

  if (event === 'payment.status.updated' && data?.id && data.status === 'paid') {
    try {
      await db.collection('orders').doc(data.id).update({ status: 'paid' });
      console.log('✅ Firebase updated for order ID:', data.id);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('❌ Firebase update error:', err);
      return res.status(500).json({ message: 'Failed to update order status' });
    }
  }

  return res.status(200).json({ received: true });
}
