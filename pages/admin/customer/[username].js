import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';

export default function CustomerProfile() {
  const router = useRouter();
  const { username } = router.query;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ usd: 0, btc: 0 });

  // Authentication check
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  // Fetch data for the specific user
  const loadUserData = useCallback(async () => {
    if (!username) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/user-orders?username=${username}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load user orders');
      }

      const userOrders = data;
      const usd = userOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
      const btc = userOrders.reduce((sum, o) => sum + Number(o.btc || 0), 0);

      setOrders(userOrders);
      setTotals({ usd, btc });
    } catch (err) {
      console.error('Failed to load user data:', err);
      // Optionally set an error state to display to the user
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
        <a className="nav-btn active" href="/admin/profit-loss">📊 Profit & Loss</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>

      <div className="main-content">
        <h2 className="section-title">👤 Customer Profile: {username}</h2>

        <div className="card customer-profile-card mt-md">
          <div className="totals-summary text-center">
            <p>Total Deposits: <strong className="text-success">${totals.usd.toFixed(2)}</strong></p>
            <p className="btc-total">Total BTC: <strong> {totals.btc.toFixed(8)} BTC</strong></p>
          </div>

          <h3 className="card-subtitle">Transaction History</h3>

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
                  {orders.map((o, i) => (
                    <tr key={o.id || i}>
                      <td>{o.game}</td>
                      <td>${o.amount}</td>
                      <td>{o.btc}</td>
                      <td className={
                        o.status === 'paid' ? 'status-paid' :
                        o.status === 'pending' ? 'status-pending' :
                        'status-cancelled'
                      }>
                        {o.status}
                      </td>
                      <td>{new Date(o.created).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-center mt-xl">
            <button className="btn btn-secondary" onClick={() => router.back()}>← Back to Profit & Loss</button>
          </div>
        </div>
      </div>
    </div>
  );
}