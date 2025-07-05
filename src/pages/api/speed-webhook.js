// src/pages/api/speed-webhook.js
import { buffer } from 'micro';
import crypto from 'crypto';
import { db } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export const config = { api: { bodyParser: false } };

/**
 * A helper function to verify the webhook signature from Speed.
 * This combines all verification logic into one clean function.
 */
function verifySignature(rawBody, headers, secret) {
    const headerSig = headers['webhook-signature'];
    const webhookId = headers['webhook-id'];
    const webhookTimestamp = headers['webhook-timestamp'];

    if (!headerSig || !webhookId || !webhookTimestamp) {
        console.error('❌ Missing required webhook headers.');
        return false;
    }

    const [algo, receivedSig] = headerSig.split(',');
    if (algo !== 'v1' || !receivedSig) {
        console.error('❌ Invalid webhook signature format.');
        return false;
    }

    const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const computedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('base64');

    const receivedSigBuffer = Buffer.from(receivedSig, 'base64');
    const computedSigBuffer = Buffer.from(computedSig, 'base64');

    return receivedSigBuffer.length === computedSigBuffer.length && crypto.timingSafeEqual(receivedSigBuffer, computedSigBuffer);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secretEnv = process.env.SPEED_WEBHOOK_SECRET;
    if (!secretEnv) {
        console.error('CRITICAL: Missing Speed webhook secret.');
        return res.status(500).json({ error: 'Missing webhook secret' });
    }
    const secret = Buffer.from(secretEnv.replace(/^wsec_/, ''), 'base64');

    const rawBody = (await buffer(req)).toString();

    // Use the helper function for a clean verification check
    if (!verifySignature(rawBody, req.headers, secret)) {
        return res.status(400).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    const payment = payload?.data?.object;
    
    // The payment ID from Speed matches the document ID we created in 'orders'
    const orderId = payment?.id;

    if (!orderId) {
        console.log(`ℹ️ Webhook received event "${eventType}" with no payment ID. Skipping.`);
        return res.status(200).json({ received: true });
    }

    // --- THIS IS THE CRITICAL FIX ---
    // Customer payments (deposits) are in the 'orders' collection.
    // This now correctly points to the document we need to update.
    const orderRef = db.collection('orders').doc(orderId);

    try {
        if (eventType === 'payment.confirmed' && payment?.status === 'paid') {
            console.log(`✅ Webhook: Received 'payment.confirmed' for order ID: ${orderId}`);
            
            // Update the status of the document in the 'orders' collection
            await orderRef.update({
                status: 'paid',
                paidAt: Timestamp.now(),
                read: false, // Mark as unread for the admin dashboard
            });
            console.log(`✅ Order ${orderId} successfully marked as paid.`);

        } else if (eventType === 'payment.failed') {
            console.log(`⚠️ Webhook: Received 'payment.failed' for order ID: ${orderId}`);
            
            // Update the status for a failed payment in the 'orders' collection
            await orderRef.update({
                status: 'failed',
                failureReason: payment?.failure_reason || 'Unknown reason from webhook',
            });
            console.log(`⚠️ Order ${orderId} marked as failed.`);
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error(`❌ Firestore update failed for order ${orderId}:`, err);
        // Returning 500 so the webhook provider might retry the request
        return res.status(500).json({ error: 'Failed to update order status in database.' });
    }
}