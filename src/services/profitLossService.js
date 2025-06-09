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
      time: doc.data().created // Use 'created' for deposits
    }));

    // Fetch cashouts from 'cashouts' collection
    // IMPORTANT CHANGE HERE: 'profitLoss' changed to 'cashouts'
    const cashoutSnap = await db.collection('cashouts').get(); // Assuming all documents in 'cashouts' are cashouts
    const cashoutList = cashoutSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'cashout',
      time: doc.data().time || doc.data().created // Use 'time' or fallback to 'created'
    }));

    const combined = [...depositList, ...cashoutList].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));
    return combined;
  } catch (err) {
    console.error('Error fetching profit/loss data:', err);
    throw new Error('Failed to retrieve financial data from the server.');
  }
};

// ... (rest of your addCashout function remains the same)