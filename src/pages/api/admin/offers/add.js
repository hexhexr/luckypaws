// src/pages/api/admin/offers/add.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Offer text cannot be empty.' });
  }

  try {
    await db.collection('offers').add({
      text,
      active: false,
      createdAt: Timestamp.now(),
    });
    res.status(201).json({ success: true, message: 'Offer added successfully.' });
  } catch (error) {
    console.error('Error adding offer:', error);
    res.status(500).json({ message: 'Failed to add offer.' });
  }
};

export default withAuth(handler);