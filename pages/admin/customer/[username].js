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
    if (!username) {
      setLoading(false); // If no username, stop loading and show no data
      return;
    }

    setLoading(true);
    try {
      // Reverting to fetching all orders and filtering client-side
      // This ensures data shows up if the /api/user-orders endpoint isn't fully implemented
      const res = await fetch(`/api/orders`); // Fetch all orders
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load orders');
      }

      // Filter orders by username locally
      const userOrders = data.filter(o => o.username && o.username.toLowerCase() === username.toLowerCase());

      console.log('Fetched all orders:', data); // Log all fetched data
      console.log('Filtered user orders:', userOrders); // Log filtered data

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
        {/* Kept active for Profit & Loss if that's the primary path */}
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
                  {orders.map((o) => ( // Removed 'i' as key, using o.id or fallback
                    <tr key={o.id || `${o.username}-${o.created}-${o.amount}`}>
                      <td>{o.game || 'N/A'}</td> {/* Handle potentially missing 'game' */}
                      <td>${o.amount ? o.amount.toFixed(2) : '0.00'}</td> {/* Ensure amount is formatted */}
                      <td>{o.btc || '0'}</td> {/* Display 0 if BTC is missing */}
                      <td className={
                        o.status === 'paid' ? 'status-paid' :
                        o.status === 'pending' ? 'status-pending' :
                        'status-cancelled'
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
            <button className="btn btn-secondary" onClick={() => router.back()}>← Back</button> {/* Changed button text */}
          </div>
        </div>
      </div>
    </div>
  );
}