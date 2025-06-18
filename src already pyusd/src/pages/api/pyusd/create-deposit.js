// File: src/pages/api/pyusd/create-deposit.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_WEBHOOK_ID = SOLANA_NETWORK === 'devnet' ? process.env.HELIUS_DEVNET_WEBHOOK_ID : process.env.HELIUS_MAINNET_WEBHOOK_ID;
const MAIN_WALLET_PRIVATE_KEY_STRING_B58 = process.env.MAIN_WALLET_PRIVATE_KEY;
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function addAddressToWebhook(newAddress) {
    if (!HELIUS_WEBHOOK_ID || !HELIUS_API_KEY) throw new Error("Helius not configured.");
    const url = `https://api.helius.xyz/v0/webhooks/${HELIUS_WEBHOOK_ID}?api-key=${HELIUS_API_KEY}`;
    const getResponse = await fetch(url);
    if (!getResponse.ok) throw new Error(`Failed to fetch webhook. Status: ${getResponse.status}`);
    const webhookData = await getResponse.json();
    let existingAddresses = webhookData.accountAddresses || [];
    if (!existingAddresses.includes(newAddress)) {
        existingAddresses.push(newAddress);
    }
    const updatePayload = {
        webhookURL: webhookData.webhookURL,
        transactionTypes: webhookData.transactionTypes,
        accountAddresses: existingAddresses,
        webhookType: webhookData.webhookType,
        authHeader: webhookData.authHeader,
    };
    const updateResponse = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatePayload) });
    if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Helius API Error: ${errorData.message || 'Failed to update webhook'}`);
    }
    console.log(`Successfully updated webhook with: ${newAddress}`);
}

async function createAndFundAccountForRent(payer, newAccount) {
    const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(0);
    const amountForFees = 50000;
    const totalLamports = rentExemptionAmount + amountForFees;
    const transaction = new Transaction().add(
        SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: newAccount.publicKey, lamports: totalLamports, space: 0, programId: SystemProgram.programId })
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, newAccount]);
    console.log(`Created/funded address ${newAccount.publicKey.toBase58()}`);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    try {
        const { username, game, amount } = req.body;
        if (!username || !game || !amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ message: 'Missing fields.' });
        }
        const newDepositWallet = Keypair.generate();
        const publicKey = newDepositWallet.publicKey.toBase58();
        const serializedSecretKey = JSON.stringify(Array.from(newDepositWallet.secretKey));
        const mainWalletKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY_STRING_B58));
        await createAndFundAccountForRent(mainWalletKeypair, newDepositWallet);
        await addAddressToWebhook(publicKey);
        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            orderId: orderRef.id,
            username,
            game,
            amount: parseFloat(amount),
            status: 'pending',
            method: 'pyusd',
            depositAddress: publicKey,
            _privateKey: serializedSecretKey,
            created: Timestamp.now(),
            network: SOLANA_NETWORK,
            read: false,
        });
        res.status(200).json({ depositId: orderRef.id, depositAddress: publicKey });
    } catch (error) {
        console.error('Create Deposit API Error:', error.message);
        res.status(500).json({ message: 'Failed to create deposit.' });
    }
}

// File: src/pages/api/pyusd/webhook.js
import { db } from '../../../lib/firebaseAdmin';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';

const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const MAIN_WALLET_PUBLIC_KEY = new PublicKey(process.env.MAIN_WALLET_PUBLIC_KEY);
const HELIUS_AUTH_SECRET = SOLANA_NETWORK === 'devnet' ? process.env.HELIUS_DEVNET_AUTH_SECRET : process.env.HELIUS_MAINNET_AUTH_SECRET;
const PYUSD_MINT_ADDRESS = new PublicKey(SOLANA_NETWORK === 'devnet' ? 'CpMah17kQEL2wqyMKt3mZBdWrNFV4SjXMYKleg9gOa2n' : '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo');
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sweepTokens(depositWallet, amount) {
    try {
        const fromAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, depositWallet.publicKey);
        const toAta = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, MAIN_WALLET_PUBLIC_KEY);
        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new Transaction({ feePayer: depositWallet.publicKey, recentBlockhash: blockhash }).add(
            createTransferInstruction(fromAta, toAta, depositWallet.publicKey, amount)
        );
        transaction.sign(depositWallet);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        console.log(`Sweep successful! Signature: ${signature}`);
        return signature;
    } catch (error) {
        console.error('Sweep Error:', error);
        throw new Error('Failed to sweep funds.');
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    try {
        if (req.headers['authorization'] !== HELIUS_AUTH_SECRET) return res.status(401).json({ message: "Unauthorized." });
        const transactions = req.body;
        for (const tx of transactions) {
            if (tx.type === "TOKEN_TRANSFER" && !tx.transaction.error) {
                const depositAddress = tx.tokenTransfers[0].toUserAccount;
                let orderDoc = null;
                for (let i = 0; i < 3; i++) {
                    const snapshot = await db.collection('orders').where('depositAddress', '==', depositAddress).where('status', '==', 'pending').get();
                    if (!snapshot.empty) {
                        orderDoc = snapshot.docs[0];
                        break;
                    }
                    await sleep(2000);
                }
                if (!orderDoc) continue;
                const orderData = orderDoc.data();
                const amountTransferred = tx.tokenTransfers[0].tokenAmount * (10 ** 6);
                await orderDoc.ref.update({ status: 'paid', paidAt: Timestamp.now(), transactionSignature: tx.signature });
                const secretKeyArray = new Uint8Array(JSON.parse(orderData._privateKey));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                const sweepSignature = await sweepTokens(depositWalletKeypair, amountTransferred);
                await orderDoc.ref.update({ sweepSignature });
            }
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ message: "Internal server error." });
    }
}

// File: src/pages/api/pyusd/check-status.js
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: 'Missing order ID' });
    try {
        const doc = await db.collection('orders').doc(id).get();
        if (!doc.exists) return res.status(404).json({ message: 'Order not found.' });
        res.status(200).json({ status: doc.data().status });
    } catch (err) {
        console.error(`Check Status Error for order ${id}:`, err);
        res.status(500).json({ message: 'Internal server error.' });
    }
}
