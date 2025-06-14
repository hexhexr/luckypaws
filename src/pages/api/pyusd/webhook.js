// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';

// --- CONFIGURATION ---
// Load these from environment variables
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const PYUSD_MINT_ADDRESS = new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");

const connection = new Connection(SOLANA_RPC_URL);

/**
 * Sweeps (transfers) tokens from a temporary deposit wallet to the main company wallet.
 * @param {Keypair} depositWallet - The keypair for the temporary wallet holding the funds.
 * @param {number} amount - The amount of the token to transfer (in its smallest unit, e.g., lamports for SOL).
 */
async function sweepTokens(depositWallet, amount) {
    try {
        // 1. Find the Associated Token Account for the source (the temporary deposit wallet)
        const fromAta = await getAssociatedTokenAddress(
            PYUSD_MINT_ADDRESS,
            depositWallet.publicKey
        );

        // 2. Find the Associated Token Account for the destination (your main wallet)
        const toAta = await getAssociatedTokenAddress(
            PYUSD_MINT_ADDRESS,
            MAIN_WALLET_PUBLIC_KEY
        );

        // 3. Get the latest blockhash to include in the transaction
        const { blockhash } = await connection.getLatestBlockhash();

        // 4. Create the transaction and add the transfer instruction
        const transaction = new Transaction({
            feePayer: depositWallet.publicKey, // The deposit wallet pays the fee from the tiny amount of SOL it holds
            recentBlockhash: blockhash,
        }).add(
            createTransferInstruction(
                fromAta,
                toAta,
                depositWallet.publicKey,
                amount
            )
        );
        
        // 5. Sign the transaction with the deposit wallet's private key
        transaction.sign(depositWallet);

        // 6. Send the transaction to the Solana network
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        
        console.log(`Sweep successful! Signature: ${signature}`);
        return signature;

    } catch (error) {
        console.error('Error sweeping funds:', error);
        throw new Error('Failed to sweep funds from deposit address.');
    }
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // The request body contains an array of transaction events from the webhook provider (e.g., Helius)
        const transactions = req.body;

        for (const tx of transactions) {
            // Ensure this is a successful token transfer
            if (tx.type === "TOKEN_TRANSFER" && !tx.transaction.error) {
                
                // Find the deposit address in the list of account data
                const depositAccountInfo = tx.accountData.find(acc => acc.account === tx.tokenTransfers[0].toUserAccount);
                if (!depositAccountInfo) continue;
                
                const depositAddress = depositAccountInfo.account;

                // Query Firestore to find the corresponding deposit document
                const depositsRef = db.collection('pyusd_deposits');
                const snapshot = await depositsRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();

                if (snapshot.empty) {
                    console.log(`No pending deposit found for address: ${depositAddress}`);
                    continue;
                }

                const depositDoc = snapshot.docs[0];
                const depositData = depositDoc.data();
                
                // The amount of PYUSD transferred (PYUSD has 6 decimal places)
                const amountTransferred = tx.tokenTransfers[0].tokenAmount * (10 ** 6);

                // --- Update Firestore ---
                await depositDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature
                });
                console.log(`Deposit ${depositDoc.id} marked as paid.`);

                // --- Sweep the Funds ---
                // Recreate the keypair from the stored secret key
                const secretKeyArray = new Uint8Array(JSON.parse(depositData._privateKey));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                // You'll need a separate process to ensure the deposit wallet has enough SOL for gas
                // For now, we assume it's funded.
                const sweepSignature = await sweepTokens(depositWalletKeypair, amountTransferred);
                
                await depositDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed' // Final status after successful sweep
                });
            }
        }

        res.status(200).json({ success: true, message: "Webhook processed." });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}