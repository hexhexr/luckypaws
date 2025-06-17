import { db } from '../../../lib/firebaseAdmin';
import { Connection } from '@solana/web3.js';
import { checkPyusdBalance, processPyusdPayment } from './pyusd-helpers';

// --- CONFIGURATION (DEVNET ONLY) ---
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ message: 'Missing order ID' });

    try {
        const orderRef = db.collection('orders').doc(id);
        const docSnap = await orderRef.get();
        if (!docSnap.exists) return res.status(404).json({ message: 'Order not found.' });
        
        const orderData = docSnap.data();
        if (orderData.status !== 'pending') return res.status(200).json({ status: orderData.status });

        const expectedAmount = orderData.amount;
        const actualBalance = await checkPyusdBalance(connection, orderData.depositAddress);

        if (actualBalance >= expectedAmount) {
            // Balance detected, call the centralized processing function
            await processPyusdPayment(connection, orderRef, actualBalance, 'polling', 'N/A (Polling)');
            const finalDoc = await orderRef.get();
            return res.status(200).json({ status: finalDoc.data().status });
        } else {
            return res.status(200).json({ status: 'pending' });
        }

    } catch (err) {
        console.error(`Error checking PYUSD status for order ${id}:`, err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}