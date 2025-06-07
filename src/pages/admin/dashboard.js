// pages/admin/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isAuthenticated } from '../../lib/auth'; // Adjust path as needed

// Add this to all protected admin pages
export async function getServerSideProps(context) {
  if (!isAuthenticated(context.req)) {
    return {
      redirect: {
        destination: '/admin', // Redirect to the login page
        permanent: false,
      },
    };
  }
  return {
    props: {}, // Will be passed to the page component as props
  };
}

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

  // REMOVE THIS useEffect completely. Authentication is now handled by getServerSideProps.
  // useEffect(() => {
  //   if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
  //     router.replace('/admin');
  //   }
  // }, []);

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      // REMOVE localStorage.removeItem('admin_auth');
      router.replace('/admin'); // Redirect to the admin login page
    } catch (err) {
      console.error('Logout API error:', err);
      setError('Failed to log out.'); // Display error to user
      router.replace('/admin'); // Force redirect even on API error for security
    }
  };

  // ... (rest of your component code remains the same)
  // Ensure the fetchOrders, markAsPaid, markAsCancelled, markAsRead, calculateSummary functions
  // correctly handle potential unauthenticated responses from their respective APIs.
  // If an API responds with 401, you might want to force a redirect to login.

  // Example of how to structure fetchOrders to handle auth errors:
  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/orders'); // Assuming this API is protected
      if (res.status === 401) { // Unauthorized
        router.replace('/admin'); // Redirect to login
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch orders.');
      const data = await res.json();
      setOrders(data);
      calculateSummary(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  // ... (rest of the component, including JSX)

  // Example of how to format date age:
  const formatAge = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffSeconds = Math.floor((now - created) / 1000);
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Remaining functions and JSX...
  // You will need to re-add the entire content of your AdminDashboard component here,
  // making sure to remove the `useEffect` for local storage check and the `localStorage.removeItem`
  // from the logout function.
  // The structure provided in the initial snippet of `dashboard.js` will go here.
  return (
    <div className="container mt-xl">
      <h1 className="title text-center mb-lg">Admin Dashboard</h1>

      {/* Logout button */}
      <div className="text-right mb-md">
        <button onClick={logout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      {/* Navigation for admin section */}
      <nav className="admin-nav mb-lg">
        <button className="btn btn-primary" onClick={() => router.push('/admin/dashboard')}>Dashboard</button>
        <button className="btn btn-secondary" onClick={() => router.push('/admin/games')}>Manage Games</button>
        <button className="btn btn-secondary" onClick={() => router.push('/admin/profit-loss')}>Profit/Loss</button>
      </nav>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

      {/* Summary Section */}
      <div className="card summary-card mb-lg">
        <h2 className="card-header">📊 Summary (Selected Range)</h2>
        <div className="card-body">
          <div className="date-range-controls mb-md">
            <label htmlFor="fromDate">From:</label>
            <input
              type="date"
              id="fromDate"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className="input"
            />
            <label htmlFor="toDate">To:</label>
            <input
              type="date"
              id="toDate"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className="input"
            />
          </div>
          <div className="summary-grid">
            <div className="summary-item">
              <h3>Total Orders</h3>
              <p>{rangeSummary.count}</p>
            </div>
            <div className="summary-item">
              <h3>Total USD</h3>
              <p className="text-success">${rangeSummary.usd.toFixed(2)}</p>
            </div>
            <div className="summary-item">
              <h3>Total BTC</h3>
              <p>{rangeSummary.btc.toFixed(8)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Management Section */}
      <div className="card order-management-card">
        <h2 className="card-header">Recent Orders</h2>
        <div className="card-body">
          <div className="controls mb-md">
            <input
              type="text"
              placeholder="Search by username or order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input search-input"
            />
            <div className="status-filter">
              <label htmlFor="statusFilter">Filter by Status:</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button onClick={fetchOrders} className="btn btn-primary refresh-btn">
              {refreshing ? 'Refreshing...' : 'Refresh Orders'}
            </button>
          </div>

          {loading ? (
            <p className="text-center">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-center">No orders found.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Username</th>
                    <th>Game</th>
                    <th>Amount (USD)</th>
                    <th>Amount (BTC)</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Manually Marked?</th>
                    <th>Read At</th>
                    <th>Created At</th>
                    <th>Age</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(order =>
                      statusFilter === 'all' || order.status === statusFilter
                    )
                    .filter(order =>
                      order.username.toLowerCase().includes(search.toLowerCase()) ||
                      order.orderId.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((order) => (
                      <tr key={order.orderId}>
                        <td>{order.orderId}</td>
                        <td>{order.username}</td>
                        <td>{order.game}</td>
                        <td>${Number(order.amount).toFixed(2)}</td>
                        <td>{Number(order.btc).toFixed(8)}</td>
                        <td>{order.method}</td>
                        <td
                          style={{
                            color:
                              order.status === 'paid'
                                ? 'var(--primary-green)'
                                : order.status === 'pending'
                                ? 'var(--yellow-warning)'
                                : order.status === 'cancelled'
                                ? '#7f8c8d' // Grey for cancelled
                                : '#d63031' // Red for pending (default)
                          }}
                        >
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
    </div>
  );
}