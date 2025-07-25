// src/pages/api/offers/active.js
import { db } from '../../../lib/firebaseAdmin';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const snapshot = await db.collection('offers').where('active', '==', true).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(200).json({ offer: null });
    }

    const offer = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    res.status(200).json({ offer });

  } catch (error) {
    console.error('Error fetching active offer:', error);
    res.status(500).json({ message: 'Failed to fetch active offer.' });
  }
};

export default handler;