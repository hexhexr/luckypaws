import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair } from '@solana/web3.js';
import { decrypt, sweepTokens, PYUSD_MINT_ADDRESS } from '../../../lib/pyusd-helpers';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet' 
    ? process.env.HELIUS_DEVNET_AUTH_SECRET 
    : process.env.HELIUS_MAINNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    console.log("WEBHOOK: Received a request.");
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK: Authentication failed. Invalid secret.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    console.log("WEBHOOK: Authentication successful.");

    try {
        const transactions = req.body;
        console.log(`WEBHOOK: Processing ${transactions.length} transaction(s).`);

        for (const tx of transactions) {
            console.log(`WEBHOOK: Checking tx: ${tx.signature}`);
            if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
                console.log("WEBHOOK: No token transfers in this tx. Skipping.");
                continue;
            }

            const pyusdTransfer = tx.tokenTransfers.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());
            if (!pyusdTransfer) {
                console.log(`WEBHOOK: No matching PYUSD transfer found. Mint in tx: ${tx.tokenTransfers[0]?.mint}. Expected: ${PYUSD_MINT_ADDRESS.toBase58()}. Skipping.`);
                continue;
            }
            console.log("WEBHOOK: Found a matching PYUSD transfer.");

            const depositAddress = pyusdTransfer.toUserAccount;
            console.log(`WEBHOOK: Deposit address is ${depositAddress}. Querying Firestore...`);
            
            const snapshot = await db.collection('orders')
                .where('depositAddress', '==', depositAddress)
                .where('status', '==', 'pending').get();

            if (snapshot.empty) {
                console.warn(`WEBHOOK: No pending order found in Firestore for deposit address: ${depositAddress}.`);
                continue;
            }
            
            const orderDoc = snapshot.docs[0];
            console.log(`WEBHOOK: Found matching order ${orderDoc.id}. Proceeding with update.`);
            
            // The rest of your logic...
            await orderDoc.ref.update({ status: 'paid', paidAt: Timestamp.now(), confirmationMethod: 'webhook' });
            // ... sweep logic etc.
        }
        res.status(200).json({ success: true, message: "Webhook processed." });
    } catch (error) {
        console.error("WEBHOOK: An error occurred during processing:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}