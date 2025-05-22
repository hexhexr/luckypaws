// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin'; // Adjust path as needed
import * as bolt11 from 'lightning-invoice'; // npm install lightning-invoice

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
// This function now always expects a `bolt11InvoiceString`.
async function callTrySpeedPaymentAPI(bolt11InvoiceString, apiKey) {
  const invoicePreview = bolt11InvoiceString.length > 30 ? `${bolt11InvoiceString.substring(0, 30)}...` : bolt11InvoiceString;
  console.log(`[TrySpeed SIMULATION] Attempting to pay Bolt11 invoice: ${invoicePreview}`);
  if (!apiKey) {
    console.error("[TrySpeed SIMULATION] CRITICAL: API Key is missing!");
    throw new Error("TrySpeed API Key is not configured for payment simulation.");
  }
  console.log(`[TrySpeed SIMULATION] Using API Key ending with: ${apiKey.slice(-4)}`);

  // ------------ START OF TRYSPEED INTEGRATION (NEEDS ACTUAL IMPLEMENTATION) ------------
  // Example: TrySpeed pays the amount specified *within* the bolt11InvoiceString.
  // const tryspeedApiEndpoint = 'https://api.tryspeed.com/v1/payments'; // Replace with actual endpoint
  // const headers = {
  //   'Authorization': `Bearer ${apiKey}`,
  //   'Content-Type': 'application/json',
  // };
  // const body = { invoice: bolt11InvoiceString }; // Send the Bolt11 invoice
  //
  // try {
  //   const response = await fetch(tryspeedApiEndpoint, {
  //     method: 'POST',
  //     headers: headers,
  //     body: JSON.stringify(body),
  //   });
  //   const data = await response.json(); // Assuming TrySpeed returns JSON
  //
  //   if (!response.ok) { // Check for HTTP errors
  //     throw new Error(`TrySpeed API Error (${response.status}): ${data.message || response.statusText}`);
  //   }
  //
  //   // Check for TrySpeed-specific success/error indicators in the response body
  //   if (!data.success && !data.is_paid) { // Replace with actual success field from TrySpeed
  //     throw new Error(`TrySpeed payment failed: ${data.error_message || 'Unknown TrySpeed error'}`);
  //   }
  //
  //   // Ensure you extract the payment ID and the actual BTC amount paid from TrySpeed's response
  //   const paymentId = data.payment_hash || data.id || null; // Adjust to TrySpeed's response field
  //   const btcAmountPaid = data.amount_btc ? parseFloat(data.amount_btc) : null; // Adjust
  //
  //   if (!btcAmountPaid || btcAmountPaid <= 0) {
  //       console.warn("[TrySpeed] Payment reported success but BTC amount paid is missing or zero from TrySpeed response.");
  //       // Decide how to handle this: maybe try to get amount from invoice as fallback
  //   }
  //
  //   return { success: true, paymentId: paymentId, btcAmountPaid: btcAmountPaid };
  //
  // } catch (apiError) {
  //   console.error('[TrySpeed API Call Real Error]', apiError);
  //   return { success: false, error: apiError.message };
  // }
  // ------------ END OF TRYSPEED INTEGRATION ------------

  // IF YOU ARE TESTING WITHOUT LIVE TRYSPEED: Simulate a successful payment
  // This simulation should be REMOVED once you integrate TrySpeed.
  return new Promise((resolve) => {
    setTimeout(() => {
      let simulatedBtcAmountPaid = 0.00005; // Default BTC amount for simulation
      try {
        // Try to get amount from invoice for more realistic simulation
        const decodedSimInvoice = bolt11.decode(bolt11InvoiceString);
        const simSats = decodedSimInvoice.satoshis || (decodedSimInvoice.millisatoshis ? parseInt(decodedSimInvoice.millisatoshis)/1000 : null);
        if (simSats && simSats > 0) {
            simulatedBtcAmountPaid = simSats / 100000000;
        }
      } catch (e) { /* ignore if dummy invoice for sim fails fails decode, use default */ }
      
      console.log(`[TrySpeed SIMULATION] Successfully processed payment of approx ${simulatedBtcAmountPaid} BTC.`);
      resolve({
        success: true,
        paymentId: `sim_trysp_${Date.now()}`,
        btcAmountPaid: simulatedBtcAmountPaid,
      });
    }, 2000); // Simulate network delay
  });
}

