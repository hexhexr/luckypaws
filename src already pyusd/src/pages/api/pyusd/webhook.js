// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);

const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet'
    ? process.env.HELIUS_DEVNET_AUTH_SECRET
    : process.env.HELIUS_MAINNET_AUTH_SECRET;

const PYUSD_MINT_ADDRESS = new PublicKey(
    SOLANA_NETWORK === 'devnet'
        ? 'CpMah17kQEL2wqyMKt3mZBdWrNFV4SjXMYKleg9gOa2n'
        : '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'
);

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// --- HELPER FUNCTIONS ---

async function sweepTokens(depositWallet, amount) {
    // This function remains the same
    try {
        const fromAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositWallet.publicKey);
        const toAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, MAIN_WALLET_PUBLIC_KEY);

        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new Transaction({ feePayer: depositWallet.publicKey, recentBlockhash: blockhash }).add(
            createTransferInstruction(fromAta, toAta, depositWallet.publicKey, amount)
        );
        transaction.sign(depositWallet);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        console.log(`Sweep successful! Signature: ${signature}`);
        return signature;
    } catch (error) {
        console.error('Error sweeping funds:', error);
        throw new Error('Failed to sweep funds from deposit address.');
    }
}

// Function to introduce a delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- MAIN HANDLER ---
export default async function handler(req, res) {
    console.log("WEBHOOK: Received a new request.");

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const providedSecret = req.headers['authorization'];
        if (providedSecret !== HELIUS_AUTH_SECRET) {
            console.error("WEBHOOK ERROR: Unauthorized - Invalid secret.");
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        console.log("WEBHOOK: Authorization successful.");
        const transactions = req.body;
        console.log(`WEBHOOK: Payload contains ${transactions.length} events.`);

        for (const tx of transactions) {
            if (tx.type === "TOKEN_TRANSFER" && !tx.transaction.error) {
                console.log("WEBHOOK: Processing TOKEN_TRANSFER event...");

                const depositAddress = tx.tokenTransfers[0].toUserAccount;
                
                let depositDoc = null;
                let attempt = 0;
                
                // ** THE FINAL FIX IS HERE: Retry Logic **
                // Try to find the document up to 3 times to account for database lag.
                while (!depositDoc && attempt < 3) {
                    attempt++;
                    console.log(`WEBHOOK: Attempt ${attempt}: Looking for pending deposit to address: ${depositAddress}`);
                    const depositsRef = db.collection('pyusd_deposits');
                    const snapshot = await depositsRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
                    
                    if (!snapshot.empty) {
                        depositDoc = snapshot.docs[0];
                        console.log(`WEBHOOK: Found matching PENDING deposit! Doc ID: ${depositDoc.id}`);
                    } else {
                        console.log(`WEBHOOK: Attempt ${attempt}: No PENDING deposit found. Waiting 2 seconds...`);
                        await sleep(2000); // Wait for 2 seconds before retrying
                    }
                }

                if (!depositDoc) {
                    console.log(`WEBHOOK: After all attempts, no PENDING deposit found for address: ${depositAddress}. Skipping...`);
                    continue; // Skip to the next event in the payload
                }

                const depositData = depositDoc.data();
                const amountTransferred = tx.tokenTransfers[0].tokenAmount * (10 ** 6);
                console.log(`WEBHOOK: Amount transferred: ${amountTransferred}`);

                await depositDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature
                });
                console.log(`WEBHOOK: Deposit ${depositDoc.id} status updated to 'paid'.`);

                const secretKeyArray = new Uint8Array(JSON.parse(depositData._privateKey));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                console.log(`WEBHOOK: Attempting to sweep funds from ${depositAddress}...`);
                const sweepSignature = await sweepTokens(depositWalletKeypair, amountTransferred);
                
                await depositDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed'
                });
                console.log(`WEBHOOK: Deposit ${depositDoc.id} status updated to 'completed'.`);
            } else {
                 console.log(`WEBHOOK: Skipping event of type: ${tx.type}`);
            }
        }

        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error('CRITICAL WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
