// pages/admin/dashboard.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice';

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

  // --- STATES FOR CASHOUT ---
  const [cashoutUsername, setCashoutUsername] = useState('');
  const [cashoutDestination, setCashoutDestination] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [isSendingCashout, setIsSendingCashout] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState({ message: '', type: '' });
  const [isAmountlessInvoice, setIsAmountlessInvoice] = useState(false);
  const [decodeError, setDecodeError] = useState('');

  // --- Authentication Check ---
  useEffect(() => {
    // Check local storage for the consistent admin_auth flag
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin'); // Redirect to the admin login page (index.js)
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      // Call API to clear the server-side HTTP-only cookie
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      localStorage.removeItem('admin_auth'); // Clear client-side flag
      router.replace('/admin'); // Redirect to the admin login page (index.js)
    }
  }, [router]);

  // --- Order Fetching Logic ---
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({
        from: range.from,
        to: range.to,
        search: search,
        status: statusFilter
      }).toString();

      // No need for 'x-admin-auth' header here; the HTTP-only cookie is sent automatically.
      const response = await fetch(`/api/admin/orders?${queryParams}`);
      if (!response.ok) {
        if (response.status === 401) {
          setError('Unauthorized. Please log in again.');
          logout(); // Use the memoized logout function
        } else {
          throw new Error(`Error: ${response.statusText}`);
        }
      }
      const data = await response.json();
      setOrders(data);

      let totalUsd = 0;
      let totalBtc = 0;
      data.forEach(order => {
        if (order.amountUSD) {
          totalUsd += order.amountUSD;
        }
        if (order.amountBTC) {
          totalBtc += order.amountBTC;
        }
      });
      setRangeSummary({ count: data.length, usd: totalUsd, btc: totalBtc });

    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError(`Failed to fetch orders: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, search, statusFilter, logout]);

  useEffect(() => {
    // Only fetch orders if authenticated via client-side flag
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') === '1') {
      fetchOrders();
      const interval = setInterval(fetchOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchOrders]);

  const handleRangeChange = (e) => {
    setRange({ ...range, [e.target.name]: e.target.value });
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
  };

  const markAsPaid = async (orderId) => {
    if (window.confirm(`Are you sure you want to manually mark order ${orderId} as PAID? This will update the status in the database.`)) {
      try {
        const response = await fetch('/api/admin/orders/mark-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, // HTTP-only cookie sent automatically
          body: JSON.stringify({ orderId }),
        });
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        await response.json();
        alert('Order marked as paid!');
        fetchOrders();
      } catch (err) {
        console.error('Failed to mark order as paid:', err);
        alert(`Failed to mark order as paid: ${err.message}`);
      }
    }
  };

  const markAsCancelled = async (orderId) => {
    if (window.confirm(`Are you sure you want to manually cancel order ${orderId}? This will update the status in the database.`)) {
      try {
        const response = await fetch('/api/admin/orders/mark-cancelled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, // HTTP-only cookie sent automatically
          body: JSON.stringify({ orderId }),
        });
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        await response.json();
        alert('Order marked as cancelled!');
        fetchOrders();
      } catch (err) {
        console.error('Failed to mark order as cancelled:', err);
        alert(`Failed to mark order as cancelled: ${err.message}`);
      }
    }
  };

  const markAsRead = async (orderId) => {
    if (window.confirm(`Mark order ${orderId} as read?`)) {
      try {
        const response = await fetch('/api/admin/orders/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, // HTTP-only cookie sent automatically
          body: JSON.stringify({ orderId }),
        });
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        await response.json();
        alert('Order marked as read!');
        fetchOrders();
      } catch (err) {
        console.error('Failed to mark order as read:', err);
        alert(`Failed to mark order as read: ${err.message}`);
      }
    }
  };

  // --- CASHOUT Logic ---

  const decodeInvoice = (invoiceString) => {
    if (!invoiceString) {
      setDecodeError('');
      setIsAmountlessInvoice(false);
      return;
    }
    try {
      const decoded = bolt11.decode(invoiceString);
      if (decoded.millisatoshis) {
        setIsAmountlessInvoice(false);
        setDecodeError('');
      } else {
        setIsAmountlessInvoice(true);
        setDecodeError('');
      }
    } catch (e) {
      setDecodeError(`Invalid Invoice/Address: ${e.message}`);
      setIsAmountlessInvoice(false);
    }
  };

  useEffect(() => {
    decodeInvoice(cashoutDestination);
  }, [cashoutDestination]);

  const handleCashoutSubmit = async (e) => {
    e.preventDefault();
    setIsSendingCashout(true);
    setCashoutStatus({ message: '', type: '' });
    setDecodeError('');

    if (!cashoutUsername || !cashoutDestination) {
      setCashoutStatus({ message: 'Username and Destination are required.', type: 'error' });
      setIsSendingCashout(false);
      return;
    }

    let amountToSend = cashoutAmount;
    if ((isAmountlessInvoice || isLightningAddress(cashoutDestination)) && (!amountToSend || parseFloat(amountToSend) <= 0)) {
      setCashoutStatus({ message: 'Amount is required for amountless invoices or Lightning Addresses.', type: 'error' });
      setIsSendingCashout(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/cashouts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // HTTP-only cookie sent automatically
        body: JSON.stringify({
          username: cashoutUsername,
          invoice: cashoutDestination,
          amount: (isAmountlessInvoice || isLightningAddress(cashoutDestination)) ? amountToSend : null
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCashoutStatus({ message: data.message, type: 'success' });
        setCashoutUsername('');
        setCashoutDestination('');
        setCashoutAmount('');
        setIsAmountlessInvoice(false);
        fetchOrders();
      } else {
        setCashoutStatus({ message: data.message || 'Failed to send cashout.', type: 'error' });
      }
    } catch (err) {
      console.error('Error sending cashout:', err);
      setCashoutStatus({ message: `Network error: ${err.message}`, type: 'error' });
    } finally {
      setIsSendingCashout(false);
    }
  };

  const isLightningAddress = (dest) => {
    return typeof dest === 'string' && dest.includes('@') && !dest.startsWith('lnbc');
  };

  const formatAge = (timestamp) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffSeconds = Math.floor((now - created) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Conditional rendering if not authenticated: display a loading/redirect message
  if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Redirecting to admin login...</div>;
  }

  // Once authenticated, render the dashboard content
  return (
    <div className="container mt-5">
      <h1 className="mb-4">Admin Dashboard</h1>

      {/* Logout Button */}
      <div className="d-flex justify-content-end mb-3">
        <button className="btn btn-warning" onClick={logout}>Logout</button>
      </div>

      {/* Cashout Section */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h2>Send Cashout (Lightning)</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleCashoutSubmit}>
            <div className="mb-3">
              <label htmlFor="cashoutUsername" className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                id="cashoutUsername"
                value={cashoutUsername}
                onChange={(e) => setCashoutUsername(e.target.value)}
                placeholder="User's username"
                required
                disabled={isSendingCashout}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="cashoutDestination" className="form-label">Destination (Bolt11 Invoice or Lightning Address)</label>
              <input
                type="text"
                className="form-control"
                id="cashoutDestination"
                value={cashoutDestination}
                onChange={(e) => setCashoutDestination(e.target.value)}
                placeholder="lnbc1... or username@domain.com"
                required
                disabled={isSendingCashout}
              />
              {decodeError && <div className="text-danger mt-1">{decodeError}</div>}
              {isAmountlessInvoice && (
                <div className="alert alert-info mt-2" role="alert">
                  This appears to be an amountless invoice. Please enter the USD amount to send.
                </div>
              )}
              {isLightningAddress(cashoutDestination) && (
                <div className="alert alert-info mt-2" role="alert">
                  This appears to be a Lightning Address. Please enter the USD amount to send.
                </div>
              )}
            </div>
            {(isAmountlessInvoice || isLightningAddress(cashoutDestination)) && (
              <div className="mb-3">
                <label htmlFor="cashoutAmount" className="form-label">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  id="cashoutAmount"
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                  placeholder="e.g., 5.00"
                  required={isAmountlessInvoice || isLightningAddress(cashoutDestination)}
                  disabled={isSendingCashout}
                />
              </div>
            )}
            <button type="submit" className="btn btn-success" disabled={isSendingCashout}>
              {isSendingCashout ? 'Sending...' : 'Send Cashout'}
            </button>
            {cashoutStatus.message && (
              <div className={`alert mt-3 ${cashoutStatus.type === 'success' ? 'alert-success' : 'alert-danger'}`} role="alert">
                {cashoutStatus.message}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Filters and Summary */}
      <div className="card mb-4">
        <div className="card-header bg-info text-white">
          <h2>Order Filters & Summary</h2>
        </div>
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-4">
              <label htmlFor="fromDate" className="form-label">From Date:</label>
              <input type="date" className="form-control" id="fromDate" name="from" value={range.from} onChange={handleRangeChange} />
            </div>
            <div className="col-md-4">
              <label htmlFor="toDate" className="form-label">To Date:</label>
              <input type="date" className="form-control" id="toDate" name="to" value={range.to} onChange={handleRangeChange} />
            </div>
            <div className="col-md-4">
              <label htmlFor="statusFilter" className="form-label">Status Filter:</label>
              <select className="form-select" id="statusFilter" value={statusFilter} onChange={handleStatusFilterChange}>
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label htmlFor="searchOrders" className="form-label">Search (Username, Order ID, Description):</label>
            <input type="text" className="form-control" id="searchOrders" value={search} onChange={handleSearchChange} placeholder="Type to search..." />
          </div>
          <div className="alert alert-secondary">
            <p><strong>Total Orders in Range:</strong> {rangeSummary.count}</p>
            <p><strong>Total USD Amount in Range:</strong> ${rangeSummary.usd.toFixed(2)}</p>
            <p><strong>Total BTC Amount in Range:</strong> {rangeSummary.btc.toFixed(8)} BTC</p>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
          <h2>Orders {refreshing && <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span>}</h2>
          <button className="btn btn-sm btn-outline-light" onClick={fetchOrders} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh Orders'}
          </button>
        </div>
        <div className="card-body">
          {orders.length === 0 && !loading && !error ? (
            <p className="text-center">No orders found.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover table-bordered">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Username</th>
                    <th>Amount (USD)</th>
                    <th>Amount (BTC)</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Manual Payment/Cancellation</th>
                    <th>Read</th>
                    <th>Created At</th>
                    <th>Age</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? orders.map(order => (
                    <tr key={order.orderId}>
                      <td>{order.orderId}</td>
                      <td>{order.username}</td>
                      <td>${order.amountUSD ? order.amountUSD.toFixed(2) : 'N/A'}</td>
                      <td>{order.amountBTC ? order.amountBTC.toFixed(8) : 'N/A'}</td>
                      <td>{order.description}</td>
                      <td style={{
                        color:
                          order.status === 'paid'
                            ? '#28a745'
                            : order.status === 'pending'
                              ? '#007bff'
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
                      <td colSpan="11" className="text-center">No orders found matching your criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}