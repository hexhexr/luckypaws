import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair } from '@solana/web3.js';
import { decrypt, sweepTokens, PYUSD_MINT_ADDRESS } from '../../../lib/pyusd-helpers';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
// This code correctly selects the DEVNET secret when SOLANA_NETWORK is 'devnet'
const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet' 
    ? process.env.HELIUS_DEVNET_AUTH_SECRET 
    : process.env.HELIUS_MAINNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // 1. Authenticate the webhook request
    if (!HELIUS_AUTH_SECRET) {
        console.error("CRITICAL: HELIUS AUTH SECRET is not configured on the server.");
        return res.status(500).json({ success: false, message: "Webhook secret not configured." });
    }
    const providedSecret = req.headers['authorization'];
    if (providedSecret !== HELIUS_AUTH_SECRET) {
        console.error("Webhook authentication failed: Invalid secret provided.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;

        for (const tx of transactions) {
            // 2. Filter for relevant PYUSD transfers
            if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) continue;
            const pyusdTransfer = tx.tokenTransfers.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());
            if (!pyusdTransfer) continue;

            const depositAddress = pyusdTransfer.toUserAccount;
            
            // 3. Find the corresponding order in Firestore, with retries
            let orderDoc = null;
            let attempt = 0;
            while (!orderDoc && attempt < 3) {
                attempt++;
                const snapshot = await db.collection('orders')
                    .where('depositAddress', '==', depositAddress)
                    .where('status', '==', 'pending').get();
                
                if (!snapshot.empty) {
                    orderDoc = snapshot.docs[0];
                } else if (attempt < 3) {
                    await sleep(2000); // Wait for potential database replication delay
                }
            }

            if (!orderDoc) {
                console.warn(`Webhook received for ${depositAddress}, but no pending order was found.`);
                continue;
            }

            // 4. Update order status to 'paid'
            await orderDoc.ref.update({
                status: 'paid',
                paidAt: Timestamp.now(),
                transactionSignature: tx.signature,
                confirmationMethod: 'webhook'
            });

            const orderData = orderDoc.data();
            
            // 5. Attempt to sweep the tokens, with error handling
            try {
                await orderDoc.ref.update({ status: 'sweeping' });
                const decryptedSecret = decrypt(orderData._privateKey, ENCRYPTION_KEY);
                const secretKeyArray = new Uint8Array(JSON.parse(decryptedSecret));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                const amountToSweep = pyusdTransfer.tokenAmount * (10 ** 6); // PYUSD has 6 decimals
                const sweepSignature = await sweepTokens(connection, depositWalletKeypair, amountToSweep);
                
                await orderDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed'
                });
                console.log(`Successfully swept ${pyusdTransfer.tokenAmount} PYUSD for order ${orderDoc.id}.`);
            } catch (sweepError) {
                console.error(`CRITICAL SWEEP ERROR for order ${orderDoc.id}:`, sweepError);
                await orderDoc.ref.update({
                    status: 'sweep_failed',
                    failureReason: sweepError.message || 'Unknown sweep error.'
                });
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error("Internal webhook processing error:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}