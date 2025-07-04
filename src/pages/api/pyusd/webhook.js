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
            // **DEFINITIVE FIX:** We will now use the simple, pre-parsed fields from the Helius "Enhanced" webhook.
            // This is the most reliable method and avoids complex manual parsing.

            // 1. Check for the memo in the 'description' field provided by the Enhanced webhook.
            const memo = tx.description;
            if (!memo || !/^\d{6}$/.test(memo)) { // Ensure it's a 6-digit memo
                console.log("Webhook received a transaction without a valid 6-digit memo. Skipping.");
                continue;
            }

            // 2. Check for the token transfer details in the pre-parsed array.
            if (!tx.tokenTransfers || !Array.isArray(tx.tokenTransfers) || tx.tokenTransfers.length === 0) {
                console.log(`Transaction with memo "${memo}" had no token transfers. Skipping.`);
                continue;
            }

            // 3. Find the specific transfer that went to our main wallet.
            const transferInfo = tx.tokenTransfers.find(
                (t) => t.toUserAccount === MAIN_WALLET_PUBLIC_KEY
            );

            if (!transferInfo) {
                console.log(`Transaction with memo "${memo}" did not go to the main wallet. Skipping.`);
                continue;
            }

            // 4. If we have a valid memo and a valid transfer, find the matching pending order.
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
