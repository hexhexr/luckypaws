import { db } from '../../../lib/firebaseAdmin';
import { Connection, PublicKey } from '@solana/web3.js';
import { checkPyusdBalance, processPyusdPayment, PYUSD_MINT_ADDRESS } from './pyusd-helpers';
import { getAssociatedTokenAddress } from '@solana/spl-token';

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

        const depositAddress = orderData.depositAddress;
        
        // --- NEW DIAGNOSTIC REPORT ---
        console.log("================ DIAGNOSTIC REPORT ================");
        console.log("Polling for Order ID:", id);
        console.log("1. RPC URL being used by server:", SOLANA_RPC_URL);
        console.log("2. MINT ADDRESS being used by server:", process.env.DEVNET_PYUSD_MINT_ADDRESS);
        
        try {
            const owner = new PublicKey(depositAddress);
            const ata = await getAssociatedTokenAddress(PYUSD_MINT_ADDRESS, owner);
            console.log("3. Derived Associated Token Account (ATA):", ata.toBase58());
        } catch (e) {
            console.log("3. Could not derive ATA. Error:", e.message);
        }
        console.log("=================================================");
        // --- END OF REPORT ---

        const expectedAmount = orderData.amount;
        const actualBalance = await checkPyusdBalance(connection, depositAddress);

        console.log(`[Polling Check] Balance found on-chain for ${depositAddress}: ${actualBalance}`);

        if (actualBalance >= expectedAmount) {
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