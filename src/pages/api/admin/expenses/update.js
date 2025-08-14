// File: src/pages/api/admin/expenses/update.js
// Description: API endpoint to update an existing expense.

import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
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
    
    const { id, date, category, amount, description, currency, isFinalized } = Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
    );
    const { receipt } = files;

    if (!id) {
      return res.status(400).json({ message: 'Expense ID is required for an update.' });
    }

    let receiptUrl = null;
    if (receipt && receipt[0]) {
        const uploadResult = await cloudinary.uploader.upload(receipt[0].filepath, {
            folder: 'main_expense_receipts',
            resource_type: "auto"
        });
        receiptUrl = uploadResult.secure_url;
        fs.unlinkSync(receipt[0].filepath);
    }
    
    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (category) updateData.category = category;
    if (amount) updateData.amount = parseFloat(amount);
    if (description) updateData.description = description;
    if (currency) updateData.currency = currency;
    if (isFinalized !== undefined) updateData.isFinalized = (isFinalized === 'true');
    if (receiptUrl) updateData.receiptUrl = receiptUrl;

    const expenseRef = db.collection('expenses').doc(id);
    await expenseRef.update(updateData);
    
    res.status(200).json({ success: true, message: 'Expense updated successfully.' });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ message: `Failed to update expense: ${error.message}` });
  }
};

export default withAuth(handler);