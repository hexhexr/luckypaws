import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// --- CONFIGURATION (DEVNET ONLY) ---
// Simplified to only use the devnet mint address from your environment variables
export const PYUSD_MINT_ADDRESS = new PublicKey(process.env.DEVNET_PYUSD_MINT_ADDRESS);

const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);

/**
 * Decrypts an AES-256-GCM encrypted string.
 */
export function decrypt(data, encryptionKey) {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(encryptionKey), Buffer.from(data.iv, 'hex'));
    let decrypted = decipher.update(Buffer.from(data.encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Sweeps tokens from a deposit wallet to the main wallet.
 */
export async function sweepTokens(connection, depositWallet, amount) {
    const fromAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositWallet.publicKey);
    const toAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, MAIN_WALLET_PUBLIC_KEY);

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new Transaction({ feePayer: depositWallet.publicKey, recentBlockhash: blockhash }).add(
        createTransferInstruction(fromAta, toAta, depositWallet.publicKey, amount, [], 'finalized')
    );
    transaction.sign(depositWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight }, 'confirmed');
    console.log(`Sweep successful! Signature: ${signature}`);
    return signature;
}

/**
 * Checks the blockchain for the balance of a specific token account.
 */
export async function checkPyusdBalance(connection, depositAddress) {
    try {
        const depositPublicKey = new PublicKey(depositAddress);
        const associatedTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositPublicKey);
        
        const accountInfo = await getAccount(connection, associatedTokenAccount, 'confirmed');
        
        // Assumes 6 decimal places for PYUSD
        return Number(accountInfo.amount) / (10 ** 6);

    } catch (error) {
        if (error.name === 'TokenAccountNotFoundError') {
            return 0;
        }
        console.error(`Error checking balance for ${depositAddress}:`, error);
        return 0;
    }
}