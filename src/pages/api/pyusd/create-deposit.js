// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { PublicKey } from '@solana/web3.js';

// --- MAINNET CONFIGURATION ---
// We only need the public key of your main wallet now.
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;

if (!MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("Your main wallet's public key is not set in environment variables.");
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

        // 1. Create a new order document in Firestore.
        // The unique ID of this document will be used as the transaction memo.
        const orderRef = db.collection('orders').doc();
        
        await orderRef.set({
            orderId: orderRef.id, // The memo for the user to include
            username: username.toLowerCase().trim(),
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            // The deposit address is now always your main wallet
            depositAddress: MAIN_WALLET_PUBLIC_KEY,
            created: Timestamp.now(),
            network: 'mainnet-beta',
            read: false,
        });

        // 2. Return the main wallet address and the unique order ID (memo) to the user.
        res.status(200).json({
            depositId: orderRef.id,
            depositAddress: MAIN_WALLET_PUBLIC_KEY,
            memo: orderRef.id // The orderId is the memo
        });

    } catch (error) {
        console.error('Create Deposit API Error:', error);
        res.status(500).json({ message: `Failed to create deposit order: ${error.message}` });
    }
}
