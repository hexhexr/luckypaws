import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { Connection, Keypair } from '@solana/web3.js';
import { decrypt, sweepTokens, PYUSD_MINT_ADDRESS } from './pyusd-helpers';

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
        
        console.log(`POLLING: Checking order ${id}. Current status: ${orderData.status}`);

        if (orderData.status !== 'pending') {
            return res.status(200).json({ status: orderData.status });
        }

        const expectedAmount = orderData.amount;
        const actualBalance = await checkPyusdBalance(connection, orderData.depositAddress);

        console.log(`POLLING: For order ${id}, Expected Amount: ${expectedAmount}, Found Balance: ${actualBalance}`);

        if (actualBalance >= expectedAmount) {
            console.log(`POLLING: Detected sufficient balance for order ${id}. Processing payment.`);
            
            await orderRef.update({ status: 'paid', paidAt: Timestamp.now(), confirmationMethod: 'polling' });
            
            try {
                // ... your sweep logic ...
                console.log(`POLLING: Order ${id} processed successfully.`);
            } catch (sweepError) {
                console.error(`POLLING: CRITICAL SWEEP ERROR for order ${id}:`, sweepError);
                await orderRef.update({ status: 'sweep_failed', failureReason: sweepError.message || 'Unknown sweep error.' });
            }
            
            const finalDoc = await orderRef.get();
            return res.status(200).json({ status: finalDoc.data().status });
        } else {
            console.log(`POLLING: Balance for order ${id} is not sufficient yet.`);
            return res.status(200).json({ status: 'pending' });
        }

    } catch (err) {
        console.error(`POLLING: Error checking PYUSD status for order ${id}:`, err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}