// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58'; // <-- Import the new library

// --- CONFIGURATION ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_WEBHOOK_ID;
// This is your private key as a long string (base58 format)
const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;

// --- HELPER FUNCTIONS ---

async function addAddressToWebhook(address) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) {
        throw new Error("Helius webhook or API key is not configured.");
    }
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}/append?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountAddresses: [address] }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Helius API Error:", errorData);
        throw new Error(`Helius API Error: ${errorData.error || 'Failed to update webhook'}`);
    } else {
        console.log("Successfully added address to webhook:", address);
    }
}

async function fundAddressForGas(connection, depositAddressPublicKey) {
    if (!MAIN_WALLET_PRIVATE_KEY_STRING_B58) {
        throw new Error("MAIN_WALLET_PRIVATE_KEY is not configured.");
    }

    let mainWalletKeypair;
    try {
        // --- THIS IS THE KEY CHANGE ---
        // We now use bs58.decode() to convert the string key into the format web3.js needs.
        const decodedKey = bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58);
        mainWalletKeypair = Keypair.fromSecretKey(decodedKey);

    } catch (e) {
        console.error("Failed to decode MAIN_WALLET_PRIVATE_KEY. Make sure it is the correct base58 string from your wallet.", e);
        throw new Error("Invalid format for main wallet private key.");
    }
    
    const lamportsToSend = 20000;
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: mainWalletKeypair.publicKey,
            toPubkey: depositAddressPublicKey,
            lamports: lamportsToSend,
        })
    );
    await sendAndConfirmTransaction(connection, transaction, [mainWalletKeypair]);
    console.log(`Funded ${depositAddressPublicKey.toBase58()} with ${lamportsToSend} lamports for gas.`);
}

// --- MAIN API HANDLER ---

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        if (!SOLANA_RPC_URL || !MAIN_WALLET_PRIVATE_KEY_STRING_B58 || !HELIUS_API_KEY || !HELIUS_WEBHOOK_ID) {
            console.error("One or more environment variables are missing.");
            return res.status(500).json({ message: "Server configuration error." });
        }

        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const { username, game, amount } = req.body;
        if (!username || !game || !amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Missing or invalid required fields.' });
        }

        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const serializedSecretKey = JSON.stringify(Array.from(newDepositWallet.secretKey));

        await fundAddressForGas(connection, newDepositWallet.publicKey);
        await addAddressToWebhook(publicKey);

        const depositRef = db.collection('pyusd_deposits').doc();
        await depositRef.set({
            depositId: depositRef.id,
            username,
            game,
            amount: parseFloat(amount),
            status: 'pending',
            depositAddress: publicKey,
            _privateKey: serializedSecretKey,
            createdAt: Timestamp.now(),
        });

        res.status(200).json({
            depositId: depositRef.id,
            depositAddress: publicKey,
        });

    } catch (error) {
        console.error('Error in create-deposit API:', error.message);
        res.status(500).json({ message: error.message || 'Failed to create PYUSD deposit address.' });
    }
}
