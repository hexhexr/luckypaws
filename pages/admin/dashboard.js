// pages/admin/dashboard.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice'; // Import bolt11 library

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
  const [cashoutDestination, setCashoutDestination] = useState(''); // Renamed from cashoutInvoice for clarity
  const [cashoutAmount, setCashoutAmount] = useState(''); // Amount in USD
  const [isSendingCashout, setIsSendingCashout] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState({ message: '', type: '' }); // type: 'success' or 'error' or 'info'
  const [isAmountlessInvoice, setIsAmountlessInvoice] = useState(false); // New state to track amountless invoices
  const [isLightningAddressDetected, setIsLightningAddressDetected] = useState(false); // New state for Lightning Address

  // --- STATES FOR CASHOUT HISTORY ---
  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [loadingCashoutHistory, setLoadingCashoutHistory] = useState(true);


  useEffect(() => {
    // Check local storage for admin_auth before rendering
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin'); // Redirect to the admin login page
    }
  }, [router]);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // NEW: Function to load cashout history
  const loadCashoutHistory = async () => {
    setLoadingCashoutHistory(true);
    try {
      // You'll need to create a new API endpoint for fetching cashouts from profitLoss
      const res = await fetch('/api/admin/cashouts'); // This endpoint needs to be created
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load cashout history');
      
      const sortedCashouts = data.sort((a, b) => new Date(b.time) - new Date(a.time));
      setCashoutHistory(sortedCashouts);
    } catch (err) {
      console.error('Error loading cashout history:', err);
      // setCashoutStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' }); // Maybe display somewhere else
    } finally {
      setLoadingCashoutHistory(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') === '1') {
        loadOrders();
        loadCashoutHistory(); // Load cashout history on component mount
        const orderInterval = setInterval(() => loadOrders(), 4000); // Refresh orders
        const cashoutInterval = setInterval(() => loadCashoutHistory(), 10000); // Refresh cashout history less frequently
        return () => {
          clearInterval(orderInterval);
          clearInterval(cashoutInterval);
        };
    }
  }, []); // Effect for loading orders and cashout history

  const updateRangeSummary = (list) => {
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    toDate.setHours(23, 59, 59, 999); // Include the entire 'to' day

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
  }, [range, orders]); // Update summary when range or orders change

  const markAsRead = async (id) => {
    await fetch(`/api/orders/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, update: { read: true, readAt: new Date().toISOString() } }),
    });
    setOrders(prevOrders => prevOrders.map(o => o.orderId === id ? { ...o, read: true, readAt: new Date().toISOString() } : o));
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
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 60000); // minutes
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

  // NEW useEffect to decode invoice and set amount
  useEffect(() => {
    // Clear previous status messages and states related to amount on destination change
    setCashoutStatus({ message: '', type: '' });
    setCashoutAmount(''); // Clear amount
    setIsAmountlessInvoice(false); // Reset to false
    setIsLightningAddressDetected(false); // Reset Lightning Address detection

    const destination = cashoutDestination.trim();

    if (destination.length === 0) {
      setCashoutStatus({ message: 'Enter a Lightning Invoice (lnbc...) or Lightning Address (user@example.com).', type: 'info' });
      return; // Do nothing if input is empty
    }

    if (destination.startsWith('lnbc')) { // It's likely a Bolt11 invoice
      try {
        const decoded = bolt11.decode(destination);
        // Check for satoshis or millisatoshis directly, handling 0 or null for amountless
        const invoiceMsats = decoded.millisatoshis ? parseInt(decoded.millisatoshis) : null;
        const invoiceSats = decoded.satoshis || (invoiceMsats !== null ? invoiceMsats / 1000 : null);
        
        if (invoiceSats !== null && invoiceSats > 0) { // Invoice has a fixed, positive amount
          // For display purposes, use a rough estimated rate. The actual conversion is server-side.
          // This rate needs to be kept in sync with or derived from the backend's `getSatoshisForUsd`
          const estimatedUsd = (invoiceSats / 3000); // Example: 1 USD = 3000 Sats. Adjust as needed.
          setCashoutAmount(estimatedUsd.toFixed(2));
          setIsAmountlessInvoice(false); // Not an amountless invoice
          setCashoutStatus({ message: `Fixed amount invoice detected: ${invoiceSats} sats (~$${estimatedUsd.toFixed(2)})`, type: 'info' });
        } else { // Amountless invoice (or 0 satoshi fixed invoice, which is also treated as amountless)
          setCashoutAmount(''); // Clear amount, allow manual input
          setIsAmountlessInvoice(true); // Mark as amountless
          setCashoutStatus({ message: 'Amountless invoice detected. Please enter the USD amount to cashout.', type: 'info' });
        }
      } catch (e) {
        // Not a valid bolt11 invoice or decode error
        setCashoutAmount(''); // Clear amount
        setIsAmountlessInvoice(false); // Not a valid invoice
        setCashoutStatus({ message: 'Invalid Bolt11 Lightning Invoice format. Please ensure it is a valid invoice.', type: 'error' });
      }
    } else if (destination.includes('@') && destination.split('@').length === 2 && destination.split('@')[1].includes('.')) { // Simple check for Lightning Address format
      setCashoutAmount(''); // Clear amount and allow manual input
      setIsAmountlessInvoice(false); // Not an amountless invoice (but requires amount)
      setIsLightningAddressDetected(true);
      setCashoutStatus({ message: 'Lightning Address detected. Please enter the USD amount to cashout.', type: 'info' });
    } else {
      // Clear all if not a recognized invoice or lightning address format
      setCashoutAmount('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(false);
      setCashoutStatus({ message: 'Please enter a valid Bolt11 invoice (lnbc...) or Lightning Address (user@example.com).', type: 'info' });
    }
  }, [cashoutDestination]); // Re-run when cashoutDestination changes


  // --- CASHOUT HANDLER ---
  const handleSendCashout = async (e) => {
    e.preventDefault();
    setCashoutStatus({ message: '', type: '' }); // Clear previous status

    // Basic frontend validation
    if (!cashoutUsername.trim()) {
      setCashoutStatus({ message: 'Username is required for record-keeping.', type: 'error' });
      return;
    }
    if (!cashoutDestination.trim()) {
      setCashoutStatus({ message: 'Lightning Invoice or Address is required.', type: 'error' });
      return;
    }

    const amountValue = parseFloat(cashoutAmount);

    // Validate amount based on the type of destination
    const requiresAmount = isAmountlessInvoice || isLightningAddressDetected;
    if (requiresAmount) {
        if (isNaN(amountValue) || amountValue <= 0) {
            setCashoutStatus({ message: 'Amount (USD) must be a positive number for this type of cashout.', type: 'error' });
            return;
        }
    }

    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to send a cashout for ${cashoutUsername} to ${cashoutDestination}? Amount: ${requiresAmount ? `$${amountValue.toFixed(2)} USD` : 'invoice amount'}.`)) {
      setCashoutStatus({ message: 'Cashout cancelled by user.', type: 'info' });
      return;
    }


    setIsSendingCashout(true);

    try {
      const response = await fetch('/api/admin/cashouts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cashoutUsername.trim(),
          invoice: cashoutDestination.trim(), // API expects 'invoice' field for destination
          amount: requiresAmount ? amountValue.toFixed(2) : null, // Send amount only if it's manually entered/available
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send cashout');
      }

      // Enhanced success message
      setCashoutStatus({
        message: `Cashout successful! Transaction ID: ${data.cashoutId}. ${data.details.amountBTC} BTC ${data.details.amountUSD ? `($${data.details.amountUSD} USD)` : ''} sent.`,
        type: 'success'
      });
      setCashoutUsername('');
      setCashoutDestination('');
      setCashoutAmount('');
      setIsAmountlessInvoice(false); // Reset this state after successful cashout
      setIsLightningAddressDetected(false); // Reset after successful cashout
      loadCashoutHistory(); // Refresh cashout history after a successful cashout
      // Optionally, refresh profit/loss data if displayed or relevant
    } catch (error) {
      setCashoutStatus({ message: error.message || 'An error occurred while sending cashout.', type: 'error' });
    } finally {
      setIsSendingCashout(false);
    }
  };

  // Conditional rendering if not authenticated
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
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>
      <div className="main-content">
        {/* --- CASHOUT SECTION --- */}
        <div className="card mt-lg" style={{ background: '#fff0f5', border: '1px solid #ddd', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>💸 Send Cashout (Lightning)</h3>
          <form onSubmit={handleSendCashout}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="cashoutUser" style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>Username:</label>
              <input
                id="cashoutUser"
                type="text"
                className="input"
                value={cashoutUsername}
                onChange={(e) => setCashoutUsername(e.target.value)}
                required
                placeholder="Enter username for record-keeping"
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="cashoutDestination" style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>Lightning Invoice or Address:</label>
              <input
                id="cashoutDestination"
                type="text"
                className="input"
                value={cashoutDestination}
                onChange={(e) => setCashoutDestination(e.target.value)}
                required
                placeholder="lnbc... or user@example.com"
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="cashoutAmt" style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 500 }}>Amount (USD):</label>
              <input
                id="cashoutAmt"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                placeholder="e.g., 10.50"
                // Amount is required if it's an amountless invoice or a Lightning Address
                required={isAmountlessInvoice || isLightningAddressDetected}
                // Disabled if it's a fixed-amount invoice and amount is set
                disabled={cashoutDestination.startsWith('lnbc') && !isAmountlessInvoice}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
              <small style={{ display: 'block', marginTop: '0.3rem', color: '#555' }}>
                Enter the USD amount for the cashout. This will be logged and used for payment if the destination is a Lightning Address or an amountless invoice.
              </small>
            </div>
            <button type="submit" className="btn btn-success" disabled={isSendingCashout} style={{ padding: '0.6rem 1.2rem', fontSize: '1rem' }}>
              {isSendingCashout ? 'Processing...' : '⚡ Send Cashout & Record'}
            </button>
            {cashoutStatus.message && (
              <p style={{
                color: cashoutStatus.type === 'error' ? '#d63031' : (cashoutStatus.type === 'info' ? '#2d3436' : '#00b894'),
                marginTop: '1rem',
                padding: '0.75rem',
                background: cashoutStatus.type === 'error' ? '#ffebee' : (cashoutStatus.type === 'info' ? '#e9ecef' : '#e6fffa'),
                border: `1px solid ${cashoutStatus.type === 'error' ? '#d63031' : (cashoutStatus.type === 'info' ? '#ced4da' : '#00b894')}`,
                borderRadius: '4px',
                wordBreak: 'break-word'
              }}>
                {cashoutStatus.message}
              </p>
            )}
          </form>
        </div>

        {/* --- CASHOUT HISTORY SECTION (NEW) --- */}
        <div className="card mt-lg" style={{ background: '#f8f9fa', border: '1px solid #ddd', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>💰 Cashout History (Lightning)</h3>
          {loadingCashoutHistory ? (
            <p className="text-center">Loading cashout history...</p>
          ) : cashoutHistory.length === 0 ? (
            <p className="text-center">No Lightning cashouts recorded yet.</p>
          ) : (
            <div className="orders-table-container" style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Destination</th>
                    <th>USD Amount</th>
                    <th>BTC Amount</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Gateway ID</th>
                  </tr>
                </thead>
                <tbody>
                  {cashoutHistory.map((cashout) => (
                    <tr key={cashout.id}>
                      <td>{cashout.username}</td>
                      <td>{cashout.destination.length > 30 ? `${cashout.destination.substring(0, 30)}...` : cashout.destination}</td>
                      <td>{cashout.amountUSD ? `$${parseFloat(cashout.amountUSD).toFixed(2)}` : 'N/A'}</td>
                      <td>{cashout.amountBTC ? parseFloat(cashout.amountBTC).toFixed(8) : 'N/A'}</td>
                      <td>{new Date(cashout.time).toLocaleString()}</td>
                      <td style={{ color: cashout.status === 'completed' ? 'green' : '#d63031' }}>
                        {cashout.status}
                      </td>
                      <td>{cashout.paymentGatewayId || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {/* Existing Orders Section */}
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
                        <button className="btn btn-danger btn-sm" onClick={() => markAsCancelled(order.orderId)}>Cancel Order</button>
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