// --- Placeholder for USD to Satoshi Conversion ---
// IMPORTANT: You MUST replace this with a reliable, real-time exchange rate API.
async function getSatoshisForUsd(usdAmount) {
  console.log(`[Conversion SIMULATION] Attempting to convert ${usdAmount} USD to Satoshis.`);
  // ------------ START OF EXCHANGE RATE INTEGRATION (NEEDS ACTUAL IMPLEMENTATION) ------------
  // Example using a hypothetical exchange rate API:
  // const exchangeRateApiKey = process.env.EXCHANGE_RATE_API_KEY; // Store in Vercel env
  // const url = `https://api.someexchangerates.com/latest?base=USD&symbols=BTC&apikey=${exchangeRateApiKey}`;
  // try {
  //   const response = await fetch(url);
  //   if (!response.ok) throw new Error(`Exchange rate API error: ${response.statusText}`);
  //   const data = await response.json();
  //   if (!data.rates || !data.rates.BTC) {
  //     throw new Error('BTC rate not found or invalid response from exchange rate API.');
  //   }
  //   const btcPerUsd = parseFloat(data.rates.BTC);
  //   if (isNaN(btcPerUsd) || btcPerUsd <= 0) {
  //       throw new Error('Invalid BTC per USD rate received from API.');
  //   }
  //   const satoshis = Math.round(parseFloat(usdAmount) * btcPerUsd * 100000000); // USD to Satoshis
  //   if (satoshis <= 0) throw new Error("Calculated satoshi amount is not positive from USD conversion.");
  //   console.log(`[Conversion REAL] ${usdAmount} USD = ${satoshis} Satoshis (Rate: 1 USD = ${btcPerUsd.toFixed(8)} BTC)`);
  //   return satoshis;
  // } catch (rateError) {
  //   console.error('[Exchange Rate API Call Error]', rateError);
  //   throw new Error(`Failed to fetch or process BTC exchange rate: ${rateError.message}`);
  // }
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

  // 'destination' can be a Bolt11 invoice string or a Lightning Address
  // 'amount' (usdAmountString) is now optional, as fixed-amount invoices don't require it from the UI.
  const { username, invoice: destination, amount: usdAmountString } = req.body;

  if (!username || !destination) {
    return res.status(400).json({ message: 'Missing username or destination (invoice/address).' });
  }

  let usdAmount = null;
  if (usdAmountString) { // Only parse if provided by the client
    usdAmount = parseFloat(usdAmountString);
    if (isNaN(usdAmount) || usdAmount <= 0) {
      return res.status(400).json({ message: 'Invalid or non-positive USD amount provided.' });
    }
  }

  try {
    const tryspeedApiKey = process.env.SPEED_SECRET_KEY;
    if (!tryspeedApiKey) {
      console.error('CRITICAL: TrySpeed API key is not configured on the server.');
      return res.status(500).json({ message: 'Payment gateway configuration error. Please contact support.' });
    }

    let finalBolt11InvoiceToPay;
    let btcAmountSourceEstimate = null; // Estimated BTC amount based on USD conversion or fixed invoice amount

    if (isLightningAddress(destination)) {
      console.log(`[Handler] Processing as Lightning Address: ${destination}`);
      if (usdAmount === null) {
          return res.status(400).json({ message: 'USD amount is required for Lightning Address cashouts.' });
      }
      const satoshisToRequest = await getSatoshisForUsd(usdAmount);
      const msatsToRequest = satoshisToRequest * 1000; // LNURL usually expects millisatoshis
      
      if (msatsToRequest <= 0) { // Should be caught by getSatoshisForUsd, but double check
        return res.status(400).json({ message: 'Calculated millisatoshi amount for Lightning Address is not positive.' });
      }
      btcAmountSourceEstimate = satoshisToRequest / 100000000; // Store estimated BTC

      finalBolt11InvoiceToPay = await fetchInvoiceFromLightningAddress(destination, msatsToRequest);
      // The fetched invoice *should* have the amount embedded. We can decode it to confirm/refine btcAmountSourceEstimate.
      try {
        const decodedFetchedInvoice = bolt11.decode(finalBolt11InvoiceToPay);
        const fetchedInvoiceSats = decodedFetchedInvoice.satoshis || (decodedFetchedInvoice.millisatoshis ? parseInt(decodedFetchedInvoice.millisatoshis) / 1000 : null);
        if (fetchedInvoiceSats && fetchedInvoiceSats > 0) {
          btcAmountSourceEstimate = fetchedInvoiceSats / 100000000; // Refine with actual invoice amount
          console.log(`[Handler] Invoice fetched from LN Address has amount: ${fetchedInvoiceSats} sats.`);
        }
      } catch (decodeError) {
        console.warn(`[Handler] Could not decode invoice fetched from LN Address, proceeding with original estimate: ${decodeError.message}`);
      }

    } else { // Assume Bolt11 invoice
      console.log(`[Handler] Processing as Bolt11 invoice: ${destination}`);
      finalBolt11InvoiceToPay = destination;
      try {
        const decodedInvoice = bolt11.decode(finalBolt11InvoiceToPay);
        const invoiceMsats = decodedInvoice.millisatoshis ? parseInt(decodedInvoice.millisatoshis) : null;
        const invoiceSats = decodedInvoice.satoshis || (invoiceMsats ? invoiceMsats / 1000 : null);

        if (invoiceSats !== null && invoiceSats > 0) { // Invoice has a fixed amount
          btcAmountSourceEstimate = invoiceSats / 100000000;
          console.log(`[Handler] Bolt11 Invoice has fixed amount: ${invoiceSats} satoshis (${btcAmountSourceEstimate} BTC).`);
          // If a fixed-amount invoice, the usdAmount from the frontend is ignored for the payment,
          // but kept for logging the admin's intent.
          // Optional: You could add a check here to warn if `usdAmount` doesn't roughly match `invoiceSats`.
        } else { // Amountless Bolt11 invoice
          console.log('[Handler] Amountless Bolt11 invoice received.');
          if (usdAmount === null) {
              return res.status(400).json({ message: 'USD amount is required for amountless Bolt11 invoice cashouts.' });
          }
          const satoshisToRequest = await getSatoshisForUsd(usdAmount);
          btcAmountSourceEstimate = satoshisToRequest / 100000000;
          // IMPORTANT: If your TrySpeed API supports paying an amountless invoice by
          // providing an explicit amount (e.g., in `sats`), you'd modify `callTrySpeedPaymentAPI`
          // or how you call it here to pass `satoshisToRequest`.
          // Current `callTrySpeedPaymentAPI` is designed to take *only* the Bolt11 string.
          // If TrySpeed *cannot* pay an amountless invoice by specifying an amount,
          // then you must enforce that only fixed-amount invoices or Lightning Addresses are used.
          // For now, let's assume TrySpeed expects the amount in the invoice itself,
          // so we'll treat amountless invoices as invalid *unless* it can handle explicit amounts.
          // For now, the current simulation in `callTrySpeedPaymentAPI` *does* extract amount from invoice.
          // If you *want* to allow paying amountless invoices with a manually entered amount,
          // your `callTrySpeedPaymentAPI` must be updated to accept an `amountSats` parameter
          // and use that if the invoice is amountless.
        }
      } catch (e) {
        console.error("[Handler] Invalid Bolt11 invoice format provided directly:", e.message);
        return res.status(400).json({ message: `Invalid Bolt11 invoice format: ${e.message}` });
      }
    }

    // --- Step 1: Pay the final Bolt11 Invoice via TrySpeed ---
    // `finalBolt11InvoiceToPay` is now always a Bolt11 invoice string.
    // `callTrySpeedPaymentAPI` should use the amount embedded in this invoice.
    const paymentResult = await callTrySpeedPaymentAPI(finalBolt11InvoiceToPay, tryspeedApiKey);

    if (!paymentResult || !paymentResult.success) {
      throw new Error(paymentResult.error || 'TrySpeed payment processing failed or was reported as unsuccessful.');
    }

    // Determine the actual BTC amount paid. Prioritize TrySpeed's response if available.
    let finalBtcPaid = paymentResult.btcAmountPaid; // Amount from TrySpeed's successful payment response
    if (!finalBtcPaid || finalBtcPaid <= 0) {
      console.warn("[Handler] TrySpeed payment successful but btcAmountPaid was missing or zero in response. Falling back to source estimate.");
      finalBtcPaid = btcAmountSourceEstimate; // Fallback to our estimate from invoice/conversion
    }
    
    if (!finalBtcPaid || finalBtcPaid <= 0) {
      // This is a critical issue if payment was supposedly made but we can't determine a valid BTC amount.
      console.error("[Handler] CRITICAL: BTC amount paid could not be reliably determined even after fallback. Payment ID:", paymentResult.paymentId);
      throw new Error('Payment reported as successful by gateway, but the actual BTC amount paid could not be confirmed. Please verify manually.');
    }

    // --- Step 2: Record the cashout in Firebase ---
    const cashoutRef = db.collection('profitLoss').doc();
    const cashoutData = {
      id: cashoutRef.id,
      username: username,
      amountUSD: usdAmount, // Logged admin-entered USD amount (will be null for fixed invoices)
      amountBTC: parseFloat(finalBtcPaid.toFixed(8)), // Actual or most reliable BTC amount
      destination: destination, // Original destination (LN Address or Bolt11 invoice string)
      paidInvoice: finalBolt11InvoiceToPay, // The actual Bolt11 invoice that was processed by TrySpeed
      type: 'cashout_lightning', // Differentiate from manual 'cashout'
      description: `Automated Lightning cashout. TrySpeed Payment ID: ${paymentResult.paymentId || 'N/A'}`,
      time: new Date().toISOString(),
      addedBy: 'admin_dashboard_automation',
      paymentGatewayId: paymentResult.paymentId || null, // Store TrySpeed's transaction ID
      status: 'completed', // Assuming TrySpeed call is synchronous and confirmed
    };

    await cashoutRef.set(cashoutData);
    console.log(`[Handler] Cashout recorded successfully in Firebase: ${cashoutRef.id}`);

    res.status(201).json({
      success: true,
      message: `Cashout for ${username} (${usdAmount ? usdAmount.toFixed(2) + ' USD / ' : ''}${cashoutData.amountBTC} BTC to ${destination}) processed and recorded. Payment ID: ${cashoutData.paymentGatewayId || 'N/A'}`,
      cashoutId: cashoutRef.id,
      details: cashoutData
    });

  } catch (error) {
    console.error('[Handler] Full error processing cashout:', error); // Log the full error object on the server
    res.status(500).json({ message: `Failed to process cashout: ${error.message}` }); // Send a sanitized/clear message to client
  }
}