// src/pages/api/coinbase/verify-payment.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { orderId, txHash } = req.body;
    if (!orderId || !txHash) {
        return res.status(400).json({ message: 'Missing orderId or transaction hash.' });
    }

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const orderData = orderDoc.data();

        if (orderData.status === 'paid') {
            return res.status(200).json({ success: true, message: 'Order already verified.' });
        }

        await orderRef.update({
            status: 'paid',
            paidAt: Timestamp.now(),
            read: false,
            transactionSignature: txHash,
        });

        res.status(200).json({ success: true, message: 'Payment verified and order updated.' });

    } catch (error) {
        console.error(`Error verifying payment for order ${orderId}:`, error);
        res.status(500).json({ message: 'Internal server error during verification.' });
    }
}