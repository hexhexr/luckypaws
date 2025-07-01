import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Admin identity is verified by withAuth middleware
  const { requestId, paymentPreimage } = req.body;

  if (!requestId || !paymentPreimage) {
    return res.status(400).json({ message: 'Request ID and payment preimage are required.' });
  }

  try {
    const requestRef = db.collection('agentCashoutRequests').doc(requestId);
    const doc = await requestRef.get();

    // First, check if the document actually exists
    if (!doc.exists) {
        console.error(`Attempted to update a non-existent cashout request with ID: ${requestId}`);
        return res.status(404).json({ message: "The requested cashout does not exist." });
    }

    // Safely get the admin's email with a fallback
    const adminEmail = req.decodedToken?.email || 'Unknown Admin';

    // Update the document with the proof of payment
    await requestRef.update({
      status: 'paid',
      paidAt: Timestamp.now(),
      paymentDetails: {
        preimage: paymentPreimage,
        paidBy: adminEmail,
      }
    });

    res.status(200).json({ success: true, message: 'Request status updated successfully.' });
  } catch (error) {
    console.error(`[API Error] Failed to update agent request status for ${requestId}:`, error);
    res.status(500).json({ message: `Failed to update request status in database. Reason: ${error.message}` });
  }
};

export default withAuth(handler);