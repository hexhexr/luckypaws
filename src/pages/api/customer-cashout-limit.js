// pages/api/customer-cashout-limit.js
import { db } from '../../lib/firebaseAdmin'; // Ensure this path is correct for your Firebase Admin SDK

export default async function handler(req, res) {
  // Ensure only GET requests are allowed
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username } = req.query;

  // Validate incoming data
  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const now = new Date();
    // Calculate 24 hours ago in ISO string format for Firestore comparison
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Query the 'cashouts' collection for the specific username within the last 24 hours
    const snapshot = await db
      .collection('cashouts')
      .where('username', '==', username.trim().toLowerCase()) // Ensure case-insensitive comparison if usernames are stored lowercase
      .where('createdAt', '>=', twentyFourHoursAgo) // Filter by creation time
      .get();

    let totalCashouts = 0;
    // Iterate through the documents and sum up the cashout amounts
    snapshot.forEach(doc => {
      const amt = parseFloat(doc.data()?.amount || 0); // Safely get amount, default to 0
      if (!isNaN(amt)) totalCashouts += amt; // Add to total if it's a valid number
    });

    const maxLimit = 300; // Define the maximum cashout limit
    const remaining = Math.max(0, maxLimit - totalCashouts); // Calculate remaining limit, ensuring it's not negative

    // Return success response with the calculated limits
    return res.status(200).json({
      success: true,
      username,
      totalCashoutsToday: totalCashouts,
      remainingLimit: remaining,
    });
  } catch (err) {
    console.error('Error getting cashout limit:', err);
    return res.status(500).json({ message: `Internal server error: ${err.message}` });
  }
}
