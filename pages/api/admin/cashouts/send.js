// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import * as bolt11 from 'lightning-invoice'; // npm install lightning-invoice

// --- Helper function to identify Lightning Address ---
function isLightningAddress(address) {
  if (typeof address !== 'string') return false;
  const lightningAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/i; // Case-insensitive
  return lightningAddressRegex.test(address);
}

// --- Helper function to fetch Bolt11 invoice from a Lightning Address (LNURL-pay) ---
async function fetchInvoiceFromLightningAddress(lightningAddress, amountMsat) {
  try {
    const parts = lightningAddress.split('@');
    if (parts.length !== 2) throw new Error('Invalid Lightning Address format.');
    const username = parts[0];
    const domain = parts[1];

    // 1. Fetch LNURL parameters from .well-known/lnurlp endpoint
    const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
    console.log(`[LNURL] Fetching LNURL-pay parameters from: ${lnurlpUrl}`);
    const lnurlRes = await fetch(lnurlpUrl);
    if (!lnurlRes.ok) {
      throw new Error(`Failed to fetch LNURL-pay endpoint for ${lightningAddress}: ${lnurlRes.statusText}`);
    }
    const lnurlData = await lnurlRes.json();
    console.log('[LNURL] Received LNURL-pay data:', lnurlData);

    if (lnurlData.tag !== 'payRequest') {
      throw new Error('Unexpected LNURL response tag. Expected "payRequest".');
    }

    // Check min/max sendable amounts
    if (amountMsat < lnurlData.minSendable || amountMsat > lnurlData.maxSendable) {
      throw new Error(`Amount ${amountMsat / 1000} sats is outside the acceptable range (${lnurlData.minSendable / 1000}-${lnurlData.maxSendable / 1000} sats) for this Lightning Address.`);
    }

    // 2. Call callback URL to get invoice
    const callbackUrl = new URL(lnurlData.callback);
    callbackUrl.searchParams.append('amount', amountMsat); // amount is in millisatoshis for LNURL
    console.log(`[LNURL] Fetching invoice from callback URL: ${callbackUrl.toString()}`);

    const invoiceRes = await fetch(callbackUrl.toString());
    if (!invoiceRes.ok) {
      throw new Error(`Failed to get invoice from callback for ${lightningAddress}: ${invoiceRes.statusText}`);
    }
    const invoiceData = await invoiceRes.json();
    console.log('[LNURL] Received invoice data:', invoiceData);

    if (!invoiceData.pr) {
      throw new Error('Invoice (pr) not found in LNURL callback response.');
    }

    return invoiceData.pr; // Returns the Bolt11 invoice
  } catch (error) {
    console.error(`[LNURL] Error fetching invoice from Lightning Address ${lightningAddress}:`, error.message);
    throw new Error(`Could not generate invoice from Lightning Address: ${error.message}`);
  }
}

