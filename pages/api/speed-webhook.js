// pages/api/webhooks/speed-webhook.js
import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin'; // Assuming this path is correct for your webhook file

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretEnv = process.env.SPEED_WEBHOOK_SECRET;
  if (!secretEnv) {
    console.error('CRITICAL: Missing webhook secret (SPEED_WEBHOOK_SECRET environment variable).');
    return res.status(500).json({ error: 'Missing webhook secret' });
  }

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
    console.error('❌ Missing required webhook headers.');
    return res.status(400).json({ error: 'Missing required webhook headers' });
  }

  // Signature is expected to be like: v1,<base64_signature>
  const [algo, receivedSig] = headerSig.split(',');
  if (algo !== 'v1' || !receivedSig) {
    console.error('❌ Invalid webhook signature format.');
    return res.status(400).json({ error: 'Invalid webhook signature format' });
  }

  // Compute signature
  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const computedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64');

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
    console.error('❌ Invalid JSON payload.');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Handle your business logic
  const payment = payload?.data?.object;
  // IMPORTANT: The ID you stored in 'paymentGatewayId' in profitLoss in send.js
  // must match what TrySpeed sends as payment.id or payment.hash in the webhook.
  const paymentGatewayIdFromWebhook = payment?.id || payment?.payment_hash; 

  if (payload.event_type === 'payment.confirmed' && payment?.status === 'paid' && paymentGatewayIdFromWebhook) {
    try {
      // CHANGE THIS: Update the 'profitLoss' collection, not 'orders'
      // Look up the document by the paymentGatewayId
      const profitLossQuery = db.collection('profitLoss').where('paymentGatewayId', '==', paymentGatewayIdFromWebhook);
      const snapshot = await profitLossQuery.get();

      if (snapshot.empty) {
        console.warn('❌ Webhook: No matching profitLoss entry found for paymentGatewayId:', paymentGatewayIdFromWebhook);
        // It's possible the cashout hasn't been recorded yet, or a mismatch. Return 200 to avoid retries.
        return res.status(200).json({ error: 'ProfitLoss entry not found for this payment ID, possibly not yet recorded or ID mismatch.' });
      }

      // Assuming there's only one match (should be unique by paymentGatewayId)
      const profitLossDoc = snapshot.docs[0];
      
      // Update the status of the profitLoss entry
      await profitLossDoc.ref.update({ 
        status: 'completed', 
        paidAt: new Date().toISOString(), // Record when it was paid
        webhookEventId: webhookId, // Store the webhook ID for auditing
        webhookTimestamp: webhookTimestamp // Store timestamp for auditing
      });
      console.log('✅ Webhook: ProfitLoss entry confirmed and updated for Payment ID:', paymentGatewayIdFromWebhook);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firestore update failed:', err);
      return res.status(500).json({ error: 'Failed to update profitLoss entry' });
    }
  } else if (payload.event_type === 'payment.failed' && paymentGatewayIdFromWebhook) {
    try {
      // Handle failed payments as well
      const profitLossQuery = db.collection('profitLoss').where('paymentGatewayId', '==', paymentGatewayIdFromWebhook);
      const snapshot = await profitLossQuery.get();

      if (!snapshot.empty) {
        const profitLossDoc = snapshot.docs[0];
        await profitLossDoc.ref.update({
          status: 'failed',
          failedAt: new Date().toISOString(),
          failureReason: payment?.failure_reason || 'Unknown',
          webhookEventId: webhookId,
          webhookTimestamp: webhookTimestamp
        });
        console.log('⚠️ Webhook: ProfitLoss entry marked as FAILED for Payment ID:', paymentGatewayIdFromWebhook);
      } else {
        console.warn('❌ Webhook: No matching profitLoss entry found to mark as failed for paymentGatewayId:', paymentGatewayIdFromWebhook);
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Firestore update for failed payment failed:', err);
      return res.status(500).json({ error: 'Failed to update profitLoss entry for failed payment' });
    }
  }


  // Acknowledge receipt for other events or if conditions don't match
  console.log(`ℹ️ Webhook: Received event_type "${payload.event_type}", status "${payment?.status}", not specifically handled or missing ID.`);
  return res.status(200).json({ received: true });
}