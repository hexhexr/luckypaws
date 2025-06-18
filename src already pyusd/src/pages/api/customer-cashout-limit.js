// pages/api/customer-cashout-limit.js
import { db } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { withAgentAuth } from '../../lib/authMiddleware';

const MAX_LIMIT = 300;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function checkCashoutLimit(username) {
  const now = Timestamp.now();
  const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - TWENTY_FOUR_HOURS_MS);

  const cashoutsRef = db.collection('cashouts');
  const q = cashoutsRef
    .where('username', '==', username)
    .where('status', '==', 'completed')
    .where('time', '>=', twentyFourHoursAgo)
    .orderBy('time', 'asc'); // Order by time ascending to easily find the first one

  const snapshot = await q.get();

  if (snapshot.empty) {
    return {
      totalCashoutsInWindow: 0,
      remainingLimit: MAX_LIMIT,
      windowResetsAt: null,
      firstCashoutTimeInWindow: null, // No cashouts in window
    };
  }

  const cashoutsInWindow = snapshot.docs.map(doc => doc.data());
  const firstCashout = cashoutsInWindow[0];
  const windowStartTime = firstCashout.time;
  const windowResetsAt = Timestamp.fromMillis(windowStartTime.toMillis() + TWENTY_FOUR_HOURS_MS);

  // If the reset time has passed, the window is clear
  if (windowResetsAt.toMillis() < now.toMillis()) {
      return {
          totalCashoutsInWindow: 0,
          remainingLimit: MAX_LIMIT,
          windowResetsAt: null,
          firstCashoutTimeInWindow: null,
      };
  }
  
  const totalCashoutsInWindow = cashoutsInWindow.reduce((sum, cashout) => {
    return sum + parseFloat(cashout.amountUSD || 0);
  }, 0);

  const remainingLimit = Math.max(0, MAX_LIMIT - totalCashoutsInWindow);

  return {
    totalCashoutsInWindow,
    remainingLimit,
    windowResetsAt: windowResetsAt.toDate().toISOString(),
    // Include the time of the first cashout
    firstCashoutTimeInWindow: windowStartTime.toDate().toISOString(),
  };
}

const handler = async (req, res) => {
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

export default withAgentAuth(handler);