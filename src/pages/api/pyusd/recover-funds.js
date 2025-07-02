// src/pages/api/pyusd/recover-funds.js
import { db } from '../../../lib/firebaseAdmin';
import { withAuth } from '../../../lib/authMiddleware';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createCloseAccountInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PRIVATE_KEY_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;
const PYUSD_MINT_ADDRESS = new PublicKey('2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo');

if (!SOLANA_RPC_URL || !MAIN_WALLET_PRIVATE_KEY_B58) {
    throw new Error("One or more critical environment variables for recovery are not set.");
}

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Sweeps PYUSD and reclaims SOL from a specified temporary wallet.
 * The temporary wallet itself will pay the transaction fee.
 */
async function sweepAndCloseAccount(tempWalletKeypair, mainWalletPublicKey) {
    const fromTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, tempWalletKeypair.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, mainWalletPublicKey);

    let instructions = [];

    // Check for PYUSD balance and add transfer instruction if it exists
    try {
        const balance = await connection.getTokenAccountBalance(fromTokenAccount);
        if (balance.value.amount > 0) {
            instructions.push(
                createTransferInstruction(fromTokenAccount, toTokenAccount, tempWalletKeypair.publicKey, balance.value.amount)
            );
        }
    } catch (e) {
        console.log(`No PYUSD token account found for ${tempWalletKeypair.publicKey.toBase58()}, skipping PYUSD transfer.`);
    }
    
    // Add instruction to close the token account (if it exists)
    instructions.push(
        createCloseAccountInstruction(fromTokenAccount, mainWalletPublicKey, tempWalletKeypair.publicKey)
    );

    // **THE DEFINITIVE FIX:**
    // The temporary wallet must pay its own fee. To do this, we calculate its full balance,
    // subtract a standard transaction fee, and transfer the remainder.
    const balanceInLamports = await connection.getBalance(tempWalletKeypair.publicKey);
    const fee = 5000; // Standard Solana transaction fee in lamports

    // Only add the transfer instruction if there's enough SOL to transfer after paying the fee.
    if (balanceInLamports > fee) {
        instructions.push(
            SystemProgram.transfer({
                fromPubkey: tempWalletKeypair.publicKey,
                toPubkey: mainWalletPublicKey,
                lamports: balanceInLamports - fee
            })
        );
    }

    if (instructions.length === 0) {
        throw new Error("No actions to perform for this wallet.");
    }

    const transaction = new Transaction().add(...instructions);
    
    // The temporary wallet is now the sole signer and fee payer.
    const signature = await sendAndConfirmTransaction(connection, transaction, [tempWalletKeypair]);
    
    console.log(`Manual recovery sweep successful with signature: ${signature}`);
    return signature;
}

/**
 * This handler is protected by withAuth, ensuring only an admin can call it.
 */
const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { publicKey } = req.body;
    if (!publicKey) {
        return res.status(400).json({ message: 'The publicKey of the temporary wallet is required.' });
    }

    try {
        const tempWalletRef = db.collection('tempWallets').doc(publicKey);
        const tempWalletDoc = await tempWalletRef.get();

        if (!tempWalletDoc.exists) {
            return res.status(404).json({ message: `No temporary wallet found with public key: ${publicKey}` });
        }
        
        const privateKeyB58 = tempWalletDoc.data().privateKey;
        if (!privateKeyB58) {
             return res.status(400).json({ message: `Private key not found for wallet: ${publicKey}` });
        }

        const tempWalletKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_B58));

        const sweepSignature = await sweepAndCloseAccount(tempWalletKeypair, mainWalletKeypair.publicKey);

        // Update the wallet's status to prevent reuse
        await tempWalletRef.update({ status: 'manually_closed', sweepSignature });

        res.status(200).json({ success: true, message: `Successfully recovered funds and closed wallet ${publicKey}.`, signature: sweepSignature });

    } catch (error) {
        console.error(`CRITICAL RECOVERY ERROR for wallet ${publicKey}:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default withAuth(handler);
