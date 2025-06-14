// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

// --- CONFIGURATION ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const PYUSD_MINT_ADDRESS = new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo");
const HELIUS_WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET;

const connection = new Connection(SOLANA_RPC_URL);

// --- HELPER FUNCTIONS ---

// Function to verify the webhook signature from Helius
function verifySignature(signature, timestamp, body) {
    if (!HELIUS_WEBHOOK_SECRET) {
        throw new Error("Webhook secret is not configured.");
    }
    const secretBuffer = Buffer.from(HELIUS_WEBHOOK_SECRET.replace(/^wsec_/, ''), 'base64');
    const signedPayload = `${timestamp}.${body}`;
    const computedSignature = crypto.createHmac('sha256', secretBuffer).update(signedPayload).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(computedSignature, 'base64'));
}

async function sweepTokens(depositWallet, amount) {
    // ... (This function remains the same as in the previous guide)
}

// --- MAIN HANDLER ---

export const config = {
    api: {
        bodyParser: false, // We need the raw body to verify the signature
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. Verify the webhook signature
        const signature = req.headers['x-helius-signature'];
        const timestamp = req.headers['webhook-timestamp'];
        
        const rawBody = await new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => resolve(body));
            req.on('error', err => reject(err));
        });

        if (!verifySignature(signature, timestamp, rawBody)) {
            return res.status(401).json({ success: false, message: "Invalid signature." });
        }

        // 2. Process the verified data
        const transactions = JSON.parse(rawBody);

        for (const tx of transactions) {
            if (tx.type === "TOKEN_TRANSFER" && !tx.transaction.error) {
                const depositAddress = tx.tokenTransfers[0].toUserAccount;
                
                const depositsRef = db.collection('pyusd_deposits');
                const snapshot = await depositsRef.where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();

                if (snapshot.empty) continue;

                const depositDoc = snapshot.docs[0];
                const depositData = depositDoc.data();
                
                // PYUSD has 6 decimal places
                const amountTransferred = tx.tokenTransfers[0].tokenAmount * (10 ** 6);

                await depositDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature
                });
                console.log(`Deposit ${depositDoc.id} marked as paid.`);

                // --- Sweep the Funds ---
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