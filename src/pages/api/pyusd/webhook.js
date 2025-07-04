// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("One or more critical environment variables for the webhook are not set.");
}

/**
 * Parses a raw Solana transaction to find a memo.
 * @param {object} tx - The raw transaction object from the Helius webhook.
 * @returns {string|null} The memo string if found, otherwise null.
 */
function findMemoInTransaction(tx) {
    try {
        // The transaction data is base64 encoded. We need to decode it.
        const txBuffer = Buffer.from(tx.transaction.message, 'base64');
        const decodedTx = Transaction.from(txBuffer);
        
        // Find the instruction that interacts with the Memo Program.
        const memoInstruction = decodedTx.instructions.find(
            (ix) => ix.programId.toBase58() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
        );

        if (memoInstruction) {
            // The memo data is in the instruction's data buffer, decoded as a UTF-8 string.
            const memo = memoInstruction.data.toString('utf-8');
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
            if (!tx || !tx.transaction || tx.transaction.error) {
                continue;
            }
            
            // **THE DEFINITIVE FIX:** Manually parse the raw transaction to find the memo.
            const memo = findMemoInTransaction(tx);
            
            if (!memo) {
                console.log("Webhook received a transaction without a memo. Skipping.");
                continue;
            }

            // Find the transfer information to ensure it was sent to our main wallet.
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
