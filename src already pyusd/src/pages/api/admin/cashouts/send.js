// pages/api/admin/cashouts/send.js
import { db } from '../../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { withAuth } from '../../../../lib/authMiddleware';
import { checkCashoutLimit } from '../../customer-cashout-limit';

// This function can be expanded to call the actual Speed/payment API
async function executePayment(payload) {
    console.log("Simulating payment execution for:", payload);
    // In a real scenario, this would involve:
    // const SPEED_API_KEY = process.env.SPEED_SECRET_KEY;
    // const SPEED_API_URL = process.env.SPEED_API_URL || 'https://api.tryspeed.com/v1';
    // const response = await fetch(`${SPEED_API_URL}/payouts`, { ... });
    // const result = await response.json();
    // if (!response.ok) throw new Error(result.message);
    // return { success: true, paymentGatewayId: result.id };

    // For now, return a mock success response.
    return { success: true, paymentGatewayId: `mock_tx_${Date.now()}` };
}

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { username, destination, usdAmount: usdAmountStr } = req.body;
    const usdAmount = usdAmountStr ? parseFloat(usdAmountStr) : null;
    let finalUsdAmount = usdAmount;

    // Basic validation
    if (!username || !destination || !usdAmount || usdAmount <= 0) {
        return res.status(400).json({ message: "Username, destination, and a valid USD amount are required." });
    }

    const cashoutRef = db.collection('cashouts').doc();

    try {
        // BUG FIX: Use a Firestore transaction to prevent race conditions on the cashout limit check.
        // This makes the read (checking the limit) and the write (creating the pending cashout) atomic.
        await db.runTransaction(async (transaction) => {
            // Step 1: Check the cashout limit within the transaction
            const limitData = await checkCashoutLimit(username);
            if (finalUsdAmount > limitData.remainingLimit) {
                throw new Error(`Cashout amount of $${finalUsdAmount.toFixed(2)} exceeds the remaining 24-hour limit of $${limitData.remainingLimit.toFixed(2)}.`);
            }

            // Step 2: Create the initial cashout document with 'pending' status.
            // This safely records the intent to pay before the payment is attempted.
            const initialCashoutData = {
                id: cashoutRef.id,
                username: username.toLowerCase().trim(),
                amountUSD: finalUsdAmount,
                // In a real scenario with invoices, sats would be calculated here.
                amountSats: 0,
                destination,
                time: Timestamp.now(),
                status: 'pending', // IMPORTANT: Set to pending first
                paymentGatewayId: null,
                addedBy: req.decodedToken.email,
            };
            transaction.set(cashoutRef, initialCashoutData);
        });

        // --- Payment execution happens *after* the transaction is committed ---
        let paymentResult;
        try {
            paymentResult = await executePayment({ destination, amount: finalUsdAmount });
            
            // Step 3: Update the cashout record to 'completed' on success.
            await cashoutRef.update({
                status: 'completed',
                paymentGatewayId: paymentResult.paymentGatewayId
            });

            const finalDoc = await cashoutRef.get();

            return res.status(201).json({
                success: true,
                message: `Cashout successfully processed and recorded for ${username}.`,
                details: finalDoc.data(),
            });

        } catch (paymentError) {
            // Step 4: If payment fails, update the record to 'failed'.
            console.error('[Payment Execution Error]', paymentError);
            await cashoutRef.update({
                status: 'failed',
                failureReason: paymentError.message || 'Payment gateway failed.'
            });
            // Re-throw to be caught by the outer catch block
            throw paymentError;
        }

    } catch (error) {
        console.error('[Handler] Full error processing cashout:', error);
        return res.status(500).json({ message: error.message || 'An unexpected error occurred.' });
    }
};

export default withAuth(handler);