// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';

// --- CONFIGURATION ---
// These are loaded from your Vercel Environment Variables
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_STRING = process.env.MAIN_WALLET_PRIVATE_KEY;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// --- HELPER FUNCTIONS ---

/**
 * Adds the newly generated deposit address to your Helius webhook's watch list.
 * @param {string} address - The public key of the new deposit address to watch.
 */
async function addAddressToWebhook(address) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) {
        throw new Error("Helius webhook or API key is not configured in environment variables.");
    }
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}/append?api-key=${HELIUS_API_KEY}`;
    
    // Using the 'append' endpoint is more efficient than 'PUT' as it adds to the list
    // without needing to fetch and resubmit the entire existing list of addresses.
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accountAddresses: [address],
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to add address to Helius webhook:", errorData);
        throw new Error(`Helius API Error: ${errorData.error || 'Failed to update webhook'}`);
    } else {
        console.log("Successfully added address to webhook:", address);
    }
}

/**
 * Sends a tiny amount of SOL to a new address to cover the gas fees for the future sweep transaction.
 * @param {PublicKey} depositAddressPublicKey - The public key of the new deposit address to fund.
 */
async function fundAddressForGas(depositAddressPublicKey) {
    if (!MAIN_WALLET_PRIVATE_KEY_STRING) {
        throw new Error("Main wallet private key is not configured.");
    }

    // Recreate your main company wallet from the stored private key string
    const mainWalletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(MAIN_WALLET_PRIVATE_KEY_STRING))
    );
    
    // 0.00002 SOL is enough for several transactions, which is a safe margin.
    const lamportsToSend = 20000;

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: mainWalletKeypair.publicKey,
            toPubkey: depositAddressPublicKey,
            lamports: lamportsToSend,
        })
    );
    
    // Sign and send the transaction to fund the new address
    await sendAndConfirmTransaction(connection, transaction, [mainWalletKeypair]);
    console.log(`Funded ${depositAddressPublicKey.toBase58()} with ${lamportsToSend} lamports for gas.`);
}


// --- MAIN API HANDLER ---

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { username, game, amount } = req.body;
    if (!username || !game || !amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: 'Missing or invalid required fields.' });
    }

    try {
        // 1. Generate a new, temporary Solana wallet for this specific deposit
        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const secretKey = newDepositWallet.secretKey;
        const serializedSecretKey = JSON.stringify(Array.from(secretKey));

        // 2. Fund the new address with a small amount of SOL for future gas fees
        await fundAddressForGas(newDepositWallet.publicKey);

        // 3. Register this new address with Helius so we get notified of payments
        await addAddressToWebhook(publicKey);

        // 4. Store the deposit details and the encrypted private key in Firestore
        const depositRef = db.collection('pyusd_deposits').doc();
        await depositRef.set({
            depositId: depositRef.id,
            username: username,
            game: game,
            amount: parseFloat(amount),
            status: 'pending', // Initial status
            depositAddress: publicKey,
            _privateKey: serializedSecretKey, // For sweeping funds later
            createdAt: Timestamp.now(),
        });

        // 5. Return the unique deposit ID and address to the user's browser
        res.status(200).json({
            depositId: depositRef.id,
            depositAddress: publicKey,
        });

    } catch (error) {
        console.error('Error in create-deposit API:', error);
        res.status(500).json({ message: error.message || 'Failed to create PYUSD deposit address.' });
    }
}
