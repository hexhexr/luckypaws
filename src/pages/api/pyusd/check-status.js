// src/pages/api/pyusd/check-status.js
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ message: 'Missing deposit ID' });
    }

    try {
        const depositRef = db.collection('pyusd_deposits').doc(id);
        const doc = await depositRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'Deposit not found.' });
        }

        const data = doc.data();
        return res.status(200).json({ status: data.status });

    } catch (err) {
        console.error(`Error checking PYUSD status for ${id}:`, err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
}