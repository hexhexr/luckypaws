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

// Use a different Auth Secret for devnet and mainnet webhooks
const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet'
    ? process.env.HELIUS_DEVNET_AUTH_SECRET
    : process.env.HELIUS_MAINNET_AUTH_SECRET;

// Use the correct PYUSD Mint Address based on the network
const PYUSD_MINT_ADDRESS = new PublicKey(
    SOLANA_NETWORK === 'devnet'
        ? 'CpMah17kQEL2wqyMKt3mZBdWrNFV4SjXMYKleg9gOa2n' // Devnet PYUSD
        : '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo'  // Mainnet PYUSD
);

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// --- HELPER FUNCTIONS ---

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
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const providedSecret = req.headers['authorization'];
        if (providedSecret !== HELIUS_AUTH_SECRET) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const transactions = req.body;

        for (const tx of transactions) {
            if (tx.type === "TOKEN_TRANSFER" && !tx.transaction.error) {
                const depositAddress = tx.tokenTransfers[0].toUserAccount;
                
                const depositsRef = db.collection('pyusd_deposits');
                const snapshot = await depositsRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
                if (snapshot.empty) continue;

                const depositDoc = snapshot.docs[0];
                const depositData = depositDoc.data();
                
                const amountTransferred = tx.tokenTransfers[0].tokenAmount * (10 ** 6);

                await depositDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature
                });

                const secretKeyArray = new Uint8Array(JSON.parse(depositData._privateKey));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                const sweepSignature = await sweepTokens(depositWalletKeypair, amountTransferred);
                
                await depositDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed'
                });
            }
        }

        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
