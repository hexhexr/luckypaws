import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { requestId } = req.body;
    if (!requestId) {
        return res.status(400).json({ message: 'Request ID is required.' });
    }

    const requestRef = db.collection('agentCashoutRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
        return res.status(404).json({ message: 'Request not found.' });
    }

    const requestData = requestDoc.data();

    try {
        // Call Alby API to pay the invoice
        const albyResponse = await fetch('https://api.getalby.com/payments/bolt11', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ALBY_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                invoice: requestData.address,
                amount: requestData.amount * 100 // Alby expects amount in cents
            })
        });

        const albyData = await albyResponse.json();

        if (!albyResponse.ok) {
            throw new Error(albyData.message || 'Payment failed');
        }

        // Update the request status in Firestore
        await requestRef.update({
            status: 'paid',
            paidAt: Timestamp.now(),
            paymentDetails: albyData
        });

        res.status(200).json({ success: true, message: 'Payment successful.' });

    } catch (error) {
        console.error('Error paying with wallet:', error);
        await requestRef.update({
            status: 'failed',
            failureReason: error.message
        });
        res.status(500).json({ message: error.message });
    }
};

export default withAuth(handler);