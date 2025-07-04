// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';

// --- MAINNET CONFIGURATION ---
const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("One or more critical environment variables for the webhook are not set.");
}

/**
 * Parses a raw transaction from a Helius webhook to find the memo and transfer details.
 * This function is completely independent of Helius's pre-parsed fields.
 * @param {object} tx - The raw transaction object from the Helius webhook.
 * @returns {object|null} An object with { memo, destination, amount } or null if not a valid payment.
 */
function parsePaymentTransaction(tx) {
    try {
        // The "Raw" webhook payload provides the message as an object.
        const { instructions, accountKeys } = tx.transaction.message;

        // 1. Find the Memo
        const memoInstruction = instructions.find(ix => accountKeys[ix.programIdIndex] === MEMO_PROGRAM_ID);
        if (!memoInstruction || !memoInstruction.data) return null;
        
        // **DEFINITIVE FIX for Memo:** The data is base58 encoded. Decode it to a buffer, then to a UTF-8 string.
        const memo = bs58.decode(memoInstruction.data).toString('utf-8');

        // 2. Find the PYUSD Transfer
        // The instruction for a token transfer has a specific data signature. For `transferChecked`, the first byte is 12.
        const transferInstruction = instructions.find(ix => accountKeys[ix.programIdIndex] === TOKEN_2022_PROGRAM_ID && ix.data && bs58.decode(ix.data)[0] === 12);
        if (!transferInstruction) return null;

        // 3. Confirm the destination is our main wallet
        // In a `transferChecked` instruction, the destination account index is the second account listed in that instruction's `accounts` array.
        const destinationAccountIndex = transferInstruction.accounts[1];
        const destination = accountKeys[destinationAccountIndex];
        
        if (destination !== MAIN_WALLET_PUBLIC_KEY) {
            console.log(`Webhook parsed memo "${memo}", but destination was ${destination}, not the main wallet. Skipping.`);
            return null;
        }

        // 4. Extract the transfer amount
        // The amount is an 8-byte little-endian number starting at the second byte of the instruction data.
        const instructionDataBuffer = bs58.decode(transferInstruction.data);
        const amount = Number(instructionDataBuffer.readBigUInt64LE(1)); // Read 64-bit unsigned integer, little-endian

        // The amount is in the smallest unit of the token. For PYUSD with 6 decimals, we divide by 1,000,000.
        const finalAmount = amount / 1_000_000;

        return { memo, destination, amount: finalAmount };

    } catch (e) {
        console.error("Error manually parsing transaction:", e);
        return null;
    }
}


export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    if (req.headers['authorization'] !== HELIUS_AUTH_SECRET) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const transactions = req.body;
        if (!Array.isArray(transactions)) {
            return res.status(400).json({ success: false, message: "Invalid payload." });
        }

        for (const tx of transactions) {
            if (!tx || !tx.transaction || !tx.transaction.message || tx.transaction.error) {
                continue;
            }
            
            // Use our new, robust parsing function
            const paymentDetails = parsePaymentTransaction(tx);
            
            if (!paymentDetails) {
                // This log is expected for non-payment transactions to your wallet.
                console.log("Webhook received a transaction that was not a valid PYUSD payment. Skipping.");
                continue;
            }

            const { memo, amount } = paymentDetails;

            // Find the pending order that matches this unique 6-digit memo.
            const ordersRef = db.collection('orders');
            const q = ordersRef.where('memo', '==', memo).where('status', '==', 'pending').limit(1);
            
            const snapshot = await q.get();

            if (!snapshot.empty) {
                const orderDoc = snapshot.docs[0];
                console.log(`Webhook detected payment for order with memo: ${memo}`);

                await orderDoc.ref.update({
                    status: 'completed',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amount,
                });

                console.log(`Order ${orderDoc.id} successfully marked as completed.`);
            } else {
                console.log(`Received payment with memo "${memo}", but no matching pending order was found.`);
            }
        }
        res.status(200).json({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        console.error('CRITICAL PYUSD WEBHOOK ERROR:', error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
}
