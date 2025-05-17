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
      <div className="card">
        <h2 className="text-center">👤 {username}'s Profile</h2>
        <p className="text-center">
          Total Deposits: <strong>${totals.usd.toFixed(2)}</strong> | 
          <strong> {totals.btc.toFixed(8)} BTC</strong>
        </p>

        {loading ? (
          <p className="text-center mt-md">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="text-center mt-md">No orders found.</p>
        ) : (
          <div className="mt-md">
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
                    <td style={{ color: o.status === 'paid' ? 'green' : '#d63031' }}>
                      {o.status}
                    </td>
                    <td>{new Date(o.created).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center mt-md">
          <button className="btn btn-primary" onClick={() => router.back()}>← Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
}
