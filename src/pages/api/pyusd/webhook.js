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

    // 1. Authenticate the webhook request from Helius
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
            // 2. Process only successful token transfers
            if (tx.type !== "TOKEN_TRANSFER" || tx.transaction.error) {
                continue;
            }

            const depositAddress = tx.tokenTransfers[0]?.toUserAccount;
            if (!depositAddress) continue;

            // 3. Find the corresponding pending order in Firestore
            let orderDoc = null;
            let attempt = 0;
            const maxAttempts = 3;

            // Retry logic to handle potential replication delay between order creation and webhook arrival
            while (!orderDoc && attempt < maxAttempts) {
                attempt++;
                const ordersRef = db.collection('orders');
                const snapshot = await ordersRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').limit(1).get();
                
                if (!snapshot.empty) {
                    orderDoc = snapshot.docs[0];
                } else {
                    console.log(`Attempt ${attempt}: Order for ${depositAddress} not found, retrying in 2s...`);
                    await sleep(2000); 
                }
            }

            if (!orderDoc) {
                console.warn(`Webhook: No pending order found for deposit address ${depositAddress} after ${maxAttempts} attempts.`);
                continue; // Skip to the next transaction in the webhook payload
            }

            const orderData = orderDoc.data();
            const amountTransferred = tx.tokenTransfers[0].tokenAmount;

            // 4. Update the order status to 'paid'
            await orderDoc.ref.update({
                status: 'paid',
                paidAt: Timestamp.now(),
                transactionSignature: tx.signature,
                amountReceived: amountTransferred,
            });
            console.log(`Order ${orderDoc.id} for user ${orderData.username} marked as 'paid'.`);

            // 5. Mark the temporary wallet as 'processed' for cleanup/auditing
            const tempWalletRef = db.collection('tempWallets').doc(depositAddress);
            await tempWalletRef.update({
                status: 'processed',
                transactionSignature: tx.signature,
                processedAt: Timestamp.now()
            });
            console.log(`Temp wallet ${depositAddress} marked as processed.`);
        }

        res.status(200).json({ success: true, message: "Webhook processed successfully." });

    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
