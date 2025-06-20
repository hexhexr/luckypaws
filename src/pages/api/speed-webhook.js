// pages/api/webhooks/speed-webhook.js
import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretEnv = process.env.SPEED_WEBHOOK_SECRET;
  if (!secretEnv) {
    console.error('CRITICAL: Missing webhook secret (SPEED_WEBHOOK_SECRET environment variable).');
    return res.status(500).json({ error: 'Missing webhook secret' });
  }
  
  const secret = Buffer.from(secretEnv.replace(/^wsec_/, ''), 'base64');

  let rawBody;
  try {
    rawBody = (await buffer(req)).toString();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read body' });
  }

  const headerSig = req.headers['webhook-signature'];
  const webhookId = req.headers['webhook-id'];
  const webhookTimestamp = req.headers['webhook-timestamp'];

  if (!headerSig || !webhookId || !webhookTimestamp) {
    return res.status(400).json({ error: 'Missing required webhook headers' });
  }

  const [algo, receivedSig] = headerSig.split(',');
  if (algo !== 'v1' || !receivedSig) {
    return res.status(400).json({ error: 'Invalid webhook signature format' });
  }

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const computedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64');

  const receivedSigBuffer = Buffer.from(receivedSig, 'base64');
  const computedSigBuffer = Buffer.from(computedSig, 'base64');
  if (
    receivedSigBuffer.length !== computedSigBuffer.length ||
    !crypto.timingSafeEqual(receivedSigBuffer, computedSigBuffer)
  ) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const payment = payload?.data?.object;
  const paymentGatewayIdFromWebhook = payment?.id || payment?.payment_hash; 

  if (payload.event_type === 'payment.confirmed' && payment?.status === 'paid' && paymentGatewayIdFromWebhook) {
    try {
      // --- FIX: Query the correct 'cashouts' collection ---
      const cashoutsQuery = db.collection('cashouts').where('paymentGatewayId', '==', paymentGatewayIdFromWebhook);
      const snapshot = await cashoutsQuery.get();

      if (snapshot.empty) {
        console.warn('Webhook: No matching cashout entry found for paymentGatewayId:', paymentGatewayIdFromWebhook);
        return res.status(200).json({ error: 'Cashout entry not found, possibly not yet recorded or ID mismatch.' });
      }

      const cashoutDoc = snapshot.docs[0];
      
      await cashoutDoc.ref.update({ 
        status: 'completed', 
        paidAt: new Date().toISOString(),
        webhookEventId: webhookId,
        webhookTimestamp: webhookTimestamp
      });
      console.log('✅ Webhook: Cashout entry confirmed and updated for Payment ID:', paymentGatewayIdFromWebhook);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firestore update failed:', err);
      return res.status(500).json({ error: 'Failed to update cashout entry' });
    }
  } else if (payload.event_type === 'payment.failed' && paymentGatewayIdFromWebhook) {
    try {
      // --- FIX: Query the correct 'cashouts' collection ---
      const cashoutsQuery = db.collection('cashouts').where('paymentGatewayId', '==', paymentGatewayIdFromWebhook);
      const snapshot = await cashoutsQuery.get();

      if (!snapshot.empty) {
        const cashoutDoc = snapshot.docs[0];
        await cashoutDoc.ref.update({
          status: 'failed',
          failedAt: new Date().toISOString(),
          failureReason: payment?.failure_reason || 'Unknown',
          webhookEventId: webhookId,
          webhookTimestamp: webhookTimestamp
        });
        console.log('⚠️ Webhook: Cashout entry marked as FAILED for Payment ID:', paymentGatewayIdFromWebhook);
      } else {
        console.warn('Webhook: No matching cashout entry found to mark as failed for paymentGatewayId:', paymentGatewayIdFromWebhook);
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firestore update for failed payment failed:', err);
      return res.status(500).json({ error: 'Failed to update cashout entry for failed payment' });
    }
  }

  console.log(`ℹ️ Webhook: Received event_type "${payload.event_type}", status "${payment?.status}", not specifically handled or missing ID.`);
  return res.status(200).json({ received: true });
}