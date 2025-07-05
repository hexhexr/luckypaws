// src/pages/api/orders/merge.js
import { db } from '../../../lib/firebaseAdmin';
import { withAuth } from '../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { unmatchedPaymentId, pendingOrderId } = req.body;
    if (!unmatchedPaymentId || !pendingOrderId) {
        return res.status(400).json({ message: 'Both unmatched payment ID and pending order ID are required.' });
    }

    const unmatchedRef = db.collection('orders').doc(unmatchedPaymentId);
    const pendingRef = db.collection('orders').doc(pendingOrderId);

    try {
        await db.runTransaction(async (transaction) => {
            const unmatchedDoc = await transaction.get(unmatchedRef);
            const pendingDoc = await transaction.get(pendingRef);

            if (!unmatchedDoc.exists) throw new Error(`Unmatched payment with ID ${unmatchedPaymentId} not found.`);
            if (!pendingDoc.exists) throw new Error(`Pending order with ID ${pendingOrderId} not found.`);

            const unmatchedData = unmatchedDoc.data();
            const pendingData = pendingDoc.data();

            if (unmatchedData.status !== 'unmatched_payment') throw new Error('Source document is not an unmatched payment.');
            if (pendingData.status !== 'pending') throw new Error('Target document is not a pending order.');

            transaction.update(pendingRef, {
                status: 'completed',
                paidAt: unmatchedData.paidAt || Timestamp.now(),
                amountReceived: unmatchedData.amountReceived,
                transactionSignature: unmatchedData.transactionSignature,
                memo: unmatchedData.memo,
                mergedFrom: unmatchedPaymentId,
                read: false,
            });

            transaction.delete(unmatchedRef);
        });

        res.status(200).json({ success: true, message: 'Orders merged successfully.' });

    } catch (error) {
        console.error('Error merging orders:', error);
        res.status(500).json({ message: `Merge failed: ${error.message}` });
    }
};

export default withAuth(handler);