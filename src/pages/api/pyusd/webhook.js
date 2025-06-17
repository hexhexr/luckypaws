import { db } from '../../../lib/firebaseAdmin';
import { Connection } from '@solana/web3.js';
import { PYUSD_MINT_ADDRESS, processPyusdPayment } from './pyusd-helpers';

// --- CONFIGURATION (DEVNET ONLY) ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_AUTH_SECRET = process.env.HELIUS_DEVNET_AUTH_SECRET;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK: Authentication failed.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        for (const tx of transactions) {
            const pyusdTransfer = tx.tokenTransfers?.find(t => t.mint === PYUSD_MINT_ADDRESS.toBase58());
            if (!pyusdTransfer) continue;

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
        res.status(200).json({ success: true, message: "Webhook received." });
    } catch (error) {
        console.error("WEBHOOK: An error occurred:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}