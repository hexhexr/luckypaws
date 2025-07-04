// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// --- MAINNET CONFIGURATION ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("One or more critical environment variables for the webhook are not set.");
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
            // Ensure the transaction is valid and successful
            if (!tx || !tx.transaction || tx.transaction.error || !tx.description) {
                continue;
            }
            
            // Helius's "Enhanced" webhook conveniently parses the memo into the "description" field.
            // The memo IS our unique orderId.
            const memo = tx.description;
            
            // We only care about transactions that have a memo.
            if (!memo) {
                continue;
            }

            // Check if the transaction was sent to our main wallet.
            const transferInfo = tx.tokenTransfers?.find(t => t.toUserAccount === MAIN_WALLET_PUBLIC_KEY);
            if (!transferInfo) {
                continue;
            }

            // The memo is the orderId. Let's find the corresponding pending order.
            const orderRef = db.collection('orders').doc(memo);
            const orderDoc = await orderRef.get();

            // If we found a matching PENDING order, process it.
            if (orderDoc.exists && orderDoc.data().status === 'pending') {
                console.log(`Webhook detected payment for order (memo): ${memo}`);

                const amountTransferred = transferInfo.tokenAmount;

                await orderRef.update({
                    status: 'completed', // We can mark as completed directly, no sweep needed.
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amountTransferred,
                });

                console.log(`Order ${memo} successfully marked as completed.`);
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
