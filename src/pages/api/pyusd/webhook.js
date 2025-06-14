// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';

// --- CONFIGURATION ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const PYUSD_MINT_ADDRESS = new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");
const HELIUS_AUTH_SECRET = process.env.HELIUS_AUTH_SECRET; // Our new secret

const connection = new Connection(SOLANA_RPC_URL);

// --- HELPER FUNCTIONS ---

async function sweepTokens(depositWallet, amount) {
    const mainWalletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.MAIN_WALLET_PRIVATE_KEY)));
    const lamportsToSend = 20000;
    const fundingTransaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: mainWalletKeypair.publicKey,
            toPubkey: depositWallet.publicKey,
            lamports: lamportsToSend,
        })
    );
    await sendAndConfirmTransaction(connection, fundingTransaction, [mainWalletKeypair]);
    const fromAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositWallet.publicKey);
    const toAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, MAIN_WALLET_PUBLIC_KEY);
    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new Transaction({ feePayer: depositWallet.publicKey, recentBlockhash: blockhash }).add(
        createTransferInstruction(fromAta, toAta, depositWallet.publicKey, amount)
    );
    transaction.sign(depositWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
}


// --- MAIN HANDLER ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. Verify the Authentication Header
        const providedSecret = req.headers['authorization'];
        if (providedSecret !== HELIUS_AUTH_SECRET) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        // 2. Process the verified data
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