// --- Main handler for sending cashouts ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, invoice: destination, amount: usdAmountStr } = req.body;
  const SPEED_API_KEY = process.env.SPEED_API_KEY;
  const SPEED_API_URL = process.env.SPEED_API_URL || 'https://api.tryspeed.com/v1'; // Default API URL

  if (!SPEED_API_KEY) {
    console.error('SPEED_API_KEY is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error: SPEED_API_KEY missing.' });
  }

  // --- Input Validation ---
  if (!username || !destination) {
    return res.status(400).json({ message: 'Missing username or destination (invoice/address).' });
  }

  let bolt11InvoiceToPay = destination; // Default to destination if it's a direct invoice
  let usdAmount = usdAmountStr ? parseFloat(usdAmountStr) : null;
  let satsToPay = null; // Final amount in sats for payment gateway

  try {
    if (isLightningAddress(destination)) {
      if (usdAmount === null || isNaN(usdAmount) || usdAmount <= 0) {
        throw new Error('Amount in USD is required for Lightning Address cashouts.');
      }
      // Convert USD to approximate sats for LNURL-pay request
      // IMPORTANT: Use your actual exchange rate logic here or fetch it live.
      // For demonstration, a simple approximation: 1 USD = 3000 sats
      satsToPay = Math.round(usdAmount * 3000); // Convert USD to Sats
      const amountMsat = satsToPay * 1000; // Convert sats to millisats for LNURL

      console.log(`[Cashout] Detected Lightning Address. USD: ${usdAmount}, converting to ${satsToPay} sats for LNURL-pay.`);
      bolt11InvoiceToPay = await fetchInvoiceFromLightningAddress(destination, amountMsat);
      console.log(`[Cashout] Obtained Bolt11 invoice from Lightning Address: ${bolt11InvoiceToPay.substring(0, 60)}...`);

      // After fetching invoice, decode it to get the actual amount for sending
      const decodedInvoice = bolt11.decode(bolt11InvoiceToPay);
      satsToPay = decodedInvoice.satoshis || (parseInt(decodedInvoice.millisatoshis) / 1000);
      if (!satsToPay) {
        throw new Error('Failed to determine amount from fetched invoice for Lightning Address.');
      }

    } else if (destination.startsWith('lnbc')) {
      const decoded = bolt11.decode(destination);
      const invoiceMsats = decoded.millisatoshis ? parseInt(decoded.millisatoshis) : null;
      const invoiceSats = decoded.satoshis || (invoiceMsats !== null ? invoiceMsats / 1000 : null);

      if (invoiceSats !== null && invoiceSats > 0) {
        // Fixed amount invoice
        satsToPay = invoiceSats;
        // If USD amount was also provided, we can log a warning or adjust.
        // For now, prioritize invoice amount for fixed invoices.
        if (usdAmount !== null && usdAmount.toFixed(2) !== (invoiceSats / 3000).toFixed(2)) {
             console.warn(`[Cashout] USD amount provided ($${usdAmount}) for fixed invoice (${invoiceSats} sats) does not match conversion. Using invoice amount.`);
        }
        usdAmount = (invoiceSats / 3000); // Update USD amount based on invoice sats for recording
      } else {
        // Amountless invoice
        if (usdAmount === null || isNaN(usdAmount) || usdAmount <= 0) {
          throw new Error('Amount in USD is required for amountless invoice cashouts.');
        }
        satsToPay = Math.round(usdAmount * 3000); // Convert USD to Sats for amountless invoice
        console.log(`[Cashout] Detected amountless invoice. USD: ${usdAmount}, converting to ${satsToPay} sats.`);
      }
    } else {
      throw new Error('Invalid Lightning destination format. Must be Bolt11 invoice or Lightning Address.');
    }

    if (!satsToPay || satsToPay <= 0) {
      throw new Error('Final amount to pay could not be determined or is zero.');
    }

    // --- Send payment via TrySpeed API ---
    console.log(`[TrySpeed] Attempting to send ${satsToPay} sats to ${bolt11InvoiceToPay.substring(0, 60)}...`);
    const speedResponse = await fetch(`${SPEED_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SPEED_API_KEY}`,
      },
      body: JSON.stringify({
        invoice: bolt11InvoiceToPay,
        // The 'amount' field in TrySpeed API is for fixed invoices only if you want to explicitly state the amount.
        // For fetched invoices or amountless, the invoice itself contains the amount.
        // For robustness, it's often better to let the invoice dictate the amount if it's fixed.
        // If it's an amountless invoice or LN Address, TrySpeed expects `amount_sats` if the invoice doesn't contain it.
        // For simplicity, we are relying on the invoice (from LNURL or original) to contain the amount.
      }),
    });

    const paymentResult = await speedResponse.json();
    console.log('[TrySpeed] Payment API Response:', paymentResult);

    if (!speedResponse.ok) {
      // Handle different types of errors from TrySpeed
      if (speedResponse.status === 400 && paymentResult.error_code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient funds in your TrySpeed account. Please top up. (Error: ${paymentResult.message})`);
      }
      throw new Error(paymentResult.message || `TrySpeed API error: ${speedResponse.status} ${speedResponse.statusText}`);
    }

    // --- Record cashout in Firebase ---
    const cashoutRef = db.collection('cashouts').doc(); // Store in a dedicated 'cashouts' collection
    const cashoutData = {
      id: cashoutRef.id,
      username: username,
      amountUSD: usdAmount ? parseFloat(usdAmount.toFixed(2)) : null,
      amountBTC: parseFloat((satsToPay / 100_000_000).toFixed(8)), // Convert sats to BTC
      destination: destination, // Original input: LN Address or Bolt11 invoice string
      sentInvoice: bolt11InvoiceToPay, // The actual Bolt11 invoice that was sent
      type: 'cashout_lightning',
      description: `Automated Lightning cashout. TrySpeed Payment ID: ${paymentResult.id || 'N/A'}.`,
      time: new Date().toISOString(),
      addedBy: 'admin_dashboard_automation',
      paymentGatewayId: paymentResult.id || null, // Store TrySpeed's transaction ID (usually `id` or `paymentId`)
      status: paymentResult.status || 'pending', // Use status from TrySpeed response
      // You might add more details from paymentResult if needed
    };

    await cashoutRef.set(cashoutData);
    console.log(`[Handler] Cashout recorded successfully in Firebase: ${cashoutRef.id}`);

    res.status(201).json({
      success: true,
      message: `Cashout for ${username} processed.`,
      cashoutId: cashoutRef.id,
      details: cashoutData
    });

  } catch (error) {
    console.error('[Handler] Full error processing cashout:', error);
    res.status(500).json({ message: error.message || 'An unexpected error occurred during cashout.' });
  }
}