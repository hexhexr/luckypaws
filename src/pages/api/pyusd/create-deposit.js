import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
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

if (!MAIN_WALLET_PRIVATE_KEY_STRING_B58 || !ENCRYPTION_KEY || !SOLANA_RPC_URL || !HELIUS_API_KEY || !HELIUS_WEBHOOK_ID) {
    console.error("Critical environment variables are missing for PYUSD deposit creation.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

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
    
    if (existingAddresses.includes(newAddress)) {
        console.log(`Address ${newAddress} is already on the Helius webhook list.`);
        return;
    }
    const updatedAddresses = [...existingAddresses, newAddress];

    // --- FINAL FIX ---
    // Manually construct the payload with ONLY the updatable fields.
    // This prevents sending back read-only fields (like 'wallet' or 'projectId')
    // or undefined fields (like 'authHeader') from the GET response.
    const updatePayload = {
        webhookURL: webhookData.webhookURL,
        transactionTypes: webhookData.transactionTypes,
        accountAddresses: updatedAddresses,
        webhookType: webhookData.webhookType,
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

async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    const amountForFees = 50000;
    const totalLamports = rentExemptionAmount + amountForFees;
    const transaction = new Transaction().add(
        SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: newAccount.publicKey, lamports: totalLamports, space: 0, programId: SystemProgram.programId })
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
        if (!username || !game || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Invalid input: username, game, and a positive amount are required.' });
        }

        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const serializedSecretKey = JSON.stringify(Array.from(newDepositWallet.secretKey));
        
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
            network: SOLANA_NETWORK,
            read: false,
        });

        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });
    } catch (error) {
        console.error('Create Deposit API Critical Error:', error);
        res.status(500).json({ message: 'Failed to create deposit address.', error: error.message });
    }
}