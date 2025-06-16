// File: src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';

// --- CONFIGURATION ---
// This reads your .env.local file. Ensure SOLANA_NETWORK is set to 'devnet'.
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
// The code correctly selects the DEVNET webhook ID when SOLANA_NETWORK is 'devnet'.
const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' 
    ? process.env.HELIUS_DEVNET_WEBHOOK_ID 
    : process.env.HELIUS_MAINNET_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

if (!MAIN_WALLET_PRIVATE_KEY_STRING_B58 || !ENCRYPTION_KEY || !SOLANA_RPC_URL || !HELIUS_API_KEY || !HELIUS_WEBHOOK_ID) {
    console.error("Critical environment variables are missing for PYUSD deposit creation.");
    // In a real app, you might want to throw an error or handle this more gracefully
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Encrypts a text string using AES-256-GCM.
 */
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

/**
 * Adds a new Solana address to your Helius webhook's watch list.
 */
async function addAddressToWebhook(newAddress) {
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    
    // First, get the current list of addresses on the webhook
    const getResponse = await fetch(url);
    if (!getResponse.ok) {
        throw new Error(`Failed to fetch Helius webhook configuration. Status: ${getResponse.status}`);
    }
    const webhookData = await getResponse.json();
    const existingAddresses = webhookData.accountAddresses || [];
    
    // Add the new address if it's not already present
    if (existingAddresses.includes(newAddress)) {
        console.log(`Address ${newAddress} is already on the Helius webhook list.`);
        return;
    }
    const updatedAddresses = [...existingAddresses, newAddress];

    // Update the webhook with the new list
    const updatePayload = {
        accountAddresses: updatedAddresses,
    };
    const updateResponse = await fetch(url, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(updatePayload) 
    });

    if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Helius API Error: ${errorData.message || 'Failed to update webhook'}`);
    }
    console.log(`Successfully added address to Helius webhook: ${newAddress}`);
}

/**
 * Creates a new account on Solana and funds it with enough SOL to be rent-exempt.
 */
async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    // Add a small amount of lamports for potential future transaction fees (like token account creation)
    const amountForFees = 50000; 
    const totalLamports = rentExemptionAmount + amountForFees;

    const transaction = new Transaction().add(
        SystemProgram.createAccount({ 
            fromPubkey: payer.publicKey, 
            newAccountPubkey: newAccount.publicKey, 
            lamports: totalLamports, 
            space: 0, 
            programId: SystemProgram.programId 
        })
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, newAccount]);
    console.log(`Successfully created and funded new deposit address ${newAccount.publicKey.toBase58()} on ${SOLANA_NETWORK}`);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { username, game, amount } = req.body;
        if (!username || !game || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid input: username, game, and a positive amount are required.' });
        }

        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const serializedSecretKey = JSON.stringify(Array.from(newDepositWallet.secretKey));
        
        // Ensure your MAIN_WALLET has DEVNET SOL
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58));
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);

        await addAddressToWebhook(publicKey);

        const encryptedKey = encrypt(serializedSecretKey);

        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            orderId: orderRef.id,
            username,
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: publicKey,
            _privateKey: encryptedKey,
            created: Timestamp.now(),
            network: SOLANA_NETWORK, // Explicitly save the network
            read: false,
        });

        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });
    } catch (error) {
        console.error('Create Deposit API Critical Error:', error);
        res.status(500).json({ message: 'Failed to create deposit address.', error: error.message });
    }
}