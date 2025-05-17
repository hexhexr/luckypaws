import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch');
        setOrders(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const filteredOrders = orders.filter(order =>
    order.username.toLowerCase().includes(search.toLowerCase()) ||
    order.orderId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
      </div>
      <div className="main-content">
        <h2 className="text-center mt-lg">🧾 All Orders</h2>
        <input
          type="text"
          className="input"
          placeholder="Search by username or order ID"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Game</th>
                  <th>Amount</th>
                  <th>BTC</th>
                  <th>Status</th>
                  <th>Manual</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, i) => (
                  <tr key={i}>
                    <td>{order.username}</td>
                    <td>{order.game}</td>
                    <td>${order.amount}</td>
                    <td>{order.btc || '0.00000000'}</td>
                    <td>{order.status}</td>
                    <td>{order.paidManually ? 'Yes' : 'No'}</td>
                    <td>{new Date(order.created).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
