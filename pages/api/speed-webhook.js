import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.SPEED_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'Missing webhook secret' });

  let rawBody;
  try {
    rawBody = (await buffer(req)).toString();
  } catch (err) {
    console.error('Failed to read raw body:', err);
    return res.status(500).json({ error: 'Failed to read body' });
  }

  const headerSig = req.headers['webhook-signature'];
  if (!headerSig?.startsWith('v1,')) return res.status(400).json({ error: 'Invalid signature header' });

  const receivedSig = headerSig.split(',')[1].trim();
  const computedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  if (computedSig !== receivedSig) {
    console.error('❌ Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

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

  return res.status(200).json({ received: true });
}
