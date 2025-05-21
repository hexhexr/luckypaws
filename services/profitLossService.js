// services/profitLossService.js
// This file should be created in your project at `services/profitLossService.js`
import { db } from '../lib/firebaseClient'; // Assuming firebaseClient is correctly configured

// Function to fetch all profit/loss related data (deposits and cashouts)
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

    // Fetch cashouts from 'profitLoss' collection with type 'cashout'
    const cashoutSnap = await db.collection('profitLoss').where('type', '==', 'cashout').get();
    const cashoutList = cashoutSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'cashout',
      time: doc.data().time || doc.data().created // Use 'time' or fallback to 'created'
    }));

    // Combine and sort by time/created for consistent processing
    const combined = [...depositList, ...cashoutList].sort((a, b) => new Date(b.time || b.created) - new Date(a.time || a.created));
    return combined;
  } catch (err) {
    console.error('Error fetching profit/loss data:', err);
    // Provide a user-friendly error message
    throw new Error('Failed to retrieve financial data from the server.');
  }
};

// Function to add a new cashout transaction
export const addCashout = async (username, amount) => {
  try {
    const res = await fetch('/api/admin/cashouts/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, amount }),
    });

    const data = await res.json();
    if (!res.ok) {
      // Propagate specific error message from API if available
      throw new Error(data.message || 'Failed to add cashout due to a server error.');
    }
    return data; // Return success data if needed
  } catch (err) {
    console.error('Error adding cashout:', err);
    // Provide a user-friendly error message
    throw new Error(`Failed to add cashout: ${err.message}`);
  }
};