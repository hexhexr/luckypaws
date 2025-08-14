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
    
    // THE DEFINITIVE FIX: Using .set() with the { merge: true } option is the most
    // robust way to handle this. It will create the document if it doesn't exist,
    // or update it if it does, preventing the error you were seeing.
    await settingsRef.set({
      chimeFee: parsedChimeFee,
      cashAppFee: parsedCashAppFee,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    res.status(200).json({ success: true, message: 'Fee percentages updated successfully.' });
  } catch (error) {
    console.error('Error updating fees:', error);
    res.status(500).json({ message: 'Failed to update fees.' });
  }
};

export default withAuth(handler);