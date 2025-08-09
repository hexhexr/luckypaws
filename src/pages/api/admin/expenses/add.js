// File: src/pages/api/admin/expenses/add.js
// Description: API endpoint to add a new expense. Handles currency, partner ledgers, and optional receipt uploads.

import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export const config = {
  api: { bodyParser: false },
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const form = formidable({});
  
  try {
    const [fields, files] = await form.parse(req);

    const { date, category, amount, description, paidByPartnerId, currency } = Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
    );
    const { receipt } = files;

    if (!date || !category || !amount || !description || !currency) {
      return res.status(400).json({ message: 'Missing required expense fields.' });
    }
    
    const loggedInUserEmail = req.decodedToken.email;
    const expenseAmount = parseFloat(amount);
    let receiptUrl = null;

    if (receipt && receipt[0]) {
        const uploadResult = await cloudinary.uploader.upload(receipt[0].filepath, {
            folder: 'main_expense_receipts',
            resource_type: "auto"
        });
        receiptUrl = uploadResult.secure_url;
        fs.unlinkSync(receipt[0].filepath);
    }

    const expenseData = {
        date: new Date(date),
        category,
        amount: expenseAmount,
        currency,
        description,
        receiptUrl, // Add receipt URL to data
        recordedBy: loggedInUserEmail,
        createdAt: Timestamp.now(),
    };

    if (paidByPartnerId) {
        const partnerRef = db.collection('partners').doc(paidByPartnerId);
        const expenseRef = db.collection('expenses').doc();
        const ledgerRef = db.collection('partnerLedger').doc();

        await db.runTransaction(async (transaction) => {
            const partnerDoc = await transaction.get(partnerRef);
            if (!partnerDoc.exists) throw new Error("Partner not found.");
            
            transaction.set(expenseRef, {
                ...expenseData,
                paidByPartnerId,
                paidByPartnerName: partnerDoc.data().name,
            });
            transaction.set(ledgerRef, {
                partnerId: paidByPartnerId, amount: -expenseAmount, currency, type: 'expense',
                description: `Expense: ${description}`, transactionDate: new Date(date), relatedExpenseId: expenseRef.id
            });
            transaction.update(partnerRef, { totalInvestment: FieldValue.increment(-expenseAmount) });
        });

    } else {
        await db.collection('expenses').add({ ...expenseData, paidByPartnerId: null });
    }

    res.status(201).json({ success: true, message: 'Expense added successfully' });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: `Failed to add expense: ${error.message}` });
  }
};

export default withAuth(handler);