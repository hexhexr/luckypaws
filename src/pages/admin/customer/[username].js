import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { db, auth as firebaseAuth } from '../../../lib/firebaseClient'; // Import auth
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function CustomerProfile() {
  const router = useRouter();
  const { username } = router.query;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true); // Combined loading for auth and data
  const [authLoading, setAuthLoading] = useState(true); // Separate loading for auth
  const [dataLoading, setDataLoading] = useState(false); // Loading for data fetching
  const [error, setError] = useState('');
  const [totals, setTotals] = useState({ usd: 0, btc: 0 });

  // Authentication check using onAuthStateChanged
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(user => {
      if (!user) {
        // No user is signed in, redirect to admin login
        router.replace('/admin/login');
      } else {
        // User is signed in
        setAuthLoading(false); // Auth check complete
      }
    });

    return () => unsubscribe(); // Cleanup the listener
  }, [router]);

  // Load only paid orders for this user from Firebase
  const loadUserData = useCallback(async () => {
    if (!username || authLoading) return; // Only load if username is available and auth is done

    setDataLoading(true);
    setError('');
    try {
      // Ensure db is initialized before trying to use it
      if (!db) {
        console.error("Firestore DB not initialized.");
        setError('⚠️ Database not available. Please check Firebase configuration.');
        return;
      }
      const ordersCollectionRef = collection(db, 'orders');
      const q = query(
        ordersCollectionRef,
        where('username', '==', username),
        where('status', '==', 'paid'),
        orderBy('created', 'desc') // Order by creation date for consistency
      );
      const snap = await getDocs(q);

      const userOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const usd = userOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
      const btc = userOrders.reduce((sum, o) => sum + Number(o.btc || 0), 0);

      setOrders(userOrders);
      setTotals({ usd, btc });
    } catch (err) {
      console.error("Error loading user data:", err);
      setError(`⚠️ Failed to load customer data: ${err.message || 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  }, [username, authLoading]); // Add authLoading as a dependency

  useEffect(() => {
    setLoading(authLoading || dataLoading); // Overall loading state
  }, [authLoading, dataLoading]);

  // Trigger data load when username or auth status changes
  useEffect(() => {
    if (username && !authLoading) {
      loadUserData();
    }
  }, [username, authLoading, loadUserData]);

  if (loading) {
    return (
      <div className="ml-72 p-4 text-center">
        <p>Loading customer profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ml-72 p-4">
        <p className="text-red-600">{error}</p>
        <button className="btn btn-secondary mt-md" onClick={() => router.back()}>
          Back
        </button>
      </div>
    );
  }

  if (!username) {
    // This case should ideally be handled by router.replace if username is not present
    // but acts as a fallback.
    return (
      <div className="ml-72 p-4">
        <p className="text-red-600">No username provided.</p>
        <button className="btn btn-secondary mt-md" onClick={() => router.back()}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="ml-72 p-4">
      <div className="card">
        <h1 className="card-header text-2xl font-bold">Customer: {username}</h1>
        <div className="card-body">
          <div className="flex justify-around items-center mb-6 p-4 bg-gray-100 rounded-lg shadow-sm">
            <div className="text-center">
              <p className="text-lg font-semibold text-green-600">Total Deposits (USD)</p>
              <p className="text-2xl font-bold">${totals.usd.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-600">Total Deposits (BTC)</p>
              <p className="text-2xl font-bold">{totals.btc.toFixed(8)}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-3">Paid Orders</h2>
          {orders.length === 0 ? (
            <p className="text-gray-600">No paid orders found for this user.</p>
          ) : (
            <div className="table-responsive mt-md">
              <table className="table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Amount</th>
                    <th>BTC</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id || `${o.username}-${o.created}`}>
                      <td>{o.game || 'N/A'}</td>
                      <td>${Number(o.amount || 0).toFixed(2)}</td>
                      <td>{Number(o.btc || 0).toFixed(8)}</td>
                      <td className={
                        o.status === 'paid' ? 'status-paid' :
                        o.status === 'pending' ? 'status-pending' : 'status-cancelled'
                      }>
                        {o.status || 'unknown'}
                      </td>
                      <td>{o.created ? new Date(o.created).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-center mt-xl">
            <button className="btn btn-secondary" onClick={() => router.back()}>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}