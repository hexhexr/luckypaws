import { db } from '../../../lib/firebaseAdmin';
import { Connection, PublicKey } from '@solana/web3.js';
import { processPyusdPayment } from './pyusd-helpers';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_AUTH_SECRET = process.env.HELIUS_DEVNET_AUTH_SECRET;
const PYUSD_MINT_ADDRESS = process.env.DEVNET_PYUSD_MINT_ADDRESS; // Define in this file
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    if (HELIUS_AUTH_SECRET && req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.error("WEBHOOK AUTHENTICATION FAILED");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        for (const tx of transactions) {
            const pyusdTransfer = tx.tokenTransfers?.find(t => t.mint === PYUSD_MINT_ADDRESS);
            if (!pyusdTransfer) continue;

            const depositAddress = pyusdTransfer.toUserAccount;
            const snapshot = await db.collection('orders').where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
            if (snapshot.empty) {
                console.warn(`Webhook received valid transfer to ${depositAddress}, but no matching pending order was found.`);
                continue;
            }
            
            const orderDoc = snapshot.docs[0];
            const paidAmount = pyusdTransfer.tokenAmount;
            
            // Pass the mint address to the processing function
            processPyusdPayment(connection, orderDoc.ref, paidAmount, PYUSD_MINT_ADDRESS, 'webhook', tx.signature);
        }
        res.status(200).json({ success: true, message: "Webhook received." });
    } catch (error) {
        console.error("WEBHOOK PROCESSING ERROR:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}