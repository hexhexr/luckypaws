import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;

// The official address for the Token-2022 Program
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpLznL24');

export function decrypt(data) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(data.iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data.encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * [FINAL CORRECTED VERSION] Checks balance using the Token-2022 Program ID.
 */
export async function checkPyusdBalance(connection, depositAddress, mintAddress) {
    try {
        const ownerPublicKey = new PublicKey(depositAddress);
        const mintPublicKey = new PublicKey(mintAddress);

        // This function now correctly searches within the Token-2022 program
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
            programId: TOKEN_2022_PROGRAM_ID, // Use the correct program ID
        });

        const targetAccount = tokenAccounts.value.find(
            (account) => account.account.data.parsed.info.mint === mintPublicKey.toBase58()
        );

        return targetAccount ? targetAccount.account.data.parsed.info.tokenAmount.uiAmount : 0;
    } catch (error) {
        console.error(`[checkPyusdBalance] Error checking balance for ${depositAddress}:`, error);
        return 0;
    }
}

/**
 * [FINAL CORRECTED VERSION] Processes payment using the Token-2022 Program ID.
 */
export async function processPyusdPayment(connection, orderRef, paidAmount, mintAddress, confirmationMethod, txSignature) {
    const orderData = (await orderRef.get()).data();
    if (orderData.status !== 'pending') return;

    console.log(`Processing payment for order ${orderRef.id} via ${confirmationMethod}.`);
    
    await orderRef.update({ status: 'paid', paidAt: Timestamp.now(), transactionSignature: txSignature, confirmationMethod });

    try {
        await orderRef.update({ status: 'sweeping' });
        const decryptedSecret = decrypt(orderData._privateKey);
        const secretKeyArray = new Uint8Array(JSON.parse(decryptedSecret));
        const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
        
        const mintPublicKey = new PublicKey(mintAddress);
        
        // When finding the ATAs, we must also specify the correct program ID
        const fromAta = await getAssociatedTokenAddress(mintPublicKey, depositWalletKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID);
        const toAta = await getAssociatedTokenAddress(mintPublicKey, MAIN_WALLET_PUBLIC_KEY, false, TOKEN_2022_PROGRAM_ID);

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction({ feePayer: depositWalletKeypair.publicKey, recentBlockhash: blockhash }).add(
            createTransferInstruction(
                fromAta,
                toAta,
                depositWalletKeypair.publicKey,
                paidAmount * (10 ** 6), // 6 decimals is correct
                [],
                TOKEN_2022_PROGRAM_ID // Pass the correct program ID to the transfer instruction
            )
        );
        
        const sweepSignature = await connection.sendAndConfirmTransaction(transaction, [depositWalletKeypair]);
        console.log(`Sweep successful for order ${orderRef.id}! Signature: ${sweepSignature}`);
        
        await orderRef.update({ status: 'completed', sweepSignature });
    } catch (sweepError) {
        console.error(`CRITICAL SWEEP ERROR for order ${orderRef.id}:`, sweepError);
        await orderRef.update({ status: 'sweep_failed', failureReason: sweepError.message || 'Unknown sweep error.' });
    }
}