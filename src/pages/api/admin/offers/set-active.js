// src/pages/api/admin/offers/set-active.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ message: 'Offer ID is required.' });
  }

  try {
    const offersRef = db.collection('offers');
    const batch = db.batch();

    // Deactivate all other offers
    const snapshot = await offersRef.where('active', '==', true).get();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { active: false });
    });

    // Activate the selected offer
    const offerToActivateRef = offersRef.doc(id);
    batch.update(offerToActivateRef, { active: true });

    await batch.commit();
    res.status(200).json({ success: true, message: 'Offer activated successfully.' });
  } catch (error) {
    console.error('Error setting active offer:', error);
    res.status(500).json({ message: 'Failed to set active offer.' });
  }
};

export default withAuth(handler);