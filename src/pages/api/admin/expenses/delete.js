// File: src/pages/api/admin/expenses/delete.js
// Description: API endpoint to delete an expense. Reverses partner ledger entries if applicable.

import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { FieldValue } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Expense ID is required.' });
  }

  const expenseRef = db.collection('expenses').doc(id);

  try {
    await db.runTransaction(async (transaction) => {
      const expenseDoc = await transaction.get(expenseRef);
      if (!expenseDoc.exists) {
        throw new Error("Expense not found.");
      }

      const expenseData = expenseDoc.data();
      const { paidByPartnerId, amount } = expenseData;

      if (paidByPartnerId) {
        const partnerRef = db.collection('partners').doc(paidByPartnerId);
        const ledgerQuery = db.collection('partnerLedger').where('relatedExpenseId', '==', id).limit(1);
        const ledgerSnapshot = await transaction.get(ledgerQuery);
        
        transaction.update(partnerRef, {
          totalInvestment: FieldValue.increment(parseFloat(amount))
        });

        if (!ledgerSnapshot.empty) {
          const ledgerDocRef = ledgerSnapshot.docs[0].ref;
          transaction.delete(ledgerDocRef);
        }
      }

      transaction.delete(expenseRef);
    });

    res.status(200).json({ success: true, message: 'Expense deleted successfully and partner ledger updated if applicable.' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: `Failed to delete expense: ${error.message}` });
  }
};

export default withAuth(handler);
