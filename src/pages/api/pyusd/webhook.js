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

        const payload = req.body;
        console.log("--- START OF FULL HELIUS PAYLOAD ---");
        console.log(JSON.stringify(payload, null, 2));
        console.log("--- END OF FULL HELIUS PAYLOAD ---");

        res.status(200).json({ success: true, message: "Webhook data received and logged for debugging." });

    } catch (error) {
        console.error('CRITICAL WEBHOOK DEBUG ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error during debug logging." });
    }
}