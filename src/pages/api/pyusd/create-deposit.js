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

/**
 * Creates a new Solana account and funds it with the minimum amount for rent exemption plus extra for transaction fees.
 * @param {Connection} connection The Solana connection object.
 * @param {Keypair} payer The keypair of the account that will pay for the creation.
 * @param {Keypair} newAccount The keypair for the new account being created.
 */
async function createAndFundAccountForRent(connection, payer, newAccount) {
    // 1. Calculate the minimum balance required to make the new account rent-exempt.
    // The `0` indicates we are creating a base system account with no data.
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    
    // 2. Add a small buffer for future transaction fees (e.g., for the sweep).
    const amountForFees = 50000; // 0.00005 SOL, enough for ~10 transactions
    const totalLamports = rentExemptionAmount + amountForFees;

    // 3. Create the transaction with the correct `createAccount` instruction.
    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: newAccount.publicKey,
            lamports: totalLamports,
            space: 0, // A base account has 0 space
            programId: SystemProgram.programId,
        })
    );
    
    // 4. Send the transaction, signing with both the payer and the new account's keypair.
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

        // Use the new, corrected function to create and fund the account
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
