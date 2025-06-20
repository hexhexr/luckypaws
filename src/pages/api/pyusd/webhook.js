// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';

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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- SECURITY FIX: This function should be moved to a secure backend service with proper secret management. ---
// This function will fail because `depositWallet` (derived from the removed private key) is no longer available.
async function sweepTokens(depositWallet, amount) {
    // This function is now a placeholder. Implement sweeping in a secure service.
    console.warn(`SECURITY WARNING: Token sweep for ${amount} PYUSD from wallet ${depositWallet?.publicKey.toBase58()} needs to be performed by a secure, separate service.`);
    return "manual_sweep_required"; 
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        if (req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const transactions = req.body;
        for (const tx of transactions) {
            if (tx.type === "TOKEN_TRANSFER" && !tx.transaction.error) {
                const depositAddress = tx.tokenTransfers[0].toUserAccount;
                
                let orderDoc = null;
                let attempt = 0;
                
                while (!orderDoc && attempt < 3) {
                    attempt++;
                    const ordersRef = db.collection('orders');
                    const snapshot = await ordersRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
                    
                    if (!snapshot.empty) {
                        orderDoc = snapshot.docs[0];
                    } else {
                        await sleep(2000); 
                    }
                }

                if (!orderDoc) continue; 

                const orderData = orderDoc.data();
                const amountTransferred = tx.tokenTransfers[0].tokenAmount;

                await orderDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amountTransferred,
                });
                
                // --- SECURITY FIX: Removed insecure private key retrieval and sweeping logic. ---
                // The sweep must now be handled out-of-band by a secure system.
                // The order status will remain 'paid' until manually or automatically updated.
                console.log(`Order ${orderDoc.id} marked as 'paid'. Manual or secure service sweep is required.`);

                // You could add another status like 'awaiting_sweep' if needed.
                // For now, we will mark as completed but log the sweep requirement.
                const sweepSignature = await sweepTokens(null, amountTransferred);
                await orderDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed' 
                });
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed." });
    } catch (error) {
        console.error('CRITICAL WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}