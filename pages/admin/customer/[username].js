import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function CustomerProfile() {
  const router = useRouter();
  const { username } = router.query;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ usd: 0, btc: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  useEffect(() => {
    if (!username) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/orders`);
        const data = await res.json();
        if (!res.ok) throw new Error('Failed to load');

        const userOrders = data.filter(o => o.username.toLowerCase() === username.toLowerCase());
        const usd = userOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
        const btc = userOrders.reduce((sum, o) => sum + Number(o.btc || 0), 0);

        setOrders(userOrders);
        setTotals({ usd, btc });
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username]);

  return (
    <div className="container mt-lg">
      <div className="card customer-profile-card">
        <h2 className="card-header">👤 {username}'s Profile</h2>
        <div className="totals-summary text-center">
          <p>Total Deposits: <strong className="text-success">${totals.usd.toFixed(2)}</strong></p>
          <p className="btc-total">Total BTC: <strong> {totals.btc.toFixed(8)} BTC</strong></p>
        </div>

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
                  <tr key={i}>
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

        <div className="text-center mt-xl"> {/* Increased margin for button */}
          <button className="btn btn-secondary" onClick={() => router.back()}>← Back to Profit & Loss</button>
        </div>
      </div>
    </div>
  );
}