import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// This constant now correctly uses your confirmed mint address
export const PYUSD_MINT_ADDRESS = new PublicKey(process.env.DEVNET_PYUSD_MINT_ADDRESS);
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export function decrypt(data) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(data.iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data.encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * [NEW AND IMPROVED] Checks the blockchain for the balance of a specific token account.
 * This version is more robust as it queries all token accounts and finds the correct one,
 * rather than predicting the associated token account address.
 */
export async function checkPyusdBalance(connection, depositAddress) {
    try {
        const ownerPublicKey = new PublicKey(depositAddress);
        const mintPublicKey = PYUSD_MINT_ADDRESS;

        // Get all token accounts for the wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
            programId: TOKEN_PROGRAM_ID,
        });

        // Find the specific token account that matches your PYUSD mint address
        const pyusdAccount = tokenAccounts.value.find(
            (account) => account.account.data.parsed.info.mint === mintPublicKey.toBase58()
        );

        if (pyusdAccount) {
            // If the account is found, return its balance
            const balance = pyusdAccount.account.data.parsed.info.tokenAmount.uiAmount;
            return balance;
        } else {
            // If no account with that mint is found, the balance is 0
            return 0;
        }
    } catch (error) {
        console.error(`[checkPyusdBalance] Error checking balance for ${depositAddress}:`, error);
        return 0;
    }
}

/**
 * Central function to process a detected payment: updates status and sweeps tokens.
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