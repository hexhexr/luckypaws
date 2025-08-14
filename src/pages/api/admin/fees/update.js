// src/pages/api/admin/fees/update.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { chimeFee, cashAppFee } = req.body;

  const parsedChimeFee = parseFloat(chimeFee);
  const parsedCashAppFee = parseFloat(cashAppFee);

  if (isNaN(parsedChimeFee) || isNaN(parsedCashAppFee)) {
    return res.status(400).json({ message: 'Fee percentages must be valid numbers.' });
  }

  try {
    const settingsRef = db.collection('settings').doc('paymentFees');
    
    // THE FIX: Changed from .set() to .update() for more reliable updates.
    await settingsRef.update({
      chimeFee: parsedChimeFee,
      cashAppFee: parsedCashAppFee,
      lastUpdated: new Date().toISOString(),
    });

    res.status(200).json({ success: true, message: 'Fee percentages updated successfully.' });
  } catch (error) {
    console.error('Error updating fees:', error);
    // If the document doesn't exist, create it.
    if (error.code === 5) { // Firestore 'NOT_FOUND' error code
        await db.collection('settings').doc('paymentFees').set({
            chimeFee: parsedChimeFee,
            cashAppFee: parsedCashAppFee,
            lastUpdated: new Date().toISOString(),
        });
        return res.status(200).json({ success: true, message: 'Fee settings created and saved successfully.' });
    }
    res.status(500).json({ message: 'Failed to update fees.' });
  }
};

export default withAuth(handler);