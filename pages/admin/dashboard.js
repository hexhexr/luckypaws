// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin';
import * as bolt11 from 'lightning-invoice';

// If not using global fetch (Node 18+), or if you prefer node-fetch:
// import fetch from 'node-fetch'; // npm install node-fetch

// --- Helper function to identify Lightning Address ---
function isLightningAddress(address) {
  if (typeof address !== 'string') return false;
  // Basic regex for email-like structure, common for Lightning Addresses
  const lightningAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return lightningAddressRegex.test(address);
}

// --- Helper function to fetch Bolt11 invoice from a Lightning Address (LNURL-pay) ---
async function fetchInvoiceFromLightningAddress(lightningAddress, amountMsat) {
  // amountMsat is the desired payment amount in millisatoshis
  console.log(`[LNURL] Attempting to fetch invoice for ${lightningAddress} with ${amountMsat} msats.`);
  try {
    const parts = lightningAddress.split('@');
    if (parts.length !== 2) throw new Error('Invalid Lightning Address format.');
    const username = parts[0];
    const domain = parts[1];

    // 1. Fetch LNURL parameters from .well-known/lnurlp endpoint
    const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${username}`;
    console.log(`[LNURL] Fetching parameters from: ${lnurlpUrl}`);
    const lnurlpResponse = await fetch(lnurlpUrl, { headers: { 'Accept': 'application/json' } });

    if (!lnurlpResponse.ok) {
      const errorBody = await lnurlpResponse.text();
      throw new Error(`Failed to fetch LNURL data from ${lightningAddress} (status ${lnurlpResponse.status}): ${errorBody}`);
    }
    const lnurlpData = await lnurlpResponse.json();

    if (lnurlpData.tag !== 'payRequest') {
      throw new Error('Invalid LNURL-pay response: "tag" is not "payRequest".');
    }
    if (!lnurlpData.callback || typeof lnurlpData.callback !== 'string') {
        throw new Error('Invalid LNURL-pay response: Missing or invalid "callback" URL.');
    }

    const minSendableMsat = parseInt(lnurlpData.minSendable || '1'); // Default min to 1 msat
    const maxSendableMsat = parseInt(lnurlpData.maxSendable); // Can be null or undefined

    if (amountMsat < minSendableMsat) {
      throw new Error(`Amount ${amountMsat}msat (${(amountMsat/1000).toFixed(0)} sats) is less than minimum sendable ${minSendableMsat}msat (${(minSendableMsat/1000).toFixed(0)} sats) for ${lightningAddress}.`);
    }
    if (maxSendableMsat && amountMsat > maxSendableMsat) {
      throw new Error(`Amount ${amountMsat}msat (${(amountMsat/1000).toFixed(0)} sats) is greater than maximum sendable ${maxSendableMsat}msat (${(maxSendableMsat/1000).toFixed(0)} sats) for ${lightningAddress}.`);
    }
    if (lnurlpData.commentAllowed && lnurlpData.commentAllowed > 0) {
        console.log(`[LNURL] Note: Comments allowed up to ${lnurlpData.commentAllowed} chars for ${lightningAddress}`);
    }

    // 2. Fetch the actual Bolt11 invoice from the callback URL
    const callbackUrl = new URL(lnurlpData.callback);
    callbackUrl.searchParams.append('amount', amountMsat.toString());
    // Optionally add a comment if lnurlpData.commentAllowed allows
    // callbackUrl.searchParams.append('comment', 'Cashout from Lucky Paw');

    console.log(`[LNURL] Fetching invoice from callback: ${callbackUrl.toString()}`);
    const invoiceResponse = await fetch(callbackUrl.toString(), { headers: { 'Accept': 'application/json' } });

    if (!invoiceResponse.ok) {
      const errorBody = await invoiceResponse.text();
      throw new Error(`Failed to fetch invoice from LNURL callback ${callbackUrl.toString()} (status ${invoiceResponse.status}): ${errorBody}`);
    }
    const invoiceData = await invoiceResponse.json();

    if (invoiceData.status === 'ERROR' || (invoiceData.reason && invoiceData.status !== 'OK')) { // Some services might just return reason
      throw new Error(`Error from LNURL service for ${lightningAddress}: ${invoiceData.reason || 'Unknown LNURL service error'}`);
    }
    if (!invoiceData.pr || typeof invoiceData.pr !== 'string') {
      throw new Error('No payment request ("pr" field) in LNURL callback response.');
    }

    console.log(`[LNURL] Successfully fetched Bolt11 invoice for ${lightningAddress}.`);
    return invoiceData.pr;

  } catch (error) {
    console.error(`[LNURL] Error processing Lightning Address ${lightningAddress}:`, error.message);
    // Rethrow with a more generic message or keep specific, depending on desired client feedback
    throw new Error(`LNURL processing for ${lightningAddress} failed: ${error.message}`);
  }
}

// --- Placeholder for TrySpeed API Interaction ---
// IMPORTANT: You MUST replace this with your actual TrySpeed API calls.
async function callTrySpeedPaymentAPI(bolt11InvoiceString, apiKey) {
  const invoicePreview = bolt11InvoiceString.length > 30 ? `${bolt11InvoiceString.substring(0, 30)}...` : bolt11InvoiceString;
  console.log(`[TrySpeed] Attempting to pay Bolt11 invoice: ${invoicePreview}`);
  if (!apiKey) {
    console.error("[TrySpeed] CRITICAL: API Key is missing!");
    throw new Error("TrySpeed API Key is not configured for payment.");
  }
  console.log(`[TrySpeed] Using API Key ending with: ${apiKey.slice(-4)}`);

  // ------------ START OF TRYSPEED INTEGRATION (ACTUAL IMPLEMENTATION) ------------
  const tryspeedApiEndpoint = 'https://api.tryspeed.com/v1/payments'; // **VERIFY THIS IS YOUR ACTUAL TRYSPEED PAYMENT ENDPOINT**
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const body = { invoice: bolt11InvoiceString }; // Send the Bolt11 invoice

  try {
    const response = await fetch(tryspeedApiEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });
    const data = await response.json(); // Assuming TrySpeed returns JSON

    if (!response.ok) { // Check for HTTP errors (e.g., 4xx, 5xx)
      throw new Error(`TrySpeed API HTTP Error (${response.status}): ${data.message || data.detail || response.statusText}`);
    }

    // IMPORTANT: Adapt this part based on TrySpeed's actual success/error response structure.
    // If TrySpeed's API is synchronous and confirms 'paid' immediately:
    if (data.status === 'paid' || data.status === 'completed') {
      const paymentId = data.id || data.payment_hash || null;
      const btcAmountPaid = data.amount_btc ? parseFloat(data.amount_btc) : null;

      if (!btcAmountPaid || btcAmountPaid <= 0) {
        console.warn("[TrySpeed] Payment reported success but BTC amount paid is missing or zero from TrySpeed response.");
        // Attempt to get amount from invoice as fallback for reporting
        const decodedInvoice = bolt11.decode(bolt11InvoiceString);
        const satoshisFromInvoice = decodedInvoice.satoshis || (decodedInvoice.millisatoshis ? parseInt(decodedInvoice.millisatoshis)/1000 : null);
        if(satoshisFromInvoice) {
            btcAmountPaid = satoshisFromInvoice / 100000000;
            console.log(`[TrySpeed] Falling back to invoice amount: ${btcAmountPaid} BTC.`);
        }
      }

      return { success: true, paymentId: paymentId, btcAmountPaid: btcAmountPaid, status: data.status };
    } else if (data.status === 'pending' || data.status === 'processing' || data.status === 'initiated') {
        // If TrySpeed's API is asynchronous, it might return 'pending' or 'processing' immediately.
        // The actual 'paid' status will come via webhook.
        const paymentId = data.id || data.payment_hash || null;
        // Optionally, if the API provides an estimated amount even for pending status:
        const btcAmountEstimated = data.amount_btc ? parseFloat(data.amount_btc) : null;
        return { success: true, paymentId: paymentId, status: data.status, btcAmountPaid: btcAmountEstimated }; // Indicate it's successfully initiated
    } else {
      // General error or specific error message from TrySpeed's response body
      throw new Error(`TrySpeed payment failed: ${data.message || data.error_message || 'Unknown error'}`);
    }

  } catch (apiError) {
    console.error('[TrySpeed API Call Real Error]', apiError);
    // Return a structured error, not just rethrow, so it can be handled by the caller
    return { success: false, error: apiError.message };
  }
  // ------------ END OF TRYSPEED INTEGRATION (ACTUAL IMPLEMENTATION) ------------
}

// --- Placeholder for USD to Satoshi Conversion ---
// IMPORTANT: You MUST replace this with a reliable, real-time exchange rate API.
async function getSatoshisForUsd(usdAmount) {
  console.log(`[Conversion SIMULATION] Attempting to convert ${usdAmount} USD to Satoshis.`);
  // ------------ START OF EXCHANGE RATE INTEGRATION (NEEDS ACTUAL IMPLEMENTATION) ------------
  /*
  const exchangeRateApiEndpoint = 'https://api.someexchangerates.com/latest'; // Replace with actual endpoint
  const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY; // Store this securely in Vercel environment variables or similar

  if (!exchangeRateApiKey) {
      console.error("[Conversion REAL] CRITICAL: Exchange Rate API Key is missing!");
      throw new Error("Exchange rate API Key is not configured.");
  }

  try {
    const url = new URL(exchangeRateApiEndpoint);
    url.searchParams.append('base', 'USD');
    url.searchParams.append('symbols', 'BTC');
    url.searchParams.append('apikey', exchangeRateApiKey); // Or other auth method

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Exchange rate API error (${response.status}): ${errorBody || response.statusText}`);
    }
    const data = await response.json();

    // IMPORTANT: Adapt this based on your chosen exchange rate API's response structure
    if (!data.rates || typeof data.rates.BTC === 'undefined') {
      throw new Error('BTC rate not found or invalid response from exchange rate API.');
    }
    const btcPerUsd = parseFloat(data.rates.BTC); // Example: 0.0000X BTC per 1 USD

    if (isNaN(btcPerUsd) || btcPerUsd <= 0) {
        throw new Error('Invalid BTC per USD rate received from API (not positive number).');
    }

    const satoshis = Math.round(parseFloat(usdAmount) * btcPerUsd * 100000000); // USD -> BTC -> Satoshis
    if (satoshis <= 0) throw new Error("Calculated satoshi amount is not positive from USD conversion.");
    console.log(`[Conversion REAL] ${usdAmount} USD = ${satoshis} Satoshis (Rate: 1 USD = ${btcPerUsd.toFixed(8)} BTC)`);
    return satoshis;

  } catch (rateError) {
    console.error('[Exchange Rate API Call Error]', rateError);
    throw new Error(`Failed to fetch or process BTC exchange rate: ${rateError.message}`);
  }
  */
  // ------------ END OF EXCHANGE RATE INTEGRATION ------------

  // IF YOU ARE TESTING: Simulate conversion. This simulation should be REMOVED.
  // (Using a very rough, likely outdated placeholder rate: e.g., 1 USD = 2500 sats, this fluctuates wildly!)
  const simulatedSatsPerUsd = 3000; // Example: 1 USD = 3000 Satoshis. REPLACE THIS!
  const calculatedSats = Math.round(parseFloat(usdAmount) * simulatedSatsPerUsd);
  if (calculatedSats <= 0) throw new Error("Simulated satoshi amount is not positive from USD conversion.");
  console.log(`[Conversion SIMULATION] ${usdAmount} USD = ${calculatedSats} Satoshis (Simulated Rate: 1 USD = ${simulatedSatsPerUsd} sats)`);
  return calculatedSats;
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, invoice: destination, amount: usdAmountString } = req.body;

  if (!username || !destination) {
    console.error("[Handler] Missing username or destination:", { username, destination });
    return res.status(400).json({ message: 'Missing username or destination (invoice/address).' });
  }

  let usdAmount = null;
  if (usdAmountString !== null && usdAmountString !== undefined && usdAmountString !== '') {
    usdAmount = parseFloat(usdAmountString);
    if (isNaN(usdAmount) || usdAmount < 0) {
      console.error("[Handler] Invalid USD amount provided:", usdAmountString);
      return res.status(400).json({ message: 'Invalid USD amount provided.' });
    }
  }

  try {
    const tryspeedApiKey = process.env.SPEED_SECRET_KEY;
    if (!tryspeedApiKey) {
      console.error('CRITICAL: TrySpeed API key is not configured on the server. Check SPEED_SECRET_KEY environment variable.');
      return res.status(500).json({ message: 'Payment gateway configuration error. Please contact support.' });
    }

    let finalBolt11InvoiceToPay;
    let btcAmountSourceEstimate = null; // Estimated BTC amount based on USD conversion or fixed invoice amount

    if (isLightningAddress(destination)) {
      console.log(`[Handler] Processing as Lightning Address: ${destination}`);
      if (usdAmount === null || usdAmount <= 0) {
          console.error("[Handler] USD amount required for Lightning Address but not provided or not positive.");
          return res.status(400).json({ message: 'USD amount is required and must be positive for Lightning Address cashouts.' });
      }
      const satoshisToRequest = await getSatoshisForUsd(usdAmount);
      const msatsToRequest = satoshisToRequest * 1000;
      
      btcAmountSourceEstimate = satoshisToRequest / 100000000;

      finalBolt11InvoiceToPay = await fetchInvoiceFromLightningAddress(destination, msatsToRequest);
      try {
        const decodedFetchedInvoice = bolt11.decode(finalBolt11InvoiceToPay);
        const fetchedInvoiceMsats = decodedFetchedInvoice.millisatoshis ? parseInt(decodedFetchedInvoice.millisatoshis) : null;
        const fetchedInvoiceSats = decodedFetchedInvoice.satoshis || (fetchedInvoiceMsats ? fetchedInvoiceMsats / 1000 : null);
        if (fetchedInvoiceSats && fetchedInvoiceSats > 0) {
          btcAmountSourceEstimate = fetchedInvoiceSats / 100000000;
          console.log(`[Handler] Invoice fetched from LN Address has amount: ${fetchedInvoiceSats} sats. Refined estimate to ${btcAmountSourceEstimate} BTC.`);
        } else {
            console.warn("[Handler] Fetched invoice from LN Address appears to be amountless or amount is zero, using original USD conversion estimate.");
        }
      } catch (decodeError) {
        console.warn(`[Handler] Could not decode invoice fetched from LN Address to refine amount, proceeding with original estimate: ${decodeError.message}`);
      }

    } else if (destination.startsWith('lnbc')) {
      console.log(`[Handler] Processing as Bolt11 invoice: ${destination}`);
      finalBolt11InvoiceToPay = destination;
      try {
        const decodedInvoice = bolt11.decode(finalBolt11InvoiceToPay);
        const invoiceMsats = decodedInvoice.millisatoshis ? parseInt(decodedInvoice.millisatoshis) : null;
        const invoiceSats = decodedInvoice.satoshis || (invoiceMsats ? invoiceMsats / 1000 : null);

        if (invoiceSats !== null && invoiceSats > 0) {
          btcAmountSourceEstimate = invoiceSats / 100000000;
          console.log(`[Handler] Bolt11 Invoice has fixed amount: ${invoiceSats} satoshis (${btcAmountSourceEstimate} BTC).`);
        } else {
          console.log('[Handler] Amountless Bolt11 invoice received.');
          if (usdAmount === null || usdAmount <= 0) {
              console.error("[Handler] USD amount required for amountless Bolt11 but not provided or not positive.");
              return res.status(400).json({ message: 'USD amount is required and must be positive for amountless Bolt11 invoice cashouts.' });
          }
          const satoshisToRequest = await getSatoshisForUsd(usdAmount);
          btcAmountSourceEstimate = satoshisToRequest / 100000000;
          console.log(`[Handler] Using provided USD amount (${usdAmount}) for amountless invoice, estimated ${satoshisToRequest} sats / ${btcAmountSourceEstimate} BTC.`);
        }
      } catch (e) {
        console.error("[Handler] Invalid Bolt11 invoice format provided directly:", e.message);
        return res.status(400).json({ message: `Invalid Bolt11 invoice format: ${e.message}. Please check the invoice.` });
      }
    } else {
        console.error("[Handler] Destination is neither a valid Bolt11 invoice nor a Lightning Address:", destination);
        return res.status(400).json({ message: "Invalid destination format. Please provide a valid Bolt11 invoice or Lightning Address." });
    }

    // --- Step 1: Pay the final Bolt11 Invoice via TrySpeed ---
    const paymentResult = await callTrySpeedPaymentAPI(finalBolt11InvoiceToPay, tryspeedApiKey);

    if (!paymentResult || !paymentResult.success) {
      throw new Error(paymentResult.error || 'TrySpeed payment processing failed or was reported as unsuccessful.');
    }

    let finalBtcPaid = paymentResult.btcAmountPaid;
    if (!finalBtcPaid || finalBtcPaid <= 0) {
      console.warn("[Handler] TrySpeed payment successful but btcAmountPaid was missing or zero in response. Falling back to source estimate:", btcAmountSourceEstimate);
      finalBtcPaid = btcAmountSourceEstimate;
    }
    
    if (!finalBtcPaid || finalBtcPaid <= 0) {
      console.error("[Handler] CRITICAL: BTC amount paid could not be reliably determined even after fallback. Payment ID:", paymentResult.paymentId);
      throw new Error('Payment reported as successful by gateway, but the actual BTC amount paid could not be confirmed. Please verify manually.');
    }

    // --- Step 2: Record the cashout in Firebase ---
    const cashoutRef = db.collection('profitLoss').doc();
    const cashoutData = {
      id: cashoutRef.id,
      username: username,
      amountUSD: usdAmount ? parseFloat(usdAmount.toFixed(2)) : null,
      amountBTC: parseFloat(finalBtcPaid.toFixed(8)),
      destination: destination,
      paidInvoice: finalBolt11InvoiceToPay,
      type: 'cashout_lightning',
      description: `Automated Lightning cashout. TrySpeed Payment ID: ${paymentResult.paymentId || 'N/A'}`,
      time: new Date().toISOString(),
      addedBy: 'admin_dashboard_automation',
      paymentGatewayId: paymentResult.paymentId || null,
      // Status will be 'pending' if TrySpeed's API is asynchronous and webhooks confirm final status.
      // It will be 'completed' if TrySpeed's API call is synchronous and returns 'paid' immediately.
      status: paymentResult.status === 'paid' || paymentResult.status === 'completed' ? 'completed' : 'pending',
    };

    await cashoutRef.set(cashoutData);
    console.log(`[Handler] Cashout recorded successfully in Firebase: ${cashoutRef.id} with status: ${cashoutData.status}`);

    res.status(201).json({
      success: true,
      message: `Cashout for ${username} (${usdAmount ? usdAmount.toFixed(2) + ' USD / ' : ''}${cashoutData.amountBTC} BTC to ${destination}) initiated. Status: ${cashoutData.status}. Payment ID: ${cashoutData.paymentGatewayId || 'N/A'}`,
      cashoutId: cashoutRef.id,
      details: cashoutData
    });

  } catch (error) {
    console.error('[Handler] Full error processing cashout:', error);
    res.status(500).json({ message: `Failed to process cashout: ${error.message}` });
  }
}