// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import * as bolt11 from 'lightning-invoice';
import { withAuth } from '../../../../lib/authMiddleware';
import { checkCashoutLimit } from '../../customer-cashout-limit'; // Import the new limit logic

// --- Helper function to get real-time BTC price ---
async function getBtcPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!response.ok) throw new Error('Failed to fetch BTC price from CoinGecko');
    const data = await response.json();
    return data.bitcoin.usd;
  } catch (error) {
    return 70000; // Fallback price
  }
}

// --- Helper function to identify Lightning Address ---
function isLightningAddress(address) {
  if (typeof address !== 'string') return false;
  const lightningAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  return lightningAddressRegex.test(address);
}

// --- Main handler for sending cashouts ---
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, destination, usdAmount: usdAmountStr } = req.body;
  const SPEED_API_KEY = process.env.SPEED_SECRET_KEY;
  const SPEED_API_URL = process.env.SPEED_API_URL || 'https://api.tryspeed.com/v1';

  let usdAmount = usdAmountStr ? parseFloat(usdAmountStr) : null;
  const cashoutRef = db.collection('cashouts').doc();

  try {
    const btcPrice = await getBtcPrice();
    const satsPerUsd = (1 / btcPrice) * 100_000_000;
    let satsToPay = null;
    let bolt11InvoiceToPay = destination;

    if (isLightningAddress(destination)) {
      if (!usdAmount || usdAmount <= 0) throw new Error('A valid USD amount is required for Lightning Address cashouts.');
      satsToPay = Math.round(usdAmount * satsPerUsd);
    } else if (destination.startsWith('lnbc')) {
      const decoded = bolt11.decode(destination);
      satsToPay = decoded.satoshis || (decoded.millisatoshis ? parseInt(decoded.millisatoshis) / 1000 : null);
      if (satsToPay && satsToPay > 0) {
        usdAmount = parseFloat((satsToPay / satsPerUsd).toFixed(2));
      } else {
        if (!usdAmount || usdAmount <= 0) throw new Error('A valid USD amount is required for amountless invoices.');
        satsToPay = Math.round(usdAmount * satsPerUsd);
      }
    } else {
      throw new Error('Invalid destination: Must be a Bolt11 invoice or Lightning Address.');
    }

    if (!usdAmount || usdAmount <= 0) {
        throw new Error('Final USD amount could not be determined or is zero.');
    }

    // *** ENFORCE CASHOUT LIMIT ***
    const limitData = await checkCashoutLimit(username);
    if (usdAmount > limitData.remainingLimit) {
      return res.status(400).json({
        message: `Cashout amount of $${usdAmount.toFixed(2)} exceeds the remaining 24-hour limit of $${limitData.remainingLimit.toFixed(2)} for this user.`
      });
    }
    // ****************************

    const initialCashoutData = {
      id: cashoutRef.id,
      username,
      amountUSD: usdAmount,
      amountSats: satsToPay,
      destination,
      time: Timestamp.now(),
      status: 'completed', // For manual admin cashouts, we mark as completed immediately
    };
    await cashoutRef.set(initialCashoutData);

    // This section can be uncommented if you want to pay via Speed API automatically
    /*
    const speedResponse = await fetch(`${SPEED_API_URL}/payments`, { ... });
    const paymentResult = await speedResponse.json();
    if (!speedResponse.ok) {
      await cashoutRef.update({ status: 'failed', description: `Error: ${paymentResult.message}` });
      throw new Error(paymentResult.message);
    }
    await cashoutRef.update({ paymentGatewayId: paymentResult.id });
    */

    res.status(201).json({
      success: true,
      message: `Cashout successfully recorded for ${username}.`,
      details: initialCashoutData,
    });

  } catch (error) {
    console.error('[Handler] Full error processing cashout:', error);
    res.status(500).json({ message: error.message || 'An unexpected error occurred.' });
  }
};

export default withAuth(handler);