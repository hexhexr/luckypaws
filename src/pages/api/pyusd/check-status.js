import { db } from '../../../lib/firebaseAdmin';
import { Connection } from '@solana/web3.js';
import { checkPyusdBalance, processPyusdPayment } from './pyusd-helpers';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
const PYUSD_MINT_ADDRESS = process.env.DEVNET_PYUSD_MINT_ADDRESS;
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'A valid order ID is required.' });
    }

    try {
        const orderRef = db.collection('orders').doc(id);
        const docSnap = await orderRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        
        const orderData = docSnap.data();
        if (orderData.status !== 'pending') {
            return res.status(200).json({ status: orderData.status });
        }

        const actualBalance = await checkPyusdBalance(connection, orderData.depositAddress, PYUSD_MINT_ADDRESS);
        
        if (actualBalance >= orderData.amount) {
            await processPyusdPayment(connection, orderRef, actualBalance, PYUSD_MINT_ADDRESS, 'polling', 'N/A (Polling)');
            const finalDoc = await orderRef.get();
            return res.status(200).json({ status: finalDoc.data().status });
        } else {
            return res.status(200).json({ status: 'pending' });
        }
    } catch (err) {
        console.error(`Error in /api/pyusd/check-status for order ${id}:`, err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}