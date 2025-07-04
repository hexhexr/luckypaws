// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { PublicKey } from '@solana/web3.js';

// --- MAINNET CONFIGURATION ---
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;

if (!MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("Your main wallet's public key is not set in environment variables.");
}

/**
 * Generates a unique 6-digit memo that is not currently in use for any other pending order.
 * @returns {Promise<string>} A unique 6-digit numeric string.
 */
async function generateUniqueMemo() {
    let memo;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) { // Add a safety break to prevent infinite loops
        // Generate a random 6-digit number as a string
        memo = Math.floor(100000 + Math.random() * 900000).toString();
        
        const snapshot = await db.collection('orders')
                                 .where('memo', '==', memo)
                                 .where('status', '==', 'pending')
                                 .limit(1).get();
        
        if (snapshot.empty) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        throw new Error("Failed to generate a unique memo after several attempts.");
    }

    return memo;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    try {
        const { username, game, amount } = req.body;
        if (!username || !game || !amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Missing or invalid required fields.' });
        }

        // 1. Generate the unique, short memo.
        const shortMemo = await generateUniqueMemo();

        // 2. Create the order document with the new memo.
        const orderRef = db.collection('orders').doc(); // Still use a unique Firestore ID for the document itself.
        
        await orderRef.set({
            orderId: orderRef.id,
            memo: shortMemo, // Save the short, user-facing memo
            username: username.toLowerCase().trim(),
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: MAIN_WALLET_PUBLIC_KEY,
            created: Timestamp.now(),
            network: 'mainnet-beta',
            read: false,
        });

        // 3. Return the main wallet address and the unique 6-digit memo.
        res.status(200).json({
            depositId: orderRef.id, // The unique ID for polling
            depositAddress: MAIN_WALLET_PUBLIC_KEY,
            memo: shortMemo // The user-friendly memo
        });

    } catch (error) {
        console.error('Create Deposit API Error:', error);
        res.status(500).json({ message: `Failed to create deposit order: ${error.message}` });
    }
}
