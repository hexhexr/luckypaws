// src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' 
    ? process.env.HELIUS_DEVNET_WEBHOOK_ID 
    : process.env.HELIUS_MAINNET_WEBHOOK_ID;

const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// --- HELPER FUNCTIONS ---

/**
 * Adds a new address to an existing Helius webhook by constructing a clean update payload.
 * @param {string} newAddress - The new Solana address to add.
 */
async function addAddressToWebhook(newAddress) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) {
        throw new Error("Helius webhook or API key is not configured for the current network.");
    }
    
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;

    try {
        const getResponse = await fetch(url);
        if (!getResponse.ok) {
            throw new Error(`Failed to fetch webhook. Status: ${getResponse.status}`);
        }
        const webhookData = await getResponse.json();
        let existingAddresses = webhookData.accountAddresses || [];

        if (!existingAddresses.includes(newAddress)) {
            existingAddresses.push(newAddress);
        }

        const updatePayload = {
            webhookURL: webhookData.webhookURL,
            transactionTypes: webhookData.transactionTypes,
            accountAddresses: existingAddresses,
            webhookType: webhookData.webhookType,
            authHeader: webhookData.authHeader // Also preserve the auth header
        };
        
        const updateResponse = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error("Helius API Error (Update):", errorData);
            throw new Error(`Helius API Error: ${errorData.message || 'Failed to update webhook'}`);
        } else {
            console.log(`Successfully updated webhook with address: ${newAddress}`);
        }
    } catch (error) {
        console.error("Error in addAddressToWebhook:", error.message);
        throw error;
    }
}


/**
 * Creates a new Solana account and funds it with the minimum amount for rent exemption plus extra for transaction fees.
 */
async function createAndFundAccountForRent(connection, payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    const amountForFees = 50000;
    const totalLamports = rentExemptionAmount + amountForFees;

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: newAccount.publicKey,
            lamports: totalLamports,
            space: 0,
            programId: SystemProgram.programId,
        })
    );
    
    await sendAndConfirmTransaction(connection, transaction, [payer, newAccount]);
    console.log(`Created and funded new address ${newAccount.publicKey.toBase58()} with ${totalLamports} lamports.`);
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
        
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58));

        await createAndFundAccountForRent(connection, mainWalletKeypair, newDepositWallet);
        
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
            network: SOLANA_NETWORK
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
