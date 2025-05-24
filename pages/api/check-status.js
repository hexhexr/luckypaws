// pages/api/check-status.js
import { db } from '../../lib/firebaseAdmin'; // Corrected path to firebaseAdmin

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 1. Database connection check
    // This part attempts to fetch a single document from 'orders' to confirm database connectivity.
    const testDocRef = db.collection('orders').limit(1);
    await testDocRef.get();
    
    // 2. Cashout system status/summary
    // It fetches all documents from 'profitLoss' collection that are of type 'cashout' or 'cashout_lightning'.
    const cashoutsSnapshot = await db.collection('profitLoss')
      .where('type', 'in', ['cashout', 'cashout_lightning'])
      .get();

    let totalCashouts = 0;
    let totalUsdCashedOut = 0;
    let totalBtcCashedOut = 0;
    let pendingCashouts = 0;
    let completedCashouts = 0;

    cashoutsSnapshot.docs.forEach(doc => {
      totalCashouts++;
      const data = doc.data();
      // Sum USD amounts (from manual cashouts or USD-based lightning cashouts)
      if (data.amountUSD) {
        totalUsdCashedOut += data.amountUSD;
      }
      // Sum BTC amounts (primarily from lightning cashouts)
      if (data.amountBTC) { 
        totalBtcCashedOut += data.amountBTC;
      }
      // Count cashouts by status
      if (data.status === 'pending') {
        pendingCashouts++;
      } else if (data.status === 'completed') {
        completedCashouts++;
      }
    });

    res.status(200).json({
      status: 'ok',
      message: 'API and database connected successfully.',
      cashoutSummary: {
        totalCashouts: totalCashouts,
        totalUsdCashedOut: parseFloat(totalUsdCashedOut.toFixed(2)), // Format to 2 decimal places for USD
        totalBtcCashedOut: parseFloat(totalBtcCashedOut.toFixed(8)), // Format to 8 decimal places for BTC
        pendingCashouts: pendingCashouts,
        completedCashouts: completedCashouts
      }
    });
  } catch (error) {
    console.error('API Status Check Error:', error);
    res.status(500).json({ status: 'error', message: `Failed to connect to database or fetch cashout data: ${error.message}` });
  }
}