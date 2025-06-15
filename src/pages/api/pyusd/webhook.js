// src/pages/api/pyusd/webhook.js --- DEBUGGING VERSION
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const providedSecret = req.headers['authorization'];
        const HELIUS_AUTH_SECRET = process.env.SOLANA_NETWORK === 'devnet' 
            ? process.env.HELIUS_DEVNET_AUTH_SECRET 
            : process.env.HELIUS_MAINNET_AUTH_SECRET;

        if (providedSecret !== HELIUS_AUTH_SECRET) {
            console.error("WEBHOOK DEBUG: Unauthorized request received.");
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const transactions = req.body;
        console.log(`WEBHOOK DEBUG: Received a payload with ${transactions.length} transaction(s).`);

        // --- We are logging every transaction in the payload to see its structure ---
        for (const tx of transactions) {
            console.log("--- START OF HELIUS TRANSACTION OBJECT ---");
            console.log(JSON.stringify(tx, null, 2));
            console.log("--- END OF HELIUS TRANSACTION OBJECT ---");
        }
        // --- End of logging ---

        // For now, we are not processing the data, just logging it.
        // We will add the processing logic back once we know the correct structure.

        res.status(200).json({ success: true, message: "Webhook data received and logged for debugging." });

    } catch (error) {
        console.error('CRITICAL WEBHOOK DEBUG ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error during debug logging." });
    }
}