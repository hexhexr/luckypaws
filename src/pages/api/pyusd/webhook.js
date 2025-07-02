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

/**
 * Sweeps PYUSD from a temporary wallet to the main wallet, then closes the temporary accounts to reclaim SOL.
 * @param {Keypair} tempWalletKeypair - The keypair of the temporary wallet holding the funds.
 * @param {PublicKey} mainWalletPublicKey - The public key of the main wallet to receive the funds and rent.
 * @returns {string} The signature of the sweep transaction.
 */
async function sweepAndCloseAccount(tempWalletKeypair, mainWalletPublicKey) {
    // 1. Get the Associated Token Accounts (ATAs) for PYUSD for both wallets.
    const fromTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, tempWalletKeypair.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, mainWalletPublicKey);

    // 2. Get the full balance of the temporary token account.
    const balance = await connection.getTokenAccountBalance(fromTokenAccount);
    const amountToTransfer = balance.value.amount;

    if (amountToTransfer === 0) {
        console.log(`No PYUSD balance to sweep from ${tempWalletKeypair.publicKey.toBase58()}. Skipping sweep.`);
        return "no_balance_to_sweep";
    }

    // 3. Build the transaction with all instructions.
    const transaction = new Transaction().add(
        // Instruction to transfer the full PYUSD balance to the main wallet
        createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            tempWalletKeypair.publicKey,
            amountToTransfer
        ),
        // Instruction to close the now-empty temporary token account, reclaiming its rent SOL
        createCloseAccountInstruction(
            fromTokenAccount,          // Account to close
            mainWalletPublicKey,       // Destination for reclaimed SOL
            tempWalletKeypair.publicKey // Owner of the account to close
        ),
        // Instruction to close the temporary wallet's main account, reclaiming its rent SOL
        SystemProgram.transfer({
            fromPubkey: tempWalletKeypair.publicKey,
            toPubkey: mainWalletPublicKey,
            lamports: await connection.getBalance(tempWalletKeypair.publicKey)
        })
    );

    // 4. Sign with the temporary wallet's key and send the transaction.
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
            if (tx.transaction.error) continue;

            const involvedAccounts = tx.accountData.map(acc => acc.account);

            for (const depositAddress of involvedAccounts) {
                const ordersRef = db.collection('orders');
                const snapshot = await ordersRef.where('depositAddress', '==', depositAddress)
                                                .where('status', '==', 'pending')
                                                .limit(1).get();
                if (snapshot.empty) continue;

                const orderDoc = snapshot.docs[0];
                const orderData = orderDoc.data();
                console.log(`Webhook detected activity for pending order ${orderDoc.id} at address ${depositAddress}.`);

                // Update order status to 'paid' immediately
                await orderDoc.ref.update({
                    status: 'paid',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                });
                console.log(`Order ${orderDoc.id} marked as 'paid'.`);

                // --- AUTOMATED SWEEP AND CLOSE ---
                try {
                    // Retrieve the temporary wallet's private key from Firestore
                    const tempWalletRef = db.collection('tempWallets').doc(depositAddress);
                    const tempWalletDoc = await tempWalletRef.get();
                    if (!tempWalletDoc.exists) throw new Error(`Temp wallet doc not found for ${depositAddress}`);
                    
                    const privateKeyB58 = tempWalletDoc.data().privateKey;
                    const tempWalletKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));
                    
                    const mainWalletPublicKey = new PublicKey(Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_B58)).publicKey);

                    // Execute the sweep
                    const sweepSignature = await sweepAndCloseAccount(tempWalletKeypair, mainWalletPublicKey);

                    // Update the order and temp wallet with the final status and sweep signature
                    await orderDoc.ref.update({ status: 'completed', sweepSignature });
                    await tempWalletRef.update({ status: 'closed', sweepSignature });
                    console.log(`Order ${orderDoc.id} successfully completed and swept.`);

                } catch (sweepError) {
                    console.error(`CRITICAL SWEEP ERROR for order ${orderDoc.id}:`, sweepError);
                    // If the sweep fails, the order remains 'paid' for manual intervention.
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
