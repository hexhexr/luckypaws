// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createCloseAccountInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PRIVATE_KEY_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;

// The official PYUSD mint address on Solana Mainnet
const PYUSD_MINT_ADDRESS = new PublicKey('2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo');

if (!HELIUS_AUTH_SECRET || !SOLANA_RPC_URL || !MAIN_WALLET_PRIVATE_KEY_B58) {
    throw new Error("One or more critical environment variables for the webhook are not set.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function sweepAndCloseAccount(tempWalletKeypair, mainWalletPublicKey) {
    const fromTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, tempWalletKeypair.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, mainWalletPublicKey);

    const balance = await connection.getTokenAccountBalance(fromTokenAccount);
    const amountToTransfer = balance.value.amount;

    if (amountToTransfer === 0) {
        return "no_balance_to_sweep";
    }

    const transaction = new Transaction().add(
        createTransferInstruction(fromTokenAccount, toTokenAccount, tempWalletKeypair.publicKey, amountToTransfer),
        createCloseAccountInstruction(fromTokenAccount, mainWalletPublicKey, tempWalletKeypair.publicKey),
        SystemProgram.transfer({ fromPubkey: tempWalletKeypair.publicKey, toPubkey: mainWalletPublicKey, lamports: await connection.getBalance(tempWalletKeypair.publicKey) })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [tempWalletKeypair]);
    console.log(`Sweep transaction successful with signature: ${signature}`);
    return signature;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    if (req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        console.warn("Unauthorized webhook attempt detected.");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        if (!Array.isArray(transactions)) {
            return res.status(400).json({ success: false, message: "Invalid payload." });
        }

        for (const tx of transactions) {
            // FIX: Robust check to prevent crash from malformed Helius payloads.
            if (!tx || !tx.transaction || !Array.isArray(tx.accountData)) {
                console.warn("Skipping malformed or irrelevant transaction object in webhook payload.");
                continue;
            }
            if (tx.transaction.error) continue;

            // FIX: Robustly parse all accounts to reliably detect Token-2022 (PYUSD) transfers.
            const involvedAccounts = tx.accountData.map(acc => acc.account);

            for (const depositAddress of involvedAccounts) {
                const ordersRef = db.collection('orders');
                const snapshot = await ordersRef.where('depositAddress', '==', depositAddress)
                                                .where('status', '==', 'pending')
                                                .limit(1).get();
                if (snapshot.empty) continue;

                const orderDoc = snapshot.docs[0];
                console.log(`Webhook detected activity for pending order ${orderDoc.id} at address ${depositAddress}.`);

                await orderDoc.ref.update({ status: 'paid', paidAt: Timestamp.now(), transactionSignature: tx.signature });
                console.log(`Order ${orderDoc.id} marked as 'paid'.`);

                try {
                    const tempWalletRef = db.collection('tempWallets').doc(depositAddress);
                    const tempWalletDoc = await tempWalletRef.get();
                    if (!tempWalletDoc.exists) throw new Error(`Temp wallet doc not found for ${depositAddress}`);
                    
                    const privateKeyB58 = tempWalletDoc.data().privateKey;
                    const tempWalletKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));
                    
                    const mainWalletPublicKey = new PublicKey(Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_B58)).publicKey);

                    // FIX: Automatically sweep funds and reclaim SOL rent.
                    const sweepSignature = await sweepAndCloseAccount(tempWalletKeypair, mainWalletPublicKey);

                    await orderDoc.ref.update({ status: 'completed', sweepSignature });
                    await tempWalletRef.update({ status: 'closed', sweepSignature });
                    console.log(`Order ${orderDoc.id} successfully completed and swept.`);

                } catch (sweepError) {
                    console.error(`CRITICAL SWEEP ERROR for order ${orderDoc.id}:`, sweepError);
                    await orderDoc.ref.update({ status: 'paid_sweep_failed', failureReason: sweepError.message });
                }
                
                break;
            }
        }

        res.status(200).json({ success: true, message: "Webhook processed successfully." });

    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
