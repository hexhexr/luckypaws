import { db } from '../../../lib/firebaseAdmin';
import { Connection } from '@solana/web3.js';
import { PYUSD_MINT_ADDRESS, processPyusdPayment } from './pyusd-helpers';

// --- CONFIGURATION ---
// This should match the RPC URL used in other parts of your application
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

// This MUST match the Authorization Header secret from your Helius webhook settings
const HELIUS_AUTH_SECRET = process.env.HELIUS_DEVNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // --- 1. Authentication ---
    // Secure the webhook by checking for the authorization header sent by Helius.
    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK AUTHENTICATION FAILED: The secret in the 'Authorization' header did not match the expected HELIUS_DEVNET_AUTH_SECRET.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    // --- 2. Process Transactions ---
    try {
        const transactions = req.body;

        // The webhook can send an array of transactions, so we loop through them.
        for (const tx of transactions) {
            // Find the specific transfer related to your PYUSD mint address.
            const pyusdTransfer = tx.tokenTransfers?.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());

            // If this transaction doesn't involve PYUSD, skip to the next one.
            if (!pyusdTransfer) {
                continue;
            }

            // --- 3. Find Matching Order ---
            // The destination of the transfer is the temporary deposit address.
            const depositAddress = pyusdTransfer.toUserAccount;

            // Find the pending order in Firestore that corresponds to this deposit address.
            const snapshot = await db.collection('orders')
                                     .where('depositAddress', '==', depositAddress)
                                     .where('status', '==', 'pending')
                                     .get();

            if (snapshot.empty) {
                // This can happen if the webhook arrives before the order is created in Firestore,
                // or if the payment is for an old/non-existent order. It's safe to ignore.
                console.warn(`Webhook received a valid PYUSD transfer to ${depositAddress}, but no matching pending order was found in the database.`);
                continue;
            }
            
            // --- 4. Process Payment ---
            const orderDoc = snapshot.docs[0];
            const paidAmount = pyusdTransfer.tokenAmount; // Amount with decimals (e.g., 10.5)
            
            // Call the centralized processing function. We do this without 'await'
            // to immediately send a 200 OK response to Helius and prevent timeouts.
            // The actual payment processing will happen in the background.
            processPyusdPayment(connection, orderDoc.ref, paidAmount, 'webhook', tx.signature);
        }

        // --- 5. Acknowledge Receipt ---
        // Immediately tell Helius that we have received the webhook successfully.
        res.status(200).json({ success: true, message: "Webhook received and is being processed." });

    } catch (error) {
        console.error("WEBHOOK PROCESSING ERROR: An unexpected error occurred while handling the webhook payload.", error);
        // If something goes wrong, send a server error response.
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}