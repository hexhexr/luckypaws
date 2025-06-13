// services/profitLossService.js
import { db } from '../lib/firebaseClient';
import { collection, getDocs, query, where } from 'firebase/firestore';

export const fetchProfitLossData = async () => {
  try {
    // Fetch paid orders (deposits)
    const orderQuery = query(collection(db, 'orders'), where('status', '==', 'paid'));
    const orderSnap = await getDocs(orderQuery);
    const depositList = orderSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'deposit',
      time: doc.data().created?.toDate ? doc.data().created.toDate().toISOString() : doc.data().created
    }));

    // Fetch cashouts from 'cashouts' collection
    const cashoutQuery = query(collection(db, 'cashouts'));
    const cashoutSnap = await getDocs(cashoutQuery);
    const cashoutList = cashoutSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'cashout',
      time: doc.data().time?.toDate ? doc.data().time.toDate().toISOString() : doc.data().time
    }));

    // Combine and sort by time
    const combined = [...depositList, ...cashoutList].sort((a, b) => new Date(b.time) - new Date(a.time));
    return combined;
  } catch (err) {
    console.error('Error fetching profit/loss data:', err);
    throw new Error('Failed to retrieve financial data from the server.');
  }
};