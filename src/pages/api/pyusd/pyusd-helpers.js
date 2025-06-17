import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MAIN_WALLET_PUBLIC_KEY_STRING = process.env.MAIN_WALLET_PUBLIC_KEY;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpLznL24');

export function decrypt(data) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), Buffer.from(data.iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data.encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export async function checkPyusdBalance(connection, depositAddress, mintAddress) {
    try {
        const ownerPublicKey = new PublicKey(depositAddress);
        const mintPublicKey = new PublicKey(mintAddress);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, { programId: TOKEN_2022_PROGRAM_ID });
        const targetAccount = tokenAccounts.value.find(acct => acct.account.data.parsed.info.mint === mintPublicKey.toBase58());
        return targetAccount ? targetAccount.account.data.parsed.info.tokenAmount.uiAmount : 0;
    } catch (error) {
        console.error(`[checkPyusdBalance] Error for ${depositAddress}:`, error);
        return 0;
    }
}

export async function processPyusdPayment(connection, orderRef, paidAmount, mintAddress, confirmationMethod, txSignature) {
    const orderData = (await orderRef.get()).data();
    if (orderData.status !== 'pending') return;
    await orderRef.update({ status: 'paid', paidAt: Timestamp.now(), transactionSignature, confirmationMethod });

    try {
        await orderRef.update({ status: 'sweeping' });
        const mainWalletPublicKey = new PublicKey(MAIN_WALLET_PUBLIC_KEY_STRING);
        const mintPublicKey = new PublicKey(mintAddress);
        const decryptedSecret = decrypt(orderData._privateKey);
        const secretKeyArray = new Uint8Array(JSON.parse(decryptedSecret));
        const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
        
        const fromAta = await getAssociatedTokenAddress(mintPublicKey, depositWalletKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID);
        const toAta = await getAssociatedTokenAddress(mintPublicKey, mainWalletPublicKey, false, TOKEN_2022_PROGRAM_ID);

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction({ feePayer: depositWalletKeypair.publicKey, recentBlockhash: blockhash }).add(
            createTransferInstruction(fromAta, toAta, depositWalletKeypair.publicKey, paidAmount * (10 ** 6), [], TOKEN_2022_PROGRAM_ID)
        );
        
        const sweepSignature = await connection.sendAndConfirmTransaction(transaction, [depositWalletKeypair]);
        await orderRef.update({ status: 'completed', sweepSignature });
    } catch (sweepError) {
        console.error(`CRITICAL SWEEP ERROR for order ${orderRef.id}:`, sweepError);
        await orderRef.update({ status: 'sweep_failed', failureReason: sweepError.message || 'Unknown error' });
    }
}