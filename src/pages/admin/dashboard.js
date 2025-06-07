// pages/admin/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // New state for status filter
  const [refreshing, setRefreshing] = useState(false);
  const [rangeSummary, setRangeSummary] = useState({ count: 0, usd: 0, btc: 0 });
  const [range, setRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

 useEffect(() => {
    const sessionCookie = typeof window !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('session=')) : null;
    if (!sessionCookie) {
      router.replace('/admin'); // Redirect to admin login if no session
      return;
    }
    try {
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]));
      // Assuming dashboard is primarily for admin, redirect if not admin
      // If agents also use this dashboard, you might adjust logic based on sessionData.role
      if (sessionData.role !== 'admin') {
        router.replace('/agent/dashboard'); // Redirect agents to their specific dashboard later
      }
    } catch (e) {
      console.error('Error parsing session cookie:', e);
      router.replace('/admin');
    }
  }, []);

  const logout = async () => {
    try {
      // Call API to clear the server-side cookie
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API error:', err);
      // Even if API fails, clear local storage and redirect for client-side logout
    } finally {
      localStorage.removeItem('admin_auth'); // Clear local storage auth token
      router.replace('/admin'); // Redirect to the admin login page
    }
  };

  const loadOrders = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/orders'); // Fetch all orders
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
    const interval = setInterval(() => loadOrders(), 4000); // Refresh every 4 seconds
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
  }, [range, orders]); // Added orders to dependency array for live update on order change

  const markAsRead = async (id) => {
    await fetch(`/api/orders/update`, { // Calls the update API endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, update: { read: true, readAt: new Date().toISOString() } }),
    });
    setOrders(orders.map(o => o.orderId === id ? { ...o, read: true, readAt: new Date().toISOString() } : o));
  };

  // Remove markAsPaid function as it's no longer needed for manual payment
  // const markAsPaid = async (id) => {
  //   await fetch(`/api/orders/update`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ id, update: { status: 'paid', paidManually: true } }),
  //   });
  //   setOrders(orders.map(o => o.orderId === id ? { ...o, status: 'paid', paidManually: true } : o));
  // };

  // New action: Mark as Cancelled
  const markAsCancelled = async (id) => {
    if (window.confirm("Are you sure you want to mark this order as 'cancelled'? This action cannot be undone.")) {
      try {
        await fetch(`/api/orders/update`, { // Calls the update API endpoint
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, update: { status: 'cancelled', cancelledManually: true } }),
        });
        setOrders(orders.map(o => o.orderId === id ? { ...o, status: 'cancelled', cancelledManually: true } : o));
      } catch (err) {
        console.error('Failed to mark as cancelled:', err);
        setError('Failed to mark order as cancelled.');
      }
    }
  };


  const formatAge = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    return diff < 1 ? 'Just now' : `${diff} min${diff > 1 ? 's' : ''} ago`;
  };

  const filteredOrders = orders.filter(order => {
    // Filter by search term (username or order ID)
    const matchesSearch = order.username.toLowerCase().includes(search.toLowerCase()) ||
                          order.orderId.toLowerCase().includes(search.toLowerCase());

    // Filter by status
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
          <input
            className="input"
            style={{ flexGrow: 1, margin: 0 }} // Adjust styling for input
            placeholder="Search by username or order ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 'unset', margin: 0 }} // Adjust styling for select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>


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
                        ? order.paidManually ? '#2962ff' : 'green' // Blue for manually paid
                        : order.status === 'expired'
                        ? '#ff9800' // Orange for expired
                        : order.status === 'cancelled'
                        ? '#7f8c8d' // Grey for cancelled
                        : '#d63031' // Red for pending (default)
                    }}>
                      {order.status}
                    </td>
                    <td>{order.paidManually ? 'Yes (Paid)' : (order.cancelledManually ? 'Yes (Cancelled)' : 'No')}</td> {/* Updated */}
                    <td>{order.read ? `✔️ ${new Date(order.readAt).toLocaleTimeString()}` : '—'}</td>
                    <td>{new Date(order.created).toLocaleString()}</td>
                    <td>{formatAge(order.created)}</td>
                    <td>
                      {order.status === 'pending' && (
                        <>
                          {/* Removed Mark Paid button */}
                          <button className="btn btn-danger btn-sm mt-sm" onClick={() => markAsCancelled(order.orderId)}>Cancel</button>
                        </>
                      )}
                      {order.status === 'paid' && !order.read && (
                        <button className="btn btn-primary btn-sm" onClick={() => markAsRead(order.orderId)}>Mark Read</button>
                      )}
                      {/* You can add more actions here for other statuses if needed */}
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