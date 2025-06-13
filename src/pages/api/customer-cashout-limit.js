// pages/api/customer-cashout-limit.js
import { db } from '../../lib/firebaseAdmin';
import { query, collection, where, orderBy, getDocs, Timestamp } from 'firebase-admin/firestore';

const MAX_LIMIT = 300;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function checkCashoutLimit(username) {
  const now = Timestamp.now();
  const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - TWENTY_FOUR_HOURS_MS);

  const cashoutsRef = collection(db, 'cashouts');
  const q = query(
    cashoutsRef,
    where('username', '==', username),
    where('status', '==', 'completed'),
    where('time', '>=', twentyFourHoursAgo),
    orderBy('time', 'asc') // Order ascending to find the first cashout in the window
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return {
      totalCashoutsInWindow: 0,
      remainingLimit: MAX_LIMIT,
      windowResetsAt: null,
    };
  }

  const cashoutsInWindow = snapshot.docs.map(doc => doc.data());
  
  // The first document is the start of the 24-hour window
  const windowStartTime = cashoutsInWindow[0].time;
  const windowResetsAt = Timestamp.fromMillis(windowStartTime.toMillis() + TWENTY_FOUR_HOURS_MS);

  // If the reset time is in the past, this window is over.
  if (windowResetsAt.toMillis() < now.toMillis()) {
      return {
          totalCashoutsInWindow: 0,
          remainingLimit: MAX_LIMIT,
          windowResetsAt: null,
      };
  }
  
  const totalCashoutsInWindow = cashoutsInWindow.reduce((sum, cashout) => {
    // Only sum up transactions that are within the specific window
    if (cashout.time.toMillis() < windowResetsAt.toMillis()) {
        return sum + parseFloat(cashout.amountUSD || 0);
    }
    return sum;
  }, 0);

  const remainingLimit = Math.max(0, MAX_LIMIT - totalCashoutsInWindow);

  return {
    totalCashoutsInWindow,
    remainingLimit,
    windowResetsAt: windowResetsAt.toDate().toISOString(),
  };
}

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username } = req.query;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const limitData = await checkCashoutLimit(username.trim());
    return res.status(200).json({
      success: true,
      username: username.trim(),
      ...limitData,
    });
  } catch (err) {
    console.error('Error getting cashout limit:', err);
    return res.status(500).json({ message: `Internal server error: ${err.message}` });
  }
};

export default handler; // This endpoint can be public for agents to check, but should be rate-limited in production