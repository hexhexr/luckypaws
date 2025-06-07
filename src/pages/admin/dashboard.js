// pages/admin/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link'; // Import Link for navigation
import { isAuthenticated } from '../../lib/auth'; // Import the server-side auth utility

export default function AdminDashboard({ isAuthenticatedUser }) {
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

  // Client-side effect for logout (only if the server-side check didn't redirect)
  useEffect(() => {
    // If not authenticated by getServerSideProps, router.replace('/admin') is handled there.
    // This client-side useEffect is primarily for initial setup or if state changes
    // after initial render (e.g., if a token expires during session).
    // For robust protection, rely on getServerSideProps.
    if (!isAuthenticatedUser && typeof window !== 'undefined') {
        router.replace('/admin');
    }
  }, [isAuthenticatedUser, router]);


  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin'); // Redirect to login after successful logout
    } catch (err) {
      console.error('Logout API error:', err);
      setError('Failed to log out.');
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/orders?search=${search}&status=${statusFilter}&from=${range.from}&to=${range.to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch orders');
      setOrders(data.orders);
      setRangeSummary(data.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Only load orders if the user is authenticated (passed from getServerSideProps)
    if (isAuthenticatedUser) {
      loadOrders();
    }
  }, [search, statusFilter, range.from, range.to, isAuthenticatedUser]);


  const refreshOrders = () => {
    setRefreshing(true);
    loadOrders();
  };

  // Helper to format order age
  const formatAge = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffSeconds = Math.floor((now - created) / 1000);

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  const markAsCancelled = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      const res = await fetch('/api/admin/orders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, update: { status: 'cancelled', cancelledManually: true } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel order');
      loadOrders(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const markAsRead = async (orderId) => {
    try {
      const res = await fetch('/api/admin/orders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, update: { read: true, readAt: new Date().toISOString() } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to mark order as read');
      loadOrders(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header">Admin Dashboard</h1>
        <nav className="admin-nav">
          <Link href="/admin/dashboard" className="btn btn-secondary mr-sm">
            Dashboard
          </Link>
          <Link href="/admin/games" className="btn btn-secondary mr-sm">
            Manage Games
          </Link>
          <Link href="/admin/profit-loss" className="btn btn-secondary mr-sm">
            Profit & Loss
          </Link>
          {/* New link for Agents page */}
          <Link href="/admin/agents" className="btn btn-secondary mr-sm">
            Manage Agents
          </Link>
          <button onClick={logout} className="btn btn-danger">Logout</button>
        </nav>

        {error && <p className="error-message mt-md">{error}</p>}

        <div className="summary-grid mt-lg">
          {/* Summary Cards */}
          <div className="summary-card paid">
            <h4>Paid Orders</h4>
            <p className="amount">${rangeSummary.usd.toFixed(2)}</p>
            <p className="btc-amount">{rangeSummary.btc.toFixed(8)} BTC</p>
            <p className="count">({rangeSummary.count} orders)</p>
          </div>

          {/* Date Range Controls */}
          <div className="date-range-controls">
            <label htmlFor="fromDate">From:</label>
            <input
              type="date"
              id="fromDate"
              className="input"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
            <label htmlFor="toDate">To:</label>
            <input
              type="date"
              id="toDate"
              className="input"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
            <button className="btn btn-primary" onClick={loadOrders}>Apply Date Filter</button>
          </div>
        </div>


        <div className="controls-row mt-lg">
          <input
            type="text"
            className="input search-input"
            placeholder="Search by username or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="select status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={refreshOrders} className="btn btn-secondary refresh-btn" disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>


        {loading && <p className="text-center mt-md">Loading orders...</p>}
        {!loading && orders.length === 0 && !error && <p className="text-center mt-md">No orders found.</p>}
        {!loading && orders.length > 0 && (
          <div className="table-responsive mt-md">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Username</th>
                  <th>Game</th>
                  <th>Amount (USD)</th>
                  <th>Amount (BTC)</th>
                  <th>Status</th>
                  <th>Manual Status</th> {/* Updated */}
                  <th>Read By Admin</th>
                  <th>Created At</th>
                  <th>Age</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.orderId}>
                    <td>{order.orderId}</td>
                    <td>{order.username}</td>
                    <td>{order.game}</td>
                    <td>${Number(order.amount).toFixed(2)}</td>
                    <td>{Number(order.btc).toFixed(8)}</td>
                    <td style={{
                      color: order.status === 'paid'
                        ? 'var(--primary-green)'
                        : order.status === 'pending'
                        ? 'var(--yellow-warning)'
                        : order.status === 'cancelled'
                        ? '#7f8c8d'
                        : '#d63031'
                    }}>
                      {order.status}
                    </td>
                    <td>{order.paidManually ? 'Yes (Paid)' : (order.cancelledManually ? 'Yes (Cancelled)' : 'No')}</td>
                    <td>{order.read ? `✔️ ${new Date(order.readAt).toLocaleTimeString()}` : '—'}</td>
                    <td>{new Date(order.created).toLocaleString()}</td>
                    <td>{formatAge(order.created)}</td>
                    <td>
                      {order.status === 'pending' && (
                        <>
                          <button className="btn btn-danger btn-sm mt-sm" onClick={() => markAsCancelled(order.orderId)}>Cancel</button>
                        </>
                      )}
                      {order.status === 'paid' && !order.read && (
                        <button className="btn btn-primary btn-sm" onClick={() => markAsRead(order.orderId)}>Mark Read</button>
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

// Server-side authentication check for AdminDashboard
export async function getServerSideProps(context) {
  const { req } = context;
  const { isAuthenticated } = await import('../../lib/auth'); // Dynamic import for getServerSideProps

  if (!isAuthenticated(req)) {
    return {
      redirect: {
        destination: '/admin', // Redirect to the admin login page
        permanent: false,
      },
    };
  }

  return {
    props: {
      isAuthenticatedUser: true, // Pass a prop to the component indicating authentication status
    },
  };
}