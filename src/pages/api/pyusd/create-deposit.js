// File: src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' ? process.env.HELIUS_DEVNET_WEBHOOK_ID : process.env.HELIUS_MAINNET_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

if (!MAIN_WALLET_PRIVATE_KEY_STRING_B58 || !ENCRYPTION_KEY) {
    throw new Error("Missing critical environment variables for PYUSD payment creation.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Encrypts a text string using AES-256-GCM.
 * @param {string} text The text to encrypt.
 * @returns {{iv: string, encryptedData: string}} The IV and encrypted data, both as hex strings.
 */
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

async function addAddressToWebhook(newAddress) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) throw new Error("Helius is not configured.");
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    const getResponse = await fetch(url);
    if (!getResponse.ok) throw new Error(`Failed to fetch Helius webhook. Status: ${getResponse.status}`);

    const webhookData = await getResponse.json();
    const existingAddresses = webhookData.accountAddresses || [];
    if (!existingAddresses.includes(newAddress)) {
        existingAddresses.push(newAddress);
    }

    const updatePayload = {
        webhookURL: webhookData.webhookURL,
        transactionTypes: webhookData.transactionTypes,
        accountAddresses: existingAddresses,
        webhookType: webhookData.webhookType,
        authHeader: webhookData.authHeader,
    };
    const updateResponse = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatePayload) });
    if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Helius API Error: ${errorData.message || 'Failed to update webhook'}`);
    }
    console.log(`Successfully added address to Helius webhook: ${newAddress}`);
}

async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    const amountForFees = 50000; // A small amount for future transaction fees
    const totalLamports = rentExemptionAmount + amountForFees;
    const transaction = new Transaction().add(
        SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: newAccount.publicKey, lamports: totalLamports, space: 0, programId: SystemProgram.programId })
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, newAccount]);
    console.log(`Successfully created and funded new deposit address ${newAccount.publicKey.toBase58()}`);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { username, game, amount } = req.body;
        if (!username || !game || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid input: username, game, and a positive amount are required.' });
        }

        console.log("Generating new deposit wallet...");
        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const serializedSecretKey = JSON.stringify(Array.from(newDepositWallet.secretKey));

        console.log("Funding new deposit wallet for rent and fees...");
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58));
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);

        console.log("Registering address with Helius webhook...");
        await addAddressToWebhook(publicKey);

        console.log("Encrypting private key for storage...");
        const encryptedKey = encrypt(serializedSecretKey);

        console.log("Creating order document in Firestore...");
        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            orderId: orderRef.id,
            username,
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: publicKey,
            _privateKey: encryptedKey, // Store the encrypted key object
            created: Timestamp.now(),
            network: SOLANA_NETWORK,
            read: false,
        });

        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });
    } catch (error) {
        console.error('Create Deposit API Critical Error:', error);
        res.status(500).json({ message: 'Failed to create deposit address.', error: error.message });
    }
}