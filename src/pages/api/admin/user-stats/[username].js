// src/pages/api/admin/user-stats/[username].js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    try {
        const depositsQuery = db.collection('orders').where('username', '==', username).where('status', 'in', ['paid', 'completed']);
        const cashoutsQuery = db.collection('cashouts').where('username', '==', username).where('status', '==', 'completed');

        const [depositsSnap, cashoutsSnap] = await Promise.all([
            depositsQuery.get(),
            cashoutsQuery.get()
        ]);

        const totalDeposits = depositsSnap.docs.reduce((sum, doc) => sum + parseFloat(doc.data().amount || 0), 0);
        const totalCashouts = cashoutsSnap.docs.reduce((sum, doc) => sum + parseFloat(doc.data().amountUSD || 0), 0);
        const net = totalDeposits - totalCashouts;

        res.status(200).json({
            username,
            totalDeposits,
            totalCashouts,
            net
        });

    } catch (error) {
        console.error(`Error fetching stats for ${username}:`, error);
        res.status(500).json({ message: 'Failed to fetch user stats.' });
    }
};

export default withAuth(handler);