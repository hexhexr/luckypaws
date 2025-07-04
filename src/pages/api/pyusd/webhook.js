// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
// We no longer need the full Transaction object, just bs58 for decoding the memo data.
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("One or more critical environment variables for the webhook are not set.");
}

/**
 * Parses a raw Solana transaction from a Helius webhook to find a memo.
 * @param {object} tx - The raw transaction object from the Helius webhook.
 * @returns {string|null} The memo string if found, otherwise null.
 */
function findMemoInTransaction(tx) {
    try {
        // **THE FIX:** The raw webhook payload provides the message as an object
        // containing instructions and account keys directly. We no longer need to decode a string.
        const { instructions, accountKeys } = tx.transaction.message;

        // Find the instruction that interacts with the Memo Program by matching its Program ID.
        const memoInstruction = instructions.find(
            (ix) => accountKeys[ix.programIdIndex] === MEMO_PROGRAM_ID
        );

        if (memoInstruction && memoInstruction.data) {
            // The memo data in a raw transaction instruction is base58 encoded.
            // We decode it to a buffer, then convert that buffer to a UTF-8 string.
            const memo = bs58.decode(memoInstruction.data).toString('utf-8');
            return memo;
        }
        return null;
    } catch (e) {
        console.error("Error parsing transaction for memo:", e);
        return null;
    }
}


export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    if (req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        if (!Array.isArray(transactions)) {
            return res.status(400).json({ success: false, message: "Invalid payload." });
        }

        for (const tx of transactions) {
            // Add more robust checks for the payload structure to prevent crashes
            if (!tx || !tx.transaction || !tx.transaction.message || !tx.transaction.message.instructions || tx.transaction.error) {
                console.log("Skipping transaction that is malformed or has an error.");
                continue;
            }
            
            const memo = findMemoInTransaction(tx);
            
            if (!memo) {
                console.log("Webhook received a transaction without a memo. Skipping.");
                continue;
            }

            // This part should still work as Helius includes tokenTransfers as a convenience.
            const transferInfo = tx.tokenTransfers?.find(t => t.toUserAccount === MAIN_WALLET_PUBLIC_KEY);
            if (!transferInfo) {
                 console.log(`Webhook received a transaction with memo "${memo}", but not to the main wallet. Skipping.`);
                continue;
            }

            // Find the pending order that matches this unique 6-digit memo.
            const ordersRef = db.collection('orders');
            const q = ordersRef.where('memo', '==', memo)
                               .where('status', '==', 'pending')
                               .limit(1);
            
            const snapshot = await q.get();

            if (!snapshot.empty) {
                const orderDoc = snapshot.docs[0];
                console.log(`Webhook detected payment for order with memo: ${memo}`);

                const amountTransferred = transferInfo.tokenAmount;

                await orderDoc.ref.update({
                    status: 'completed',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amountTransferred,
                });

                console.log(`Order ${orderDoc.id} successfully marked as completed.`);
            } else {
                console.log(`Received payment with memo "${memo}", but no matching pending order was found.`);
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
