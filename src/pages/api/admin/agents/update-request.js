// src/pages/api/admin/agents/update-request.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const adminEmail = req.decodedToken.email;
  const { requestId, status } = req.body;

  if (!requestId || !status) {
    return res.status(400).json({ message: 'Request ID and new status are required.' });
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: "Status must be either 'approved' or 'rejected'." });
  }

  try {
    const requestRef = db.collection('agentCashoutRequests').doc(requestId);
    const doc = await requestRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Agent cashout request not found.' });
    }
    
    await requestRef.update({
      status: status,
      actionTakenBy: adminEmail,
      actionTakenAt: Timestamp.now(),
    });

    res.status(200).json({ success: true, message: `Request successfully marked as ${status}.` });
  } catch (error) {
    console.error(`Error updating agent request ${requestId}:`, error);
    res.status(500).json({ message: 'Failed to update agent request status.' });
  }
};

export default withAuth(handler);