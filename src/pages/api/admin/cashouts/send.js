// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import * as bolt11 from 'lightning-invoice';
import { withAuth } from '../../../../lib/authMiddleware';

async function getBtcPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!response.ok) throw new Error('Failed to fetch BTC price from CoinGecko');
    const data = await response.json();
    const price = data.bitcoin.usd;
    if (!price) throw new Error('Invalid price data from API');
    return price;
  } catch (error) {
    console.error('[PriceFetch] Error:', error);
    return 70000;
  }
}

function isLightningAddress(address) {
  if (typeof address !== 'string') return false;
  const lightningAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  return lightningAddressRegex.test(address);
}

async function fetchInvoiceFromLightningAddress(lightningAddress, amountMsat) {
  try {
    const [username, domain] = lightningAddress.split('@');
    const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
    const lnurlRes = await fetch(lnurlpUrl);
    if (!lnurlRes.ok) throw new Error(`LNURL-pay endpoint failed: ${lnurlRes.statusText}`);
    const lnurlData = await lnurlRes.json();
    if (lnurlData.tag !== 'payRequest') throw new Error('Invalid LNURL-pay response.');
    if (amountMsat < lnurlData.minSendable || amountMsat > lnurlData.maxSendable) {
      throw new Error(`Amount is outside the acceptable range for this Lightning Address.`);
    }
    const callbackUrl = new URL(lnurlData.callback);
    callbackUrl.searchParams.append('amount', amountMsat);
    const invoiceRes = await fetch(callbackUrl.toString());
    if (!invoiceRes.ok) throw new Error(`Callback failed: ${invoiceRes.statusText}`);
    const invoiceData = await invoiceRes.json();
    if (!invoiceData.pr) throw new Error('Invoice not found in callback response.');
    return invoiceData.pr;
  } catch (error) {
    throw new Error(`Could not generate invoice from Lightning Address: ${error.message}`);
  }
}

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, destination, usdAmount: usdAmountStr } = req.body;
  const SPEED_API_KEY = process.env.SPEED_SECRET_KEY;
  const SPEED_API_URL = process.env.SPEED_API_URL || 'https://api.tryspeed.com/v1';
  
  const cashoutRef = db.collection('cashouts').doc();
  let usdAmount = usdAmountStr ? parseFloat(usdAmountStr) : null;
  let satsToPay;

  try {
    const btcPrice = await getBtcPrice();
    const satsPerUsd = (1 / btcPrice) * 100_000_000;
    let bolt11InvoiceToPay = destination;

    if (isLightningAddress(destination)) {
      if (!usdAmount || usdAmount <= 0) throw new Error('USD amount required for Lightning Address.');
      satsToPay = Math.round(usdAmount * satsPerUsd);
      bolt11InvoiceToPay = await fetchInvoiceFromLightningAddress(destination, satsToPay * 1000);
    } else if (destination.startsWith('lnbc')) {
      const decoded = bolt11.decode(destination);
      satsToPay = decoded.satoshis || (decoded.millisatoshis ? parseInt(decoded.millisatoshis) / 1000 : null);
      if (satsToPay > 0) {
        usdAmount = parseFloat((satsToPay / satsPerUsd).toFixed(2));
      } else {
        if (!usdAmount || usdAmount <= 0) throw new Error('USD amount required for amountless invoice.');
        satsToPay = Math.round(usdAmount * satsPerUsd);
      }
    } else {
      throw new Error('Invalid destination: Must be a Bolt11 invoice or Lightning Address.');
    }

    if (!satsToPay || satsToPay <= 0) throw new Error('Final amount is zero or could not be determined.');
    
    const initialCashoutData = {
      id: cashoutRef.id,
      username,
      amountUSD: usdAmount,
      amountSats: satsToPay,
      destination,
      time: Timestamp.now(), // THE FIX IS HERE
      status: 'initializing',
    };
    await cashoutRef.set(initialCashoutData);

    const speedResponse = await fetch(`${SPEED_API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SPEED_API_KEY}` },
      body: JSON.stringify({ invoice: bolt11InvoiceToPay }),
    });

    const paymentResult = await speedResponse.json();

    if (!speedResponse.ok) {
        const errorMessage = paymentResult.message || `TrySpeed API Error: ${speedResponse.status}`;
        await cashoutRef.update({ status: 'failed', description: `Error: ${errorMessage}` });
        throw new Error(errorMessage);
    }

    const finalCashoutData = {
      status: paymentResult.status || 'completed',
      paymentGatewayId: paymentResult.id || null,
      description: `Cashout successful. TrySpeed Payment ID: ${paymentResult.id}.`
    };
    await cashoutRef.update(finalCashoutData);

    res.status(201).json({
      success: true,
      message: `Cashout successfully processed.`,
      details: { ...initialCashoutData, ...finalCashoutData },
    });
  } catch (error) {
    console.error('[Handler] Cashout Error:', error);
    await db.collection('cashouts').doc(cashoutRef.id).set({
        status: 'failed',
        description: error.message,
        username: username || 'unknown',
        destination: destination || 'unknown',
        time: Timestamp.now() // THE FIX IS HERE
    }, { merge: true });
    res.status(500).json({ message: error.message || 'An unexpected error occurred.' });
  }
};

export default withAuth(handler);