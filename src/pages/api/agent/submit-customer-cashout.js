// pages/api/agent/submit-customer-cashout.js
import { db } from '../../../lib/firebaseAdmin';
import { serverTimestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Expect these from the agent dashboard
  const { agentUid, agentUsername, customerUsername, amount } = req.body;

  // Basic validation
  if (!agentUid || !agentUsername || !customerUsername || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Agent UID, Agent Username, Customer Username, and a valid positive Amount are required.' });
  }

  try {
    // Add the customer's cashout request to the 'cashouts' collection
    await db.collection('cashouts').add({
      agentUid: agentUid, // Firebase UID of the agent
      agentUsername: agentUsername, // Username of the agent
      customerUsername: customerUsername, // The customer's username
      amount: parseFloat(amount),
      status: 'pending', // Initial status
      requestedAt: serverTimestamp(), // Timestamp for the request
      // You might add other fields like:
      // customerId: 'customer_id_from_your_system',
      // paymentMethod: 'bank_transfer', // etc.
    });

    res.status(200).json({ success: true, message: 'Customer cashout request submitted successfully.' });
  } catch (error) {
    console.error('Error submitting customer cashout request:', error);
    res.status(500).json({ message: 'Failed to submit customer cashout request.' });
  }
}