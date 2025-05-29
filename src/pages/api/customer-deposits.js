// pages/api/customer-deposits.js (Updated for all customers, live)
import { db } from '../../lib/firebaseAdmin'; // Adjust path to firebaseAdmin

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // This API endpoint will now only serve the initial fetch.
    // Live updates will be handled by the frontend's Firebase listener.
    const depositsSnapshot = await db
      .collection('orders') // Your deposits are in the 'orders' collection
      .where('status', '==', 'paid') // Only paid deposits
      .orderBy('createdAt', 'desc') // Order by creation time, most recent first
      .limit(10) // Get the last 10
      .get();

    const lastDeposits = depositsSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username, // Include username for display
      amount: parseFloat(doc.data().amount || 0),
      createdAt: doc.data().createdAt, // Assuming 'createdAt' field exists and is a timestamp string
      // Include other relevant fields if needed
    }));

    res.status(200).json({
      success: true,
      deposits: lastDeposits,
    });

  } catch (error) {
    console.error('Error fetching customer deposits:', error);
    res.status(500).json({ message: `Failed to fetch customer deposits: ${error.message}` });
  }
}