// src/pages/api/pyusd/check-status.js
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ message: 'Missing order ID' });
    }

    try {
        // FIX: The collection name is now 'orders' to match where the data is saved.
        const orderRef = db.collection('orders').doc(id);
        const doc = await orderRef.get();

        if (!doc.exists) {
            // This is expected if the ID is wrong, but the API itself will now be found.
            return res.status(404).json({ message: 'Order not found.' });
        }

        const data = doc.data();
        // The frontend polling will see this status and react accordingly.
        return res.status(200).json({ status: data.status });

    } catch (err) {
        console.error(`Error checking PYUSD status for order ${id}:`, err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}