// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin';
import * as bolt11 from 'lightning-invoice';
import { withAuth } from '../../../../lib/authMiddleware'; // Import the authentication middleware

// --- Helper function to get real-time BTC price ---
async function getBtcPrice() {
  try {
    // Using a public, reliable API for BTC price in USD
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!response.ok) {
      throw new Error('Failed to fetch BTC price from CoinGecko');
    }
    const data = await response.json();
    const price = data.bitcoin.usd;
    if (!price) {
      throw new Error('Invalid price data from API');
    }
    console.log(`[PriceFetch] Current BTC Price: $${price}`);
    return price;
  } catch (error) {
    console.error('[PriceFetch] Error fetching BTC price:', error);
    // Fallback price to prevent total failure, but you should monitor this.
    return 30000; // A reasonable fallback, but real-time is preferred.
  }
}

// --- Helper function to identify Lightning Address ---
function isLightningAddress(address) {
  if (typeof address !== 'string') return false;
  const lightningAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  return lightningAddressRegex.test(address);
}

// --- Helper function to fetch Bolt11 invoice from a Lightning Address ---
async function fetchInvoiceFromLightningAddress(lightningAddress, amountMsat) {
  try {
    const [username, domain] = lightningAddress.split('@');
    const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
    console.log(`[LNURL] Fetching parameters from: ${lnurlpUrl}`);

    const lnurlRes = await fetch(lnurlpUrl);
    if (!lnurlRes.ok) throw new Error(`LNURL-pay endpoint failed: ${lnurlRes.statusText}`);
    const lnurlData = await lnurlRes.json();

    if (lnurlData.tag !== 'payRequest') throw new Error('Invalid LNURL-pay response.');
    if (amountMsat < lnurlData.minSendable || amountMsat > lnurlData.maxSendable) {
      throw new Error(`Amount is outside the acceptable range for this Lightning Address.`);
    }

    const callbackUrl = new URL(lnurlData.callback);
    callbackUrl.searchParams.append('amount', amountMsat);

    console.log(`[LNURL] Fetching invoice from callback: ${callbackUrl.toString()}`);
    const invoiceRes = await fetch(callbackUrl.toString());
    if (!invoiceRes.ok) throw new Error(`Callback failed: ${invoiceRes.statusText}`);
    const invoiceData = await invoiceRes.json();

    if (!invoiceData.pr) throw new Error('Invoice not found in callback response.');
    return invoiceData.pr;
  } catch (error) {
    console.error(`[LNURL] Error fetching invoice from ${lightningAddress}:`, error.message);
    throw new Error(`Could not generate invoice from Lightning Address: ${error.message}`);
  }
}

// --- Main handler for sending cashouts ---
const handler = async (req, res) => { // Define handler as a const
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, destination, usdAmount: usdAmountStr } = req.body;
  const SPEED_API_KEY = process.env.SPEED_SECRET_KEY; // CORRECTED KEY
  const SPEED_API_URL = process.env.SPEED_API_URL || 'https://api.tryspeed.com/v1';

  if (!SPEED_API_KEY) {
    console.error('CRITICAL: SPEED_SECRET_KEY is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error: Payment gateway key is missing.' });
  }

  if (!username || !destination) {
    return res.status(400).json({ message: 'Missing username or destination.' });
  }

  let bolt11InvoiceToPay = destination;
  let usdAmount = usdAmountStr ? parseFloat(usdAmountStr) : null;
  let satsToPay = null;
  const cashoutRef = db.collection('cashouts').doc(); // Prepare a new document reference

  try {
    const btcPrice = await getBtcPrice();
    const satsPerUsd = (1 / btcPrice) * 100_000_000;

    if (isLightningAddress(destination)) {
      if (!usdAmount || usdAmount <= 0) {
        throw new Error('A valid USD amount is required for Lightning Address cashouts.');
      }
      satsToPay = Math.round(usdAmount * satsPerUsd);
      const amountMsat = satsToPay * 1000;
      bolt11InvoiceToPay = await fetchInvoiceFromLightningAddress(destination, amountMsat);
    } else if (destination.startsWith('lnbc')) {
      const decoded = bolt11.decode(destination);
      const invoiceMsats = decoded.millisatoshis ? parseInt(decoded.millisatoshis) : null;
      satsToPay = decoded.satoshis || (invoiceMsats ? invoiceMsats / 1000 : null);

      if (satsToPay && satsToPay > 0) {
        usdAmount = parseFloat((satsToPay / satsPerUsd).toFixed(2));
      } else {
        if (!usdAmount || usdAmount <= 0) {
          throw new Error('A valid USD amount is required for amountless invoices.');
        }
        satsToPay = Math.round(usdAmount * satsPerUsd);
      }
    } else {
      throw new Error('Invalid destination: Must be a Bolt11 invoice or Lightning Address.');
    }

    if (!satsToPay || satsToPay <= 0) {
      throw new Error('Final amount could not be determined or is zero.');
    }

    // --- Record initial cashout attempt in Firebase ---
    const initialCashoutData = {
      id: cashoutRef.id,
      username,
      amountUSD: usdAmount,
      amountSats: satsToPay,
      amountBTC: parseFloat((satsToPay / 100_000_000).toFixed(8)),
      destination,
      sentInvoice: bolt11InvoiceToPay,
      type: 'cashout_lightning',
      description: `Initiating Lightning cashout...`,
      time: new Date().toISOString(),
      addedBy: 'admin_dashboard_automation',
      paymentGatewayId: null,
      status: 'initializing', // NEW STATUS
    };
    await cashoutRef.set(initialCashoutData);

    // --- Send payment via TrySpeed API ---
    console.log(`[TrySpeed] Sending ${satsToPay} sats...`);
    const speedResponse = await fetch(`${SPEED_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SPEED_API_KEY}`,
      },
      body: JSON.stringify({ invoice: bolt11InvoiceToPay }),
    });

    const paymentResult = await speedResponse.json();
    console.log('[TrySpeed] Payment API Response:', paymentResult);

    if (!speedResponse.ok) {
      const errorMessage = paymentResult.message || `TrySpeed API Error: ${speedResponse.status}`;
      await cashoutRef.update({ status: 'failed', description: `Error: ${errorMessage}` });
      throw new Error(errorMessage);
    }

    // --- Update Firebase with final status ---
    const finalCashoutData = {
      status: paymentResult.status || 'completed',
      paymentGatewayId: paymentResult.id || null,
      description: `Cashout successful. TrySpeed Payment ID: ${paymentResult.id}.`,
    };
    await cashoutRef.update(finalCashoutData);

    res.status(201).json({
      success: true,
      message: `Cashout successfully processed for ${username}.`,
      details: { ...initialCashoutData, ...finalCashoutData },
    });

  } catch (error) {
    console.error('[Handler] Full error processing cashout:', error);
    // Update Firebase with failure status if an error occurred before the API call
    // Ensure cashoutRef.id exists, otherwise it might try to update a non-existent doc
    if (cashoutRef.id) { // Only attempt to update if a document was already created
      await db.collection('cashouts').doc(cashoutRef.id).set({
          status: 'failed',
          description: error.message,
          username: username || 'unknown',
          destination: destination || 'unknown',
          time: new Date().toISOString()
      }, { merge: true });
    }
    res.status(500).json({ message: error.message || 'An unexpected error occurred.' });
  }
};

export default withAuth(handler); // Wrap the handler with the authentication middleware