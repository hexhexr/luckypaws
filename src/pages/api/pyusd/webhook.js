import { db } from '../../../lib/firebaseAdmin';
import { Connection } from '@solana/web3.js';
import { PYUSD_MINT_ADDRESS, processPyusdPayment } from './pyusd-helpers';

// --- CONFIGURATION ---
// This should match the RPC URL used in other parts of your application.
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

// This MUST exactly match the "Authorization Header" secret from your Helius webhook settings.
const HELIUS_AUTH_SECRET = process.env.HELIUS_DEVNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 2. Secure the webhook with the Authentication Header
    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK AUTHENTICATION FAILED: The secret in the 'Authorization' header did not match the expected HELIUS_DEVNET_AUTH_SECRET environment variable.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    // 3. Process the incoming transaction data
    try {
        const transactions = req.body;

        // The webhook can send an array of transactions; loop through them.
        for (const tx of transactions) {
            // Find a transfer related to your specific PYUSD mint address.
            // This relies on your Helius webhook being set to the "TRANSFER" Transaction Type.
            const pyusdTransfer = tx.tokenTransfers?.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());

            // If this transaction doesn't involve your PYUSD, skip to the next one.
            if (!pyusdTransfer) {
                continue;
            }

            // 4. Find the corresponding order in your database
            // The destination of the transfer is the unique, temporary deposit address.
            const depositAddress = pyusdTransfer.toUserAccount;

            // Find the pending order that is waiting for a payment to this address.
            const snapshot = await db.collection('orders')
                                     .where('depositAddress', '==', depositAddress)
                                     .where('status', '==', 'pending')
                                     .get();

            // If no matching pending order is found, log a warning and skip.
            // This can happen if a payment is sent to an old address or if the webhook
            // arrives before the order is saved to the database.
            if (snapshot.empty) {
                console.warn(`Webhook received a valid PYUSD transfer to ${depositAddress}, but no matching pending order was found in the database.`);
                continue;
            }
            
            // 5. Trigger the payment processing logic
            const orderDoc = snapshot.docs[0];
            const paidAmount = pyusdTransfer.tokenAmount; // Amount with decimals (e.g., 10.5)
            
            // Call the centralized processing function. We do this *without* 'await'
            // to immediately send a success response to Helius and prevent timeouts.
            // The payment processing will continue in the background.
            processPyusdPayment(connection, orderDoc.ref, paidAmount, 'webhook', tx.signature);
        }

        // 6. Acknowledge receipt to Helius
        // Immediately tell Helius that we have received the webhook successfully.
        res.status(200).json({ success: true, message: "Webhook received and is being processed." });

    } catch (error) {
        console.error("WEBHOOK PROCESSING ERROR: An unexpected error occurred while handling the webhook payload.", error);
        // If a critical error occurs, let Helius know it was a server error.
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}