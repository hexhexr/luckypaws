// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

// --- CONFIGURATION ---
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet'
    ? process.env.HELIUS_DEVNET_AUTH_SECRET
    : process.env.HELIUS_MAINNET_AUTH_SECRET;

const PYUSD_MINT_ADDRESS = new PublicKey(
    SOLANA_NETWORK === 'devnet'
        ? 'CpMah17kQEL2wqyMKt3mZBdWrNFV4SjXMYKleg9gOa2n' // Devnet PYUSD Mint
        : '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo' // Mainnet PYUSD Mint
);

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY || !ENCRYPTION_KEY) {
    throw new Error("Missing critical environment variables for PYUSD webhook.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Decrypts an AES-256-GCM encrypted string.
 * @param {{iv: string, encryptedData: string}} data The object containing the hex-encoded IV and encrypted data.
 * @returns {string} The decrypted plaintext.
 */
function decrypt(data) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(data.iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data.encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sweepTokens(depositWallet, amount) {
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
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const providedSecret = req.headers['authorization'];
        if (providedSecret !== HELIUS_AUTH_SECRET) {
            console.error("WEBHOOK ERROR: Unauthorized - Invalid secret.");
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const transactions = req.body;

        for (const tx of transactions) {
            if (tx.type !== "TOKEN_TRANSFER" || tx.transaction.error) {
                continue;
            }

            const depositAddress = tx.tokenTransfers[0].toUserAccount;
            
            let orderDoc = null;
            let attempt = 0;
            
            while (!orderDoc && attempt < 3) {
                attempt++;
                const snapshot = await db.collection('orders')
                    .where('depositAddress', '==', depositAddress)
                    .where('status', '==', 'pending').get();
                
                if (!snapshot.empty) {
                    orderDoc = snapshot.docs[0];
                    console.log(`WEBHOOK: Found matching PENDING order! Doc ID: ${orderDoc.id}`);
                } else {
                    if(attempt < 3) await sleep(2000); // Wait before retrying
                }
            }

            if (!orderDoc) {
                console.log(`WEBHOOK: No PENDING order found for address: ${depositAddress}. Skipping.`);
                continue;
            }

            // Idempotency Check
            const currentStatus = orderDoc.data().status;
            if (currentStatus !== 'pending') {
                console.log(`WEBHOOK: Order ${orderDoc.id} is already being processed (status: ${currentStatus}). Skipping duplicate event.`);
                continue;
            }

            const amountTransferred = tx.tokenTransfers[0].tokenAmount * (10 ** 6);

            await orderDoc.ref.update({
                status: 'paid',
                paidAt: Timestamp.now(),
                transactionSignature: tx.signature
            });
            console.log(`WEBHOOK: Order ${orderDoc.id} status updated to 'paid'.`);

            const orderData = orderDoc.data();
            
            try {
                console.log(`WEBHOOK: Decrypting private key for order ${orderDoc.id}...`);
                const decryptedSecret = decrypt(orderData._privateKey);
                const secretKeyArray = new Uint8Array(JSON.parse(decryptedSecret));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                console.log(`WEBHOOK: Attempting to sweep funds from ${depositAddress}...`);
                await orderDoc.ref.update({ status: 'sweeping' });
                const sweepSignature = await sweepTokens(depositWalletKeypair, amountTransferred);
                
                await orderDoc.ref.update({
                    sweepSignature: sweepSignature,
                    status: 'completed'
                });
                console.log(`WEBHOOK: Order ${orderDoc.id} status updated to 'completed'.`);

            } catch (sweepError) {
                console.error(`CRITICAL SWEEP ERROR for order ${orderDoc.id}:`, sweepError);
                await orderDoc.ref.update({
                    status: 'sweep_failed',
                    failureReason: sweepError.message || 'Unknown sweep error.'
                });
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed." });
    } catch (error) {
        console.error('CRITICAL WEBHOOK HANDLER ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}