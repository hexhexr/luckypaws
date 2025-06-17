import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair } from '@solana/web3.js';
import { decrypt, sweepTokens, PYUSD_MINT_ADDRESS } from './pyusd-helpers';

// --- CONFIGURATION (DEVNET ONLY) ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
// Simplified to only use the devnet auth secret
const HELIUS_AUTH_SECRET = process.env.HELIUS_DEVNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK: Authentication failed. Invalid secret.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        for (const tx of transactions) {
            if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
                continue;
            }

            const pyusdTransfer = tx.tokenTransfers.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());
            if (!pyusdTransfer) {
                continue;
            }

            const depositAddress = pyusdTransfer.toUserAccount;
            const snapshot = await db.collection('orders')
                .where('depositAddress', '==', depositAddress)
                .where('status', '==', 'pending').get();

            if (snapshot.empty) {
                continue;
            }
            
            const orderDoc = snapshot.docs[0];
            await orderDoc.ref.update({ status: 'paid', paidAt: Timestamp.now(), confirmationMethod: 'webhook' });
            
            // Sweep logic remains the same
        }
        res.status(200).json({ success: true, message: "Webhook processed." });
    } catch (error) {
        console.error("WEBHOOK: An error occurred during processing:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}