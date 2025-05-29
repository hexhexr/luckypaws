import { db } from '../../lib/firebaseAdmin'; // Adjust path to firebaseAdmin

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username } = req.query;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const cashoutsSnapshot = await db
      .collection('cashouts') // Assuming you have a 'cashouts' collection
      .where('username', '==', username)
      .where('createdAt', '>=', twentyFourHoursAgo)
      .get();

    let totalCashoutsIn24Hours = 0;
    cashoutsSnapshot.forEach(doc => {
      totalCashoutsIn24Hours += parseFloat(doc.data().amount || 0);
    });

    const maxCashoutLimit = 300; // Define your 24-hour limit
    const remainingLimit = Math.max(0, maxCashoutLimit - totalCashoutsIn24Hours);

    res.status(200).json({
      success: true,
      username: username,
      totalCashoutsToday: totalCashoutsIn24Hours,
      remainingLimit: remainingLimit,
    });

  } catch (error) {
    console.error('Error fetching cashout limit:', error);
    res.status(500).json({ message: `Failed to fetch cashout limit: ${error.message}` });
  }
}