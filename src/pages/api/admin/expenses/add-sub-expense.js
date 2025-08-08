// src/pages/api/admin/expenses/add-sub-expense.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import fs from 'fs';

// Configure Cloudinary with your credentials from environment variables
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = formidable({});
  
  try {
    const [fields, files] = await form.parse(req);

    const { mainExpenseId, date, amount, description } = fields;
    const { receipt } = files;

    if (!mainExpenseId || !date || !amount || !description || !receipt) {
      return res.status(400).json({ message: 'Missing required fields or receipt file.' });
    }

    const expenseAmount = parseFloat(amount[0]);
    const receiptFile = receipt[0];

    // 1. Upload the file to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(receiptFile.filepath, {
        folder: `receipts/${mainExpenseId[0]}`, // Organize uploads in folders
        resource_type: "auto"
    });

    // Clean up the temporary file created by formidable
    fs.unlinkSync(receiptFile.filepath);

    if (!uploadResult.secure_url) {
        throw new Error("File upload to Cloudinary failed.");
    }

    // 2. Save the sub-expense data to Firestore
    const subExpenseRef = db.collection('subExpenses').doc();
    
    await subExpenseRef.set({
        id: subExpenseRef.id,
        mainExpenseId: mainExpenseId[0],
        date: new Date(date[0]),
        amount: expenseAmount,
        description: description[0],
        receiptUrl: uploadResult.secure_url,
        recordedBy: req.decodedToken.email,
        createdAt: Timestamp.now(),
    });

    res.status(201).json({ success: true, message: 'Sub-expense added successfully.' });

  } catch (error) {
    console.error('Error adding sub-expense:', error);
    res.status(500).json({ message: `Failed to add sub-expense: ${error.message}` });
  }
};

export default withAuth(handler);