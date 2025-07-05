// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';

// --- No changes to your environment variables or constants ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("Missing environment variables for webhook.");
}

// --- No changes to the parsing function ---
// This helper function correctly parses transaction details from the Helius webhook payload.
function parsePaymentTransaction(tx) {
    try {
        const { instructions, accountKeys } = tx.transaction.message;

        const memoInstruction = instructions.find(ix => accountKeys[ix.programIdIndex] === MEMO_PROGRAM_ID);
        // CHANGE: Now correctly handles transactions that might not have a memo.
        const memo = memoInstruction?.data ? Buffer.from(bs58.decode(memoInstruction.data)).toString('utf-8').trim() : null;

        if (memo) {
            console.log("✅ Decoded Memo:", memo);
        } else {
            console.log("⚠️ Transaction received with no memo.");
        }

        const transferInstruction = instructions.find(ix =>
            accountKeys[ix.programIdIndex] === TOKEN_2022_PROGRAM_ID &&
            ix.data && bs58.decode(ix.data)[0] === 12
        );
        if (!transferInstruction) return null;

        const destinationAccountIndex = transferInstruction.accounts[2];
        const destinationOwner = tx.meta?.postTokenBalances?.find(t => t.accountIndex === destinationAccountIndex)?.owner || null;
        if (destinationOwner !== MAIN_WALLET_PUBLIC_KEY) {
            console.log(`Skipping transaction not sent to the main wallet.`);
            return null; // Skip if not sent to the main wallet
        }

        const instructionData = Buffer.from(bs58.decode(transferInstruction.data));
        const amount = Number(instructionData.readBigUInt64LE(1)) / 1_000_000;

        return { memo, amount, signature: tx.signature || null };

    } catch (error) {
        console.error("❌ Error parsing transaction:", error);
        return null;
    }
}

// --- Main Handler Logic ---
export default async function handler(req, res) {
    if (req.method !== 'POST' || req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        return res.status(req.method !== 'POST' ? 405 : 401).json({ message: req.method !== 'POST' ? 'Method Not Allowed' : 'Unauthorized' });
    }

    try {
        const transactions = req.body;
        if (!Array.isArray(transactions)) return res.status(400).json({ message: "Invalid payload." });

        for (const tx of transactions) {
            if (!tx || tx.transaction.error) continue;

            const paymentDetails = parsePaymentTransaction(tx);
            if (!paymentDetails) continue;

            const { memo, amount, signature } = paymentDetails;
            let orderMatched = false;

            // Step 1: Try to find a matching pending order if a memo was provided.
            if (memo) {
                const ordersRef = db.collection('orders');
                const snapshot = await ordersRef.where('memo', '==', memo).where('status', '==', 'pending').limit(1).get();

                if (!snapshot.empty) {
                    const orderDoc = snapshot.docs[0];
                    // --- This is the logic for a CORRECT memo ---
                    await orderDoc.ref.update({
                        status: 'completed',
                        paidAt: Timestamp.now(),
                        transactionSignature: signature,
                        amountReceived: amount,
                        read: false, // Mark as unread for admin attention
                    });
                    console.log(`✅ Order ${orderDoc.id} matched with memo "${memo}" and marked as completed.`);
                    orderMatched = true;
                }
            }

            // Step 2: If no pending order was matched, create a NEW order record for this payment.
            // --- This is the NEW logic for an INCORRECT or MISSING memo ---
            if (!orderMatched) {
                console.log(`⚠️ No pending order found for memo "${memo}". Creating a new 'unmatched_payment' record.`);
                
                const newOrderRef = db.collection('orders').doc(); // Create a new document in the 'orders' collection
                await newOrderRef.set({
                    orderId: newOrderRef.id,
                    username: 'unknown', // Username is unknown since we couldn't match the memo
                    game: 'unknown',
                    amount: amount, // The amount that was actually received
                    amountReceived: amount,
                    memo: memo || 'NO_MEMO_PROVIDED', // The memo the user actually sent, or a placeholder
                    status: 'unmatched_payment', // A special status for you to easily find and review it
                    method: 'pyusd',
                    transactionSignature: signature,
                    created: Timestamp.now(), // The time the payment was seen by the webhook
                    paidAt: Timestamp.now(),
                    read: false, // Mark as unread for admin attention
                });
                console.log(`✅ New unmatched payment record ${newOrderRef.id} created.`);
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed." });

    } catch (error) {
        console.error('❌ CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}