// src/pages/api/coinbase/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return res.status(500).json({ error: 'Webhook secret is not configured.' });
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    
    const signature = req.headers['x-cc-webhook-signature'];
    try {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(rawBody);
        const digest = hmac.digest('hex');

        if (digest !== signature) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Webhook signature verification failed.' });
    }

    const event = JSON.parse(rawBody);
    const { type, data } = event;

    if (type === 'charge:confirmed') {
        const { metadata } = data;
        const { orderId } = metadata;

        if (!orderId) {
            return res.status(400).json({ error: 'Missing orderId in webhook metadata.' });
        }

        const orderRef = db.collection('orders').doc(orderId);

        try {
            await orderRef.update({
                status: 'paid',
                paidAt: Timestamp.now(),
                read: false,
            });
        } catch (error) {
            console.error(`Failed to update order ${orderId}:`, error);
            return res.status(500).json({ error: 'Failed to update order status.' });
        }
    }

    res.status(200).json({ success: true, message: 'Webhook received.' });
}