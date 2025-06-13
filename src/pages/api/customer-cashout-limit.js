// pages/api/customer-cashout-limit.js
import { db } from '../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { withAgentAuth } from '../../lib/authMiddleware'; // BUG FIX: Import and apply agent authentication

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
    .orderBy('time', 'asc');

  const snapshot = await q.get();

  if (snapshot.empty) {
    return {
      totalCashoutsInWindow: 0,
      remainingLimit: MAX_LIMIT,
      windowResetsAt: null,
    };
  }

  const cashoutsInWindow = snapshot.docs.map(doc => doc.data());
  
  // The start of the 24-hour rolling window is the timestamp of the first cashout within the last 24 hours.
  const windowStartTime = cashoutsInWindow[0].time;
  const windowResetsAt = Timestamp.fromMillis(windowStartTime.toMillis() + TWENTY_FOUR_HOURS_MS);

  // If the window has already reset, return the full limit.
  if (windowResetsAt.toMillis() < now.toMillis()) {
      return {
          totalCashoutsInWindow: 0,
          remainingLimit: MAX_LIMIT,
          windowResetsAt: null,
      };
  }
  
  const totalCashoutsInWindow = cashoutsInWindow.reduce((sum, cashout) => {
    // Ensure we only sum cashouts that fall within the current active window
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
  // This endpoint is now protected and req.decodedToken is available.
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

// BUG FIX: This handler is now wrapped with agent authentication for security.
export default withAgentAuth(handler);