// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

export default function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [rangeSummary, setRangeSummary] = useState({ count: 0, usd: 0, btc: 0 });
  const [range, setRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    // Check local storage for admin_auth before rendering
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin'); // Redirect to the admin login page (index.js)
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      localStorage.removeItem('admin_auth');
      router.replace('/admin');
    }
  }, [router]);

  const loadOrders = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized. Please log in again.');
          logout();
        } else {
          throw new Error(data.message || 'Failed to load orders');
        }
      }
      const sorted = data.sort((a, b) => new Date(b.created) - new Date(a.created));
      setOrders(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') === '1') {
      loadOrders();
      const orderInterval = setInterval(() => loadOrders(), 4000);
      return () => {
        clearInterval(orderInterval);
      };
    }
  }, [loadOrders]);

  const updateRangeSummary = useCallback((list) => {
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
  }, [range]);

  useEffect(() => {
    updateRangeSummary(orders);
  }, [range, orders, updateRangeSummary]);

  const markAsPaid = async (orderId) => {
    if (window.confirm(`Are you sure you want to manually mark order ${orderId} as PAID? This will update the status in the database.`)) {
      try {
        const response = await fetch('/api/orders/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: orderId, update: { status: 'paid', paidManually: true, paidAt: new Date().toISOString() } }),
        });
        if (!response.ok) {
           const data = await response.json();
           throw new Error(data.message || `Error: ${response.statusText}`);
        }
        alert('Order marked as paid!');
        loadOrders();
      } catch (err) {
        console.error('Failed to mark order as paid:', err);
        alert(`Failed to mark order as paid: ${err.message}`);
      }
    }
  };

  const markAsRead = async (id) => {
    if (window.confirm(`Mark order ${id} as read?`)) {
      try {
        await fetch(`/api/orders/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, update: { read: true, readAt: new Date().toISOString() } }),
        });
        setOrders(prevOrders => prevOrders.map(o => o.orderId === id ? { ...o, read: true, readAt: new Date().toISOString() } : o));
      } catch (err) {
        console.error('Failed to mark as read:', err);
        setError('Failed to mark order as read.');
      }
    }
  };

  const markAsCancelled = async (id) => {
    if (window.confirm("Are you sure you want to mark this order as 'cancelled'? This action cannot be undone.")) {
      try {
        await fetch(`/api/orders/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, update: { status: 'cancelled', cancelledManually: true } }),
        });
        setOrders(prevOrders => prevOrders.map(o => o.orderId === id ? { ...o, status: 'cancelled', cancelledManually: true } : o));
      } catch (err) {
        console.error('Failed to mark as cancelled:', err);
        setError('Failed to mark order as cancelled.');
      }
    }
  };

  const formatAge = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min${diff > 1 ? 's' : ''} ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const filteredOrders = orders.filter(order => {
    const searchTermLower = search.toLowerCase();
    const matchesSearch = order.username.toLowerCase().includes(searchTermLower) ||
                          order.orderId.toLowerCase().includes(searchTermLower);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Redirecting to admin login...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
        <a className="nav-btn" href="/admin/cashouts">⚡ Cashouts</a> {/* NEW MENU ITEM */}
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>
      <div className="main-content">
        <h2 className="text-center mt-lg">🧾 All Orders {refreshing && <span style={{ fontSize: '0.9rem', color: '#999' }}>(refreshing...)</span>}</h2>

        <div className="card mt-md" style={{ background: '#f9f9f9', border: '1px solid #ddd', padding: '1rem', borderRadius: '12px' }}>
          <h3>📍 Summary (Date Range)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
            <div>
              From: <input type="date" className="input" value={range.from} onChange={e => setRange(prev => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              To: <input type="date" className="input" value={range.to} onChange={e => setRange(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          </div>
          <div>
            <strong>{rangeSummary.count}</strong> paid orders | <strong>${rangeSummary.usd}</strong> USD | <strong>{rangeSummary.btc}</strong> BTC
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
          <input
            className="input"
            style={{ flexGrow: 1, margin: 0 }}
            placeholder="Search by username or order ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 'auto', margin: 0 }}
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
          <div className="card mt-md orders-table-container" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Game</th>
                  <th>Amount (USD)</th>
                  <th>Amount (BTC)</th>
                  <th>Status</th>
                  <th>Manual Action</th>
                  <th>Read At</th>
                  <th>Created At</th>
                  <th>Age</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                  <tr key={order.orderId}>
                    <td>
                      <a href={`/admin/customer/${order.username}`} style={{ color: '#0984e3', fontWeight: 500 }}>
                        {order.username}
                      </a>
                    </td>
                    <td>{order.game}</td>
                    <td>${parseFloat(order.amount || 0).toFixed(2)}</td>
                    <td>{order.btc || '0.00000000'}</td>
                    <td style={{
                      color: order.status === 'paid'
                        ? order.paidManually ? '#2962ff' : 'green'
                        : order.status === 'expired'
                        ? '#ff9800'
                        : order.status === 'cancelled'
                        ? '#7f8c8d'
                        : '#d63031'
                    }}>
                      {order.status}
                    </td>
                    <td>{order.paidManually ? 'Paid' : (order.cancelledManually ? 'Cancelled' : 'No')}</td>
                    <td>{order.read && order.readAt ? `✔️ ${new Date(order.readAt).toLocaleTimeString()}` : '—'}</td>
                    <td>{new Date(order.created).toLocaleString()}</td>
                    <td>{formatAge(order.created)}</td>
                    <td>
                      {order.status === 'pending' && (
                        <>
                          <button className="btn btn-success btn-sm me-2" onClick={() => markAsPaid(order.orderId)}>Mark Paid</button>
                          <button className="btn btn-danger btn-sm" onClick={() => markAsCancelled(order.orderId)}>Cancel Order</button>
                        </>
                      )}
                      {order.status === 'paid' && !order.read && (
                        <button className="btn btn-primary btn-sm" onClick={() => markAsRead(order.orderId)}>Mark as Read</button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="10" className="text-center">No orders found matching your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}