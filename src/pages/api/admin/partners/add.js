// src/pages/api/admin/partners/add.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Partner name is required.' });
  }
  
  try {
    const partnerRef = db.collection('partners').doc();
    
    await partnerRef.set({
      id: partnerRef.id,
      name: name,
      totalInvestment: 0,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ success: true, message: 'Partner added successfully', id: partnerRef.id });
  } catch (error) {
    console.error('Error adding partner:', error);
    res.status(500).json({ message: 'Failed to add partner' });
  }
};

export default withAuth(handler);