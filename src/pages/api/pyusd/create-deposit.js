// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const SOLANA_NETWORK = 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = process.env.HELIUS_MAINNET_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;

if (!SOLANA_RPC_URL || !HELIUS_API_KEY || !HELIUS_WEBHOOK_ID || !MAIN_WALLET_PRIVATE_KEY_B58) {
    throw new Error("One or more critical environment variables for PYUSD mainnet are not set.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function addAddressToWebhook(newAddress) {
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    const getResponse = await fetch(url);
    if (!getResponse.ok) {
        console.error('Helius Fetch Error:', await getResponse.text());
        throw new Error(`Failed to fetch Helius webhook. Status: ${getResponse.status}`);
    }
    const webhookData = await getResponse.json();
    
    const existingAddresses = webhookData.accountAddresses || [];
    if (existingAddresses.includes(newAddress)) {
        console.log(`Address ${newAddress} is already monitored.`);
        return;
    }
    const updatedAddresses = [...existingAddresses, newAddress];

    const updatePayload = {
        webhookURL: webhookData.webhookURL,
        transactionTypes: webhookData.transactionTypes,
        accountAddresses: updatedAddresses,
        webhookType: webhookData.webhookType,
        ...(webhookData.authHeader && { authHeader: webhookData.authHeader })
    };

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

async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    
    // --- FEE OPTIMIZATION ---
    // Explicitly set a very low priority fee for this transaction.
    const lowPriorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100 // Set a minimal fee (0.0000001 lamports per compute unit)
    });

    const transaction = new Transaction().add(
        lowPriorityFeeInstruction, // Add the fee instruction first
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

        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const privateKey = bs58.encode(newDepositWallet.secretKey);

        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_B58));
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);

        try {
            await addAddressToWebhook(publicKey);
        } catch (webhookError) {
            console.error(`CRITICAL: Failed to add address ${publicKey} to Helius webhook. Aborting order creation. Error: ${webhookError.message}`);
            return res.status(500).json({ message: 'Failed to configure payment monitoring. Please try again later.' });
        }

        const tempWalletRef = db.collection('tempWallets').doc(publicKey);
        await tempWalletRef.set({
            publicKey: publicKey,
            privateKey: privateKey,
            createdAt: Timestamp.now(),
            orderId: null,
            status: 'active'
        });

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

        await tempWalletRef.update({ orderId: orderRef.id });

        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });

    } catch (error) {
        console.error('Create Deposit API Error:', error);
        res.status(500).json({ message: `Failed to create deposit: ${error.message}` });
    }
}
