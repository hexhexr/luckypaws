import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' ? process.env.HELIUS_DEVNET_WEBHOOK_ID : process.env.HELIUS_MAINNET_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function addAddressToWebhook(newAddress) {
    console.log("Attempting to add address to Helius webhook:", newAddress);
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) {
        console.error("Helius environment variables are not configured.");
        throw new Error("Helius not configured.");
    }
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    try {
        console.log("Fetching current webhook configuration...");
        const getResponse = await fetch(url);
        const webhookData = await getResponse.json();
        if (!getResponse.ok) {
            console.error("Failed to fetch webhook. Status:", getResponse.status, "Response:", webhookData);
            throw new Error(`Failed to fetch webhook. Status: ${getResponse.status}`);
        }
        console.log("Successfully fetched webhook config. Current addresses:", webhookData.accountAddresses?.length);

        let existingAddresses = webhookData.accountAddresses || [];
        if (existingAddresses.includes(newAddress)) {
            console.log("Address already exists in webhook. No update needed.");
            return;
        }
        existingAddresses.push(newAddress);

        // Manually build the payload with only the fields Helius expects for an update.
        // This prevents sending back read-only fields like 'webhookID'.
        const updatePayload = {
            webhookURL: webhookData.webhookURL,
            transactionTypes: webhookData.transactionTypes,
            accountAddresses: existingAddresses,
            webhookType: webhookData.webhookType,
            // Conditionally include authHeader only if it exists
            ...(webhookData.authHeader && { authHeader: webhookData.authHeader })
        };

        console.log("Updating webhook with new address list...");
        const updateResponse = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });
        const updateResponseData = await updateResponse.json();
        if (!updateResponse.ok) {
            console.error("Helius API Error during update. Status:", updateResponse.status, "Response:", updateResponseData);
            throw new Error(`Helius API Error: ${updateResponseData.message || 'Failed to update webhook'}`);
        }
        console.log("Successfully updated webhook. New address count:", existingAddresses.length);
    } catch (error) {
        console.error("Critical error in addAddressToWebhook:", error);
        throw error;
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
    console.log(`Created/funded address ${newAccount.publicKey.toBase58()}`);
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
        const serializedSecretKey = JSON.stringify(Array.from(newDepositWallet.secretKey));
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58));
        
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);

        try {
            await addAddressToWebhook(publicKey);
        } catch (webhookError) {
            console.error(`CRITICAL: Failed to add address ${publicKey} to Helius webhook. Manual intervention may be required. Error: ${webhookError.message}`);
        }

        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            orderId: orderRef.id,
            username,
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: publicKey,
            _privateKey: serializedSecretKey,
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