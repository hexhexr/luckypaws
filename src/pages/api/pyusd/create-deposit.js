// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta'; // Default to mainnet if not set
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Use different webhook IDs for devnet and mainnet for better separation
const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' 
    ? process.env.HELIUS_DEVNET_WEBHOOK_ID 
    : process.env.HELIUS_MAINNET_WEBHOOK_ID;

const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// --- HELPER FUNCTIONS ---

async function addAddressToWebhook(address) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) {
        throw new Error("Helius webhook or API key is not configured for the current network.");
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
        console.log(`Successfully added address to ${SOLANA_NETWORK} webhook:`, address);
    }
}

async function fundAddressForGas(connection, depositAddressPublicKey) {
    if (!MAIN_WALLET_PRIVATE_KEY_STRING_B58) {
        throw new Error("MAIN_WALLET_PRIVATE_KEY is not configured.");
    }

    let mainWalletKeypair;
    try {
        const decodedKey = bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58);
        mainWalletKeypair = Keypair.fromSecretKey(decodedKey);
    } catch (e) {
        console.error("Failed to decode MAIN_WALLET_PRIVATE_KEY.", e);
        throw new Error("Invalid format for main wallet private key.");
    }
    
    // 0.00002 SOL is enough for several transactions.
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
            console.error("One or more critical environment variables are missing.");
            return res.status(500).json({ message: "Server configuration error." });
        }

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
            network: SOLANA_NETWORK // Track which network the deposit was made on
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
