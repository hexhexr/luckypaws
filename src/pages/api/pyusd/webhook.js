// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection } from '@solana/web3.js';
import { PYUSD_MINT_ADDRESS, processPyusdPayment } from './pyusd-helpers';

// --- CONFIGURATION (DEVNET ONLY) ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
// FIX: Using the correct environment variable name from your list
const HELIUS_AUTH_SECRET = process.env.HELIUS_DEVNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    // --- LOGGING STEP 1 ---
    // Log the entire incoming request body to see the raw payload from Helius.
    // This will prove if the webhook is being called at all.
    console.log("[Webhook Arrived] Received a request. Full Payload:", JSON.stringify(req.body, null, 2));

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // This check is important. If it fails, the logs below won't run.
    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK: Authentication failed. Check if HELIUS_DEVNET_AUTH_SECRET is correct and configured in Helius dashboard.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        for (const tx of transactions) {

            // --- LOGGING STEP 2 ---
            // Log the mint address of every single token transfer found in the transaction.
            if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                 tx.tokenTransfers.forEach((transfer, index) => {
                    console.log(`[Mint Address Check] Tx <span class="math-inline">\{tx\.signature\}, Transfer \#</span>{index + 1}: The mint address is -> ${transfer.mint}`);
                 });
            }
            // ---

            const pyusdTransfer = tx.tokenTransfers?.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());

            if (!pyusdTransfer) {
                 // This log helps understand why a transaction might be processed by the webhook but not acted upon.
                 console.log(`[Webhook Info] Skipping Tx ${tx.signature} because it did not contain a transfer for the expected PYUSD mint address.`);
                 continue;
            }

            const depositAddress = pyusdTransfer.toUserAccount;
            const snapshot = await db.collection('orders').where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
            if (snapshot.empty) {
                console.warn(`Webhook received for ${depositAddress}, but no pending order found.`);
                continue;
            }

            const orderDoc = snapshot.docs[0];
            const paidAmount = pyusdTransfer.tokenAmount;

            // Call the centralized processing function, do not block the response
            processPyusdPayment(connection, orderDoc.ref, paidAmount, 'webhook', tx.signature);
        }
        res.status(200).json({ success: true, message: "Webhook processed." });
    } catch (error) {
        console.error("WEBHOOK: An error occurred during processing:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}