// src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';

const HELIUS_AUTH_SECRET = process.env.HELIUS_MAINNET_AUTH_SECRET;
const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

if (!HELIUS_AUTH_SECRET || !MAIN_WALLET_PUBLIC_KEY) {
    throw new Error("Missing environment variables for webhook.");
}

function parsePaymentTransaction(tx) {
    try {
        const { instructions, accountKeys } = tx.transaction.message;

        // 1. Decode memo safely (string or base58 encoded)
        const memoInstruction = instructions.find(ix => accountKeys[ix.programIdIndex] === MEMO_PROGRAM_ID);
        if (!memoInstruction || !memoInstruction.data) return null;

        let memo = memoInstruction.data;
        if (typeof memo !== 'string') {
            memo = bs58.decode(memo).toString('utf-8').trim();
        } else {
            memo = memo.trim();
        }

        // ✅ Debug log for memo value
        console.log("✅ Decoded memo:", memo, "| Type:", typeof memo, "| Length:", memo.length);

        // 2. Locate transferChecked instruction
        const transferInstruction = instructions.find(ix =>
            accountKeys[ix.programIdIndex] === TOKEN_2022_PROGRAM_ID &&
            ix.data &&
            bs58.decode(ix.data)[0] === 12
        );
        if (!transferInstruction) return null;

        const destinationAccountIndex = transferInstruction.accounts[2];
        const destinationTokenAccount = accountKeys[destinationAccountIndex];

        // 3. Determine destination owner
        let destinationOwner =
            tx.meta?.postTokenBalances?.find(t => t.accountIndex === destinationAccountIndex)?.owner ||
            tx.meta?.preTokenBalances?.find(t => t.accountIndex === destinationAccountIndex)?.owner ||
            null;

        const destinationIsMainWallet = destinationTokenAccount === MAIN_WALLET_PUBLIC_KEY;
        if (!destinationOwner && destinationIsMainWallet) {
            destinationOwner = MAIN_WALLET_PUBLIC_KEY;
        }

        if (destinationOwner !== MAIN_WALLET_PUBLIC_KEY) {
            console.log(`Memo "${memo}" sent to token account ${destinationTokenAccount}, but owner is ${destinationOwner}. Expected ${MAIN_WALLET_PUBLIC_KEY}. Skipping.`);
            return null;
        }

        // 4. Decode amount from instruction
        const instructionDataRaw = bs58.decode(transferInstruction.data);
        const instructionData = Buffer.from(instructionDataRaw);
        const rawAmount = Number(instructionData.readBigUInt64LE(1));
        const amount = rawAmount / 1_000_000;

        return { memo, amount, destination: destinationTokenAccount };

    } catch (error) {
        console.error("❌ Error parsing transaction:", error);
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

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

            const paymentDetails = parsePaymentTransaction(tx);
            if (!paymentDetails) {
                console.log("Webhook received a transaction that was not a valid PYUSD payment. Skipping.");
                continue;
            }

            const memo = String(paymentDetails.memo).trim();
            const amount = paymentDetails.amount;
            const ordersRef = db.collection('orders');

            console.log("📌 Matching Firestore memo:", JSON.stringify(memo));

            // 1st attempt to match pending order
            let snapshot = await ordersRef
                .where('memo', '==', memo)
                .where('status', '==', 'pending')
                .limit(1)
                .get();

            if (snapshot.empty) {
                // Retry after delay (Firestore indexing)
                await new Promise(res => setTimeout(res, 500));
                snapshot = await ordersRef
                    .where('memo', '==', memo)
                    .where('status', '==', 'pending')
                    .limit(1)
                    .get();
            }

            if (!snapshot.empty) {
                const orderDoc = snapshot.docs[0];
                console.log(`✅ Webhook matched payment for memo "${memo}"`);

                await orderDoc.ref.update({
                    status: 'completed',
                    paidAt: Timestamp.now(),
                    transactionSignature: tx.signature,
                    amountReceived: amount,
                });

                console.log(`✅ Order ${orderDoc.id} marked as completed.`);
            } else {
                // Fallback: check if order exists with a different status
                const fallbackSnapshot = await ordersRef
                    .where('memo', '==', memo)
                    .limit(1)
                    .get();

                if (!fallbackSnapshot.empty) {
                    const existing = fallbackSnapshot.docs[0].data();
                    console.warn(`⚠️ Payment with memo "${memo}" found, but order status is "${existing.status}". Skipping.`);
                } else {
                    console.warn(`⚠️ Payment received with memo "${memo}" but no matching order found at all.`);
                }
            }
        }

        return res.status(200).json({ success: true, message: "Webhook processed successfully." });

    } catch (error) {
        console.error('❌ CRITICAL PYUSD WEBHOOK ERROR:', error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}
