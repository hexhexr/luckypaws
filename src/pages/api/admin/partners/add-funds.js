// src/pages/api/admin/partners/add-funds.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { partnerId, amount } = req.body;
  const investmentAmount = parseFloat(amount);

  if (!partnerId || !investmentAmount || investmentAmount <= 0) {
    return res.status(400).json({ message: 'Partner ID and a valid positive amount are required.' });
  }

  const partnerRef = db.collection('partners').doc(partnerId);
  const ledgerRef = db.collection('partnerLedger').doc();
  
  try {
    await db.runTransaction(async (transaction) => {
        // 1. Add a record to the ledger for this transaction
        transaction.set(ledgerRef, {
            partnerId: partnerId,
            amount: investmentAmount,
            type: 'investment',
            description: 'Manual fund deposit',
            transactionDate: Timestamp.now()
        });

        // 2. Atomically update the partner's total investment
        transaction.update(partnerRef, {
            totalInvestment: FieldValue.increment(investmentAmount)
        });
    });

    res.status(200).json({ success: true, message: 'Funds added successfully.' });
  } catch (error) {
    console.error('Error adding funds:', error);
    res.status(500).json({ message: 'Failed to add funds.' });
  }
};

export default withAuth(handler);