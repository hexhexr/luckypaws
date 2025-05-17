import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [rangeSummary, setRangeSummary] = useState({ count: 0, usd: 0, btc: 0 });
  const [range, setRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin/login');
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('admin_auth');
    router.replace('/admin/login');
  };

  const loadOrders = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load orders');

      const sorted = data.sort((a, b) => new Date(b.created) - new Date(a.created));
      setOrders(sorted);
      updateRangeSummary(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(), 4000);
    return () => clearInterval(interval);
  }, []);

  const updateRangeSummary = (list) => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999);

    const filtered = list.filter(o => {
      if (o.status !== 'paid') return false;
      const created = new Date(o.created);
      return created >= fromDate && created <= toDate;
    });

    const count = filtered.length;
    const usd = filtered.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
    const btc = filtered.reduce((sum, o) => sum + parseFloat(o.btc || 0), 0);

    setRangeSummary({
      count,
      usd: usd.toFixed(2),
      btc: btc.toFixed(8),
    });
  };

  useEffect(() => {
    updateRangeSummary(orders);
  }, [range]);

  const markAsRead = async (id) => {
    await fetch(`/api/orders/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, update: { read: true, readAt: new Date().toISOString() } }),
    });
    setOrders(orders.map(o => o.orderId === id ? { ...o, read: true, readAt: new Date().toISOString() } : o));
  };

  const markAsPaid = async (id) => {
    await fetch(`/api/orders/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, update: { status: 'paid', paidManually: true } }),
    });
    setOrders(orders.map(o => o.orderId === id ? { ...o, status: 'paid', paidManually: true } : o));
  };

  const formatAge = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    return diff < 1 ? 'Just now' : `${diff} min${diff > 1 ? 's' : ''} ago`;
  };

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
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>
      <div className="main-content">
        <h2 className="text-center mt-lg">🧾 All Orders {refreshing && <span style={{ fontSize: '0.9rem', color: '#999' }}>(refreshing...)</span>}</h2>

        <div className="card mt-md" style={{ background: '#f9f9f9', border: '1px solid #ddd', padding: '1rem', borderRadius: '12px' }}>
          <h3>📍 Summary (Date Range)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
            <div>
              From: <input type="date" value={range.from} onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              To: <input type="date" value={range.to} onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          </div>
          <div>
            <strong>{rangeSummary.count}</strong> orders | <strong>${rangeSummary.usd}</strong> USD | <strong>{rangeSummary.btc}</strong> BTC
          </div>
        </div>

        <input
          className="input mt-md"
          placeholder="Search by username or order ID"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-center mt-md">Loading orders...</p>
        ) : error ? (
          <div className="alert alert-danger mt-md">{error}</div>
        ) : (
          <div className="card mt-md">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Game</th>
                  <th>Amount</th>
                  <th>BTC</th>
                  <th>Status</th>
                  <th>Manual</th>
                  <th>Read</th>
                  <th>Time</th>
                  <th>Age</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, i) => (
                  <tr key={i}>
                    <td>
                      <a href={`/admin/customer/${order.username}`} style={{ color: '#0984e3', fontWeight: 500 }}>
                        {order.username}
                      </a>
                    </td>
                    <td>{order.game}</td>
                    <td>${order.amount}</td>
                    <td>{order.btc || '0.00000000'}</td>
                    <td style={{
                      color: order.status === 'paid'
                        ? order.paidManually ? '#2962ff' : 'green'
                        : '#d63031'
                    }}>
                      {order.status}
                    </td>
                    <td>{order.paidManually ? 'Yes' : 'No'}</td>
                    <td>{order.read ? `✔️ ${new Date(order.readAt).toLocaleTimeString()}` : '—'}</td>
                    <td>{new Date(order.created).toLocaleString()}</td>
                    <td>{formatAge(order.created)}</td>
                    <td>
                      {order.status === 'paid' && !order.read && (
                        <button className="btn btn-primary btn-sm" onClick={() => markAsRead(order.orderId)}>Mark Read</button>
                      )}
                      {order.status !== 'paid' && (
                        <button className="btn btn-success btn-sm mt-sm" onClick={() => markAsPaid(order.orderId)}>Mark Paid</button>
                      )}
                    </td>
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
