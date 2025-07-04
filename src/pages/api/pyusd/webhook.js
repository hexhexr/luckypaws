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
            if (!tx || !tx.transaction || tx.transaction.error || !tx.description) {
                continue;
            }
            
            const memo = tx.description;
            if (!memo) continue;

            const transferInfo = tx.tokenTransfers?.find(t => t.toUserAccount === MAIN_WALLET_PUBLIC_KEY);
            if (!transferInfo) continue;

            // **THE FIX:** Instead of using the memo as a document ID, we now query the collection
            // to find the pending order that has this specific 6-digit memo.
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
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
