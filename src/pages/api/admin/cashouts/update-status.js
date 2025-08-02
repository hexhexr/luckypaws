import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { requestId, paymentPreimage } = req.body;

  if (!requestId || !paymentPreimage) {
    return res.status(400).json({ message: 'Request ID and payment preimage are required.' });
  }

  const requestRef = db.collection('agentCashoutRequests').doc(requestId);
  
  // THE FIX: Create a new document reference in the main 'cashouts' collection
  const cashoutRef = db.collection('cashouts').doc();

  try {
    const adminEmail = req.decodedToken?.email || 'Unknown Admin';
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
        return res.status(404).json({ message: "The requested cashout does not exist." });
    }
    
    const requestData = requestDoc.data();

    // Use a Firestore transaction to ensure both operations succeed or fail together
    await db.runTransaction(async (transaction) => {
        // Operation 1: Update the agent's request to 'paid'
        transaction.update(requestRef, {
          status: 'paid',
          paidAt: Timestamp.now(),
          paymentDetails: {
            preimage: paymentPreimage,
            paidBy: adminEmail,
          }
        });

        // Operation 2: Create a new, official record in the 'cashouts' collection
        transaction.set(cashoutRef, {
            id: cashoutRef.id,
            username: requestData.username,
            amountUSD: parseFloat(requestData.amount || 0),
            amountSats: 0, // Not applicable for this type of cashout
            type: 'cashout_agent_request', // A specific type for clear tracking
            description: `Agent request from ${requestData.agentName} for ${requestData.facebookName}`,
            time: Timestamp.now(),
            addedBy: adminEmail,
            status: 'completed',
            destination: requestData.address,
            relatedAgentRequestId: requestId, // Link back to the original request
        });
    });

    res.status(200).json({ success: true, message: 'Request approved and cashout record created successfully.' });
  } catch (error) {
    console.error(`[API Error] Failed to process agent request ${requestId}:`, error);
    res.status(500).json({ message: `Failed to process request. Reason: ${error.message}` });
  }
};

export default withAuth(handler);