import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// --- DEVNET ONLY CONFIGURAfTION ---
// This now directly uses your devnet environment variables.
export const PYUSD_MINT_ADDRESS = new PublicKey(process.env.DEVNET_PYUSD_MINT_ADDRESS);
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;

/**
 * Decrypts an AES-256-GCM encrypted string.
 */
export function decrypt(data) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(data.iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data.encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Checks the blockchain for the balance of a specific token account.
 */
export async function checkPyusdBalance(connection, depositAddress) {
    try {
        const depositPublicKey = new PublicKey(depositAddress);
        const associatedTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositPublicKey);
        const accountInfo = await getAccount(connection, associatedTokenAccount, 'confirmed');
        return Number(accountInfo.amount) / (10 ** 6); // PYUSD has 6 decimals
    } catch (error) {
        if (error.name === 'TokenAccountNotFoundError') return 0;
        console.error(`Error checking balance for ${depositAddress}:`, error);
        return 0;
    }
}

/**
 * Central function to process a detected payment: updates status and sweeps tokens.
 * @param {DocumentReference} orderRef - The Firestore document reference for the order.
 * @param {number} paidAmount - The actual amount paid, detected from the blockchain.
 * @param {string} confirmationMethod - 'webhook' or 'polling'.
 * @param {string} txSignature - The signature of the payment transaction.
 */
export async function processPyusdPayment(connection, orderRef, paidAmount, confirmationMethod, txSignature) {
    const orderData = (await orderRef.get()).data();
    if (orderData.status !== 'pending') {
        console.log(`Order ${orderRef.id} already processed. Status: ${orderData.status}`);
        return;
    }

    console.log(`Processing payment for order ${orderRef.id} via ${confirmationMethod}.`);
    
    // 1. Mark as paid
    await orderRef.update({
        status: 'paid',
        paidAt: Timestamp.now(),
        transactionSignature: txSignature,
        confirmationMethod: confirmationMethod
    });

    // 2. Attempt to sweep tokens
    try {
        await orderRef.update({ status: 'sweeping' });
        const decryptedSecret = decrypt(orderData._privateKey);
        const secretKeyArray = new Uint8Array(JSON.parse(decryptedSecret));
        const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
        
        const fromAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositWalletKeypair.publicKey);
        const toAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, MAIN_WALLET_PUBLIC_KEY);

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction({ feePayer: depositWalletKeypair.publicKey, recentBlockhash: blockhash }).add(
            createTransferInstruction(fromAta, toAta, depositWalletKeypair.publicKey, paidAmount * (10 ** 6), [], 'finalized')
        );
        
        const sweepSignature = await connection.sendAndConfirmTransaction(transaction, [depositWalletKeypair]);
        console.log(`Sweep successful for order ${orderRef.id}! Signature: ${sweepSignature}`);
        
        await orderRef.update({ status: 'completed', sweepSignature });

    } catch (sweepError) {
        console.error(`CRITICAL SWEEP ERROR for order ${orderRef.id}:`, sweepError);
        await orderRef.update({
            status: 'sweep_failed',
            failureReason: sweepError.message || 'Unknown sweep error.'
        });
    }
}