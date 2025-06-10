// services/profitLossService.js
import { db } from '../lib/firebaseClient';

export const fetchProfitLossData = async () => {
  try {
    // Fetch paid orders (deposits)
    const orderSnap = await db.collection('orders').where('status', '==', 'paid').get();
    const depositList = orderSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'deposit',
      // Convert Firestore Timestamp to ISO string if it's a Timestamp object
      time: doc.data().created?.toDate ? doc.data().created.toDate().toISOString() : doc.data().created
    }));

    // Fetch cashouts from 'cashouts' collection
    const cashoutSnap = await db.collection('cashouts').get(); // Assuming all documents in 'cashouts' are cashouts
    const cashoutList = cashoutSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'cashout',
      // Convert Firestore Timestamp to ISO string for cashouts as well
      time: doc.data().time?.toDate ? doc.data().time.toDate().toISOString() : (doc.data().created?.toDate ? doc.data().created.toDate().toISOString() : doc.data().time || doc.data().created)
    }));

    // Sort by time. Ensure time is consistently a parsable date string or Date object.
    const combined = [...depositList, ...cashoutList].sort((a, b) => new Date(b.time) - new Date(a.time));
    return combined;
  } catch (err) {
    console.error('Error fetching profit/loss data:', err);
    throw new Error('Failed to retrieve financial data from the server.');
  }
};