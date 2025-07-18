// File: src/pages/api/admin/expenses/add.js
// Description: API endpoint to add a new expense. Handles currency and updates partner ledgers.

import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { date, category, amount, description, paidByPartnerId, currency } = req.body;

  if (!date || !category || !amount || !description || !currency) {
    return res.status(400).json({ message: 'Missing required expense fields, including currency.' });
  }
  
  const loggedInUserEmail = req.decodedToken.email;
  const expenseAmount = parseFloat(amount);

  try {
    const expenseData = {
        date: new Date(date),
        category,
        amount: expenseAmount,
        currency, // Save the currency
        description,
        recordedBy: loggedInUserEmail,
        createdAt: Timestamp.now(),
    };

    if (paidByPartnerId) {
        // Transaction: This expense is paid by a partner
        const partnerRef = db.collection('partners').doc(paidByPartnerId);
        const expenseRef = db.collection('expenses').doc();
        const ledgerRef = db.collection('partnerLedger').doc();

        await db.runTransaction(async (transaction) => {
            const partnerDoc = await transaction.get(partnerRef);
            if (!partnerDoc.exists) {
                throw new Error("Partner not found.");
            }
            const partnerName = partnerDoc.data().name;

            // 1. Create the expense record with partner info
            transaction.set(expenseRef, {
                ...expenseData,
                paidByPartnerId,
                paidByPartnerName: partnerName,
            });

            // 2. Add a record to the partner's ledger
            transaction.set(ledgerRef, {
                partnerId: paidByPartnerId,
                amount: -expenseAmount, // Negative amount for an expense
                currency,
                type: 'expense',
                description: `Expense: ${description}`,
                transactionDate: new Date(date),
                relatedExpenseId: expenseRef.id
            });

            // 3. Atomically decrement the partner's total investment
            transaction.update(partnerRef, {
                totalInvestment: FieldValue.increment(-expenseAmount)
            });
        });

    } else {
        // Standard expense paid by the office
        const expenseRef = db.collection('expenses').doc();
        await expenseRef.set({
            ...expenseData,
            paidByPartnerId: null,
        });
    }

    res.status(201).json({ success: true, message: 'Expense added successfully' });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: `Failed to add expense: ${error.message}` });
  }
};

export default withAuth(handler);
