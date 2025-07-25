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
 * Generates a unique 6-digit memo string not used by any other pending order.
 * Ensures memo is safe and string-compatible.
 * @returns {Promise<string>}
 */
async function generateUniqueMemo() {
    let memo;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        // Generate a 6-digit numeric string (not number!)
        memo = String(Math.floor(100000 + Math.random() * 900000)); // always 6-digits

        const snapshot = await db.collection('orders')
            .where('memo', '==', memo)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

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

        // Generate a clean UTF-8 safe memo string
        const shortMemo = await generateUniqueMemo();

        // Create a new order in Firestore
        const orderRef = db.collection('orders').doc();

        await orderRef.set({
            orderId: orderRef.id,
            memo: shortMemo, // Safe string memo
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

        // Optional Debug Log
        console.log(`🪪 New deposit created: memo=${shortMemo}, address=${MAIN_WALLET_PUBLIC_KEY}`);

        // Return deposit info
        return res.status(200).json({
            depositId: orderRef.id,
            depositAddress: MAIN_WALLET_PUBLIC_KEY,
            memo: shortMemo
        });

    } catch (error) {
        console.error('Create Deposit API Error:', error);
        return res.status(500).json({ message: `Failed to create deposit order: ${error.message}` });
    }
}
