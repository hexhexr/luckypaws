// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// --- MAINNET CONFIGURATION ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;

if (!HELIUS_AUTH_SECRET) {
    throw new Error("Helius mainnet auth secret is not configured.");
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    if (req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.warn("Unauthorized webhook attempt detected.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        if (!Array.isArray(transactions)) {
            console.warn("Webhook received non-array payload:", transactions);
            return res.status(400).json({ success: false, message: "Invalid payload." });
        }

        for (const tx of transactions) {
            // We only care about successful transactions
            if (tx.transaction.error) {
                continue;
            }

            // --- ROBUST TOKEN-2022 LOGIC ---
            // Instead of relying on `tokenTransfers`, we check all accounts involved in the transaction.
            // This is more reliable for newer token standards like Token-2022.
            const involvedAccounts = tx.accountData.map(acc => acc.account);

            for (const depositAddress of involvedAccounts) {
                // Check if any involved account matches one of our pending deposit wallets.
                const ordersRef = db.collection('orders');
                const snapshot = await ordersRef.where('depositAddress', '==', depositAddress)
                                                .where('status', '==', 'pending')
                                                .limit(1).get();

                if (snapshot.empty) {
                    // This account is not one of our pending deposit wallets, so we can ignore it.
                    continue;
                }

                const orderDoc = snapshot.docs[0];
                const orderData = orderDoc.data();

                // --- Found a matching order, now process it ---
                console.log(`Webhook detected activity for pending order ${orderDoc.id} at address ${depositAddress}.`);

                // We can extract the amount from the tokenTransfers if available, otherwise mark as received.
                const transferInfo = tx.tokenTransfers?.find(t => t.toUserAccount === depositAddress);
                const amountTransferred = transferInfo ? transferInfo.tokenAmount : orderData.amount; // Fallback to expected amount

                // Update the order status to 'paid'
                await orderDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amountTransferred,
                });
                console.log(`Order ${orderDoc.id} for user ${orderData.username} marked as 'paid'.`);

                // Mark the temporary wallet as 'processed'
                const tempWalletRef = db.collection('tempWallets').doc(depositAddress);
                await tempWalletRef.update({
                    status: 'processed',
                    transactionSignature: tx.signature,
                    processedAt: Timestamp.now()
                });
                console.log(`Temp wallet ${depositAddress} marked as processed.`);
                
                // Since we found and processed our order, we can stop checking other accounts in this transaction.
                break; 
            }
        }

        res.status(200).json({ success: true, message: "Webhook processed successfully." });

    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
