import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { db } from '../../../lib/firebaseClient'; // ✅ Ensure correct path

export default function CustomerProfile() {
  const router = useRouter();
  const { username } = router.query;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ usd: 0, btc: 0 });

  // 🔐 Auth check
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  // ✅ Load only paid orders for this user from Firebase
  const loadUserData = useCallback(async () => {
    if (!username) return;

    setLoading(true);
    try {
      const snap = await db
        .collection('orders')
        .where('username', '==', username)
        .where('status', '==', 'paid')
        .get();

      const userOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const usd = userOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
      const btc = userOrders.reduce((sum, o) => sum + Number(o.btc || 0), 0);

      setOrders(userOrders);
      setTotals({ usd, btc });
    } catch (err) {
      console.error('Error loading user orders:', err);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem('admin_auth');
      router.replace('/admin');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>

      <div className="main-content">
        <h2 className="section-title">Customer Profile: {username}</h2>

        <div className="card customer-profile-card mt-md">
          <div className="totals-summary text-center">
            <p>Total Deposits: <strong className="text-success">${totals.usd.toFixed(2)}</strong></p>
            <p>Total BTC: <strong>{totals.btc.toFixed(8)} BTC</strong></p>
          </div>

          <h3 className="card-subtitle mt-md">Transaction History</h3>

          {loading ? (
            <p className="text-center mt-md">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-center mt-md">No orders found for this user.</p>
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
