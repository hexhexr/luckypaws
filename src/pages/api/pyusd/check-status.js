import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair } from '@solana/web3.js';
import { decrypt, sweepTokens, checkPyusdBalance } from '../../../lib/pyusd-helpers';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const ENCRYPTION_KEY = process.env.PYUSD_ENCRYPTION_KEY;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ message: 'Missing order ID' });
    }

    try {
        const orderRef = db.collection('orders').doc(id);
        const docSnap = await orderRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const orderData = docSnap.data();

        // If status is already processed, just return it.
        if (orderData.status !== 'pending') {
            return res.status(200).json({ status: orderData.status });
        }

        // --- Proactive Blockchain Check ---
        const expectedAmount = orderData.amount;
        const actualBalance = await checkPyusdBalance(connection, orderData.depositAddress);

        if (actualBalance >= expectedAmount) {
            console.log(`POLLING: Detected payment for order ${id}. Balance: ${actualBalance}`);
            
            // Payment detected! Process it now.
            await orderRef.update({
                status: 'paid',
                paidAt: Timestamp.now(),
                // You can add a note that this was confirmed via polling
                confirmationMethod: 'polling'
            });
            console.log(`POLLING: Order ${id} status updated to 'paid'.`);

            // Use a try/catch block for the sweep so the frontend doesn't hang on failure
            try {
                await orderRef.update({ status: 'sweeping' });
                const decryptedSecret = decrypt(orderData._privateKey, ENCRYPTION_KEY);
                const secretKeyArray = new Uint8Array(JSON.parse(decryptedSecret));
                const depositWalletKeypair = Keypair.fromSecretKey(secretKeyArray);
                
                // Sweep the exact balance found, not just the expected amount
                const sweepAmount = actualBalance * (10 ** 6); 
                const sweepSignature = await sweepTokens(connection, depositWalletKeypair, sweepAmount);
                
                await orderRef.update({
                    sweepSignature: sweepSignature,
                    status: 'completed'
                });
                console.log(`POLLING: Order ${id} status updated to 'completed'.`);
            } catch (sweepError) {
                console.error(`POLLING: CRITICAL SWEEP ERROR for order ${id}:`, sweepError);
                await orderRef.update({
                    status: 'sweep_failed',
                    failureReason: sweepError.message || 'Unknown sweep error.'
                });
            }
            
            // Return the latest status
            const finalDoc = await orderRef.get();
            return res.status(200).json({ status: finalDoc.data().status });

        } else {
            // No payment detected yet, return current pending status
            return res.status(200).json({ status: orderData.status });
        }

    } catch (err) {
        console.error(`Error checking PYUSD status for order ${id}:`, err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}