// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const SOLANA_NETWORK = 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL; // Ensure this points to your mainnet RPC provider
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_MAINNET_WEBHOOK_ID; // Use Mainnet Webhook ID
const MAIN_WALLET_PRIVATE_KEY_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;

// Validate environment variables
if (!SOLANA_RPC_URL || !HELIUS_API_KEY || !HELIUS_WEBHOOK_ID || !MAIN_WALLET_PRIVATE_KEY_B58) {
    throw new Error("One or more critical environment variables for PYUSD mainnet are not set.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Adds a new Solana address to an existing Helius webhook for monitoring.
 * @param {string} newAddress - The new Solana public key to monitor.
 */
async function addAddressToWebhook(newAddress) {
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    
    // Fetch the current webhook configuration
    const getResponse = await fetch(url);
    if (!getResponse.ok) {
        console.error('Helius Fetch Error:', await getResponse.text());
        throw new Error(`Failed to fetch Helius webhook. Status: ${getResponse.status}`);
    }
    const webhookData = await getResponse.json();
    
    // Add the new address if it's not already being monitored
    const existingAddresses = webhookData.accountAddresses || [];
    if (existingAddresses.includes(newAddress)) {
        console.log(`Address ${newAddress} is already monitored.`);
        return;
    }
    const updatedAddresses = [...existingAddresses, newAddress];

    // Prepare the payload to update the webhook
    const updatePayload = {
        webhookURL: webhookData.webhookURL,
        transactionTypes: webhookData.transactionTypes,
        accountAddresses: updatedAddresses,
        webhookType: webhookData.webhookType,
        ...(webhookData.authHeader && { authHeader: webhookData.authHeader })
    };

    // Send the update request to Helius
    const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error('Helius Update Error:', errorData);
        throw new Error(`Helius API Error: ${errorData.message || 'Failed to update webhook'}`);
    }
    console.log(`Successfully added ${newAddress} to Helius webhook.`);
}

/**
 * Creates a new Solana account and funds it with enough SOL to be rent-exempt.
 * @param {Keypair} payer - The keypair of the account that will pay for the transaction.
 * @param {Keypair} newAccount - The keypair of the new account to be created.
 */
async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: newAccount.publicKey,
            lamports: rentExemptionAmount,
            space: 0,
            programId: SystemProgram.programId
        })
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, newAccount]);
    console.log(`Funded new wallet ${newAccount.publicKey.toBase58()} with ${rentExemptionAmount} lamports for rent exemption.`);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    
    try {
        const { username, game, amount } = req.body;
        if (!username || !game || !amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Missing or invalid required fields.' });
        }

        // 1. Generate a new, temporary keypair for the deposit
        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const privateKey = bs58.encode(newDepositWallet.secretKey);

        // 2. Fund the new wallet to make it rent-exempt
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_B58));
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);

        // 3. Add the new public key to Helius for monitoring (CRITICAL STEP)
        try {
            await addAddressToWebhook(publicKey);
        } catch (webhookError) {
            console.error(`CRITICAL: Failed to add address ${publicKey} to Helius webhook. Aborting order creation. Error: ${webhookError.message}`);
            // TODO: Implement a mechanism to reclaim funds from the created-but-unmonitored address.
            return res.status(500).json({ message: 'Failed to configure payment monitoring. Please try again later.' });
        }

        // 4. Store the temporary wallet's private key securely for recovery
        const tempWalletRef = db.collection('tempWallets').doc(publicKey);
        await tempWalletRef.set({
            publicKey: publicKey,
            privateKey: privateKey, // Encrypt this in a real production environment if possible
            createdAt: Timestamp.now(),
            orderId: null, // Will be updated below
            status: 'active'
        });

        // 5. Create the order document in Firestore
        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            orderId: orderRef.id,
            username: username.toLowerCase().trim(),
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: publicKey,
            created: Timestamp.now(),
            network: SOLANA_NETWORK,
            read: false,
        });

        // 6. Link the temporary wallet to the order
        await tempWalletRef.update({ orderId: orderRef.id });

        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });

    } catch (error) {
        console.error('Create Deposit API Error:', error);
        res.status(500).json({ message: `Failed to create deposit: ${error.message}` });
    }
}
