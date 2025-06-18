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

// FIX: Standardized environment variable to uppercase
const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet'
    ? process.env.HELIUS_DEVNET_AUTH_SECRET
    : process.env.HELIUS_MAINNET_AUTH_SECRET;

const PYUSD_MINT_ADDRESS = new PublicKey(
    SOLANA_NETWORK === 'devnet'
        ? 'CpMah17kQEL2wqyMKt3mZBdWrNFV4SjXMYKleg9gOa2n'
        : '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'
);

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sweepTokens(depositWallet, amount) {
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
                
                let orderDoc = null;
                let attempt = 0;
                
                while (!orderDoc && attempt < 3) {
                    attempt++;
                    // --- CRITICAL FIX: Changed 'pyusd_deposits' to 'orders' ---
                    console.log(`WEBHOOK: Attempt ${attempt}: Looking for pending order to address: ${depositAddress}`);
                    const ordersRef = db.collection('orders');
                    const snapshot = await ordersRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
                    
                    if (!snapshot.empty) {
                        orderDoc = snapshot.docs[0];
                        console.log(`WEBHOOK: Found matching PENDING order! Doc ID: ${orderDoc.id}`);
                    } else {
                        console.log(`WEBHOOK: Attempt ${attempt}: No PENDING order found. Waiting 2 seconds...`);
                        await sleep(2000); 
                    }
                }

                if (!orderDoc) {
                    console.log(`WEBHOOK: After all attempts, no PENDING order found for address: ${depositAddress}. Skipping...`);
                    continue; 
                }

                const orderData = orderDoc.data();
                const amountTransferred = tx.tokenTransfers[0].tokenAmount;
                console.log(`WEBHOOK: Amount transferred: ${amountTransferred}`);

                await orderDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amountTransferred,
                });
                console.log(`WEBHOOK: Order ${orderDoc.id} status updated to 'paid'.`);

                const secretKeyArray = new Uint8Array(JSON.parse(orderData._privateKey));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                console.log(`WEBHOOK: Attempting to sweep funds from ${depositAddress}...`);
                const sweepSignature = await sweepTokens(depositWalletKeypair, amountTransferred);
                
                await orderDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed'
                });
                console.log(`WEBHOOK: Order ${orderDoc.id} status updated to 'completed'.`);
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