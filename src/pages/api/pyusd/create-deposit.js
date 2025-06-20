import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' ? process.env.HELIUS_DEVNET_WEBHOOK_ID : process.env.HELIUS_MAINNET_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function addAddressToWebhook(newAddress) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) throw new Error("Helius not configured.");
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    const getResponse = await fetch(url);
    const webhookData = await getResponse.json();
    if (!getResponse.ok) throw new Error(`Failed to fetch webhook. Status: ${getResponse.status}`);
    
    let existingAddresses = webhookData.accountAddresses || [];
    if (existingAddresses.includes(newAddress)) return;
    existingAddresses.push(newAddress);

    const updatePayload = {
        webhookURL: webhookData.webhookURL,
        transactionTypes: webhookData.transactionTypes,
        accountAddresses: existingAddresses,
        webhookType: webhookData.webhookType,
        ...(webhookData.authHeader && { authHeader: webhookData.authHeader })
    };

    const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
        const updateResponseData = await updateResponse.json();
        throw new Error(`Helius API Error: ${updateResponseData.message || 'Failed to update webhook'}`);
    }
}

async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    const amountForFees = 50000;
    const totalLamports = rentExemptionAmount + amountForFees;
    const transaction = new Transaction().add(
        SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: newAccount.publicKey, lamports: totalLamports, space: 0, programId: SystemProgram.programId })
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, newAccount]);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    try {
        const { username, game, amount } = req.body;
        if (!username || !game || !amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Missing fields.' });
        }
        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58));
        
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);

        // --- FIX: Abort if webhook registration fails to prevent lost funds ---
        try {
            await addAddressToWebhook(publicKey);
        } catch (webhookError) {
            console.error(`CRITICAL: Failed to add address ${publicKey} to Helius webhook. Aborting order creation. Error: ${webhookError.message}`);
            // TODO: Implement a mechanism to reclaim funds from the created-but-unmonitored address.
            return res.status(500).json({ message: 'Failed to configure payment monitoring. Please try again later.' });
        }

        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            orderId: orderRef.id,
            username: username.toLowerCase().trim(),
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: publicKey,
            // --- SECURITY FIX: DO NOT STORE THE PRIVATE KEY IN THE DATABASE ---
            // The sweeping process must be handled by a secure, separate service
            // that has access to keys via a proper secret manager (e.g., GCP Secret Manager).
            created: Timestamp.now(),
            network: SOLANA_NETWORK,
            read: false,
        });
        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });
    } catch (error) {
        console.error('Create Deposit API Error:', error.message);
        res.status(500).json({ message: 'Failed to create deposit.' });
    }
}