// pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice'; // Ensure this library is installed: npm install lightning-invoice

export default function AdminCashouts() {
  const router = useRouter();

  // --- STATES FOR CASHOUT FORM ---
  const [cashoutUsername, setCashoutUsername] = useState('');
  const [cashoutDestination, setCashoutDestination] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState(''); // Amount in USD
  const [isSendingCashout, setIsSendingCashout] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState({ message: '', type: '' }); // type: 'success', 'error', 'info'
  const [isAmountlessInvoice, setIsAmountlessInvoice] = useState(false);
  const [isLightningAddressDetected, setIsLightningAddressDetected] = useState(false);

  // --- STATES FOR CASHOUT HISTORY ---
  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [loadingCashoutHistory, setLoadingCashoutHistory] = useState(true);

  // Authentication check
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin');
    }
  }, [router]);

  // Logout function
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

  // Function to load cashout history
  const loadCashoutHistory = useCallback(async () => {
    setLoadingCashoutHistory(true);
    setCashoutStatus({ message: '', type: '' }); // Clear status when loading history
    try {
      const res = await fetch('/api/admin/cashouts'); // This endpoint fetches cashout history from Firebase
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          console.error('Unauthorized to load cashout history. Logging out.');
          logout();
        }
        throw new Error(data.message || 'Failed to load cashout history');
      }

      const sortedCashouts = data.sort((a, b) => new Date(b.time) - new Date(a.time));
      setCashoutHistory(sortedCashouts);
    } catch (err) {
      console.error('Error loading cashout history:', err);
      setCashoutStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' });
    } finally {
      setLoadingCashoutHistory(false);
    }
  }, [logout]);

  // Auto-load and refresh cashout history
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') === '1') {
      loadCashoutHistory();
      const cashoutInterval = setInterval(() => loadCashoutHistory(), 10000); // Refresh every 10 seconds
      return () => {
        clearInterval(cashoutInterval);
      };
    }
  }, [loadCashoutHistory]);

  // Effect to parse Lightning Destination and set amount/flags
  useEffect(() => {
    setCashoutStatus({ message: '', type: '' }); // Clear status on destination change
    setCashoutAmount(''); // Clear amount on destination change
    setIsAmountlessInvoice(false);
    setIsLightningAddressDetected(false);

    const destination = cashoutDestination.trim();

    if (destination.length === 0) {
      setCashoutStatus({ message: 'Enter a Lightning Invoice (lnbc...) or Lightning Address (user@example.com).', type: 'info' });
      return;
    }

    if (destination.startsWith('lnbc')) {
      try {
        const decoded = bolt11.decode(destination);
        const invoiceMsats = decoded.millisatoshis ? parseInt(decoded.millisatoshis) : null;
        const invoiceSats = decoded.satoshis || (invoiceMsats !== null ? invoiceMsats / 1000 : null);

        if (invoiceSats !== null && invoiceSats > 0) {
          // Fixed amount invoice
          const estimatedUsd = (invoiceSats / 3000); // Example rate, adjust as needed or remove if rate comes from backend
          setCashoutAmount(estimatedUsd.toFixed(2)); // Auto-fill amount for fixed invoices
          setIsAmountlessInvoice(false);
          setCashoutStatus({ message: `Fixed amount invoice detected: ${invoiceSats} sats (~$${estimatedUsd.toFixed(2)})`, type: 'info' });
        } else {
          // Amountless invoice
          setCashoutAmount(''); // Keep amount editable
          setIsAmountlessInvoice(true);
          setCashoutStatus({ message: 'Amountless invoice detected. Please enter the USD amount to cashout.', type: 'info' });
        }
      } catch (e) {
        // More specific error message for invalid invoice format
        console.error("Error decoding Bolt11 invoice:", e);
        if (e.message.includes('Invalid bech32')) {
          setCashoutStatus({ message: 'Invalid Bolt11 invoice format. Make sure it starts with "lnbc" and is fully copied.', type: 'error' });
        } else if (e.message.includes('Unknown currency')) {
            setCashoutStatus({ message: 'Invoice currency not recognized. Please check the invoice.', type: 'error' });
        } else {
          setCashoutStatus({ message: `Failed to decode invoice: ${e.message}. Please check the format.`, type: 'error' });
        }
        setCashoutAmount('');
        setIsAmountlessInvoice(false);
      }
    } else if (destination.includes('@') && destination.split('@').length === 2 && destination.split('@')[1].includes('.')) {
      // Lightning Address detected
      setCashoutAmount(''); // Keep amount editable for Lightning Address
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(true);
      setCashoutStatus({ message: 'Lightning Address detected. Please enter the USD amount to cashout.', type: 'info' });
    } else {
      // Neither valid Bolt11 nor Lightning Address
      setCashoutAmount('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(false);
      setCashoutStatus({ message: 'Please enter a valid Bolt11 invoice (lnbc...) or Lightning Address (user@example.com).', type: 'error' });
    }
  }, [cashoutDestination]);

  // --- CASHOUT FORM SUBMISSION HANDLER ---
  const handleSendCashout = async (e) => {
    e.preventDefault();
    setCashoutStatus({ message: '', type: '' }); // Clear previous status

    const username = cashoutUsername.trim();
    const destination = cashoutDestination.trim();
    const amountValue = parseFloat(cashoutAmount);
    const requiresAmountInput = isAmountlessInvoice || isLightningAddressDetected;

    // --- Frontend Validations ---
    if (!username) {
      setCashoutStatus({ message: 'Username is required for record-keeping.', type: 'error' });
      return;
    }
    if (!destination) {
      setCashoutStatus({ message: 'Lightning Invoice or Address is required.', type: 'error' });
      return;
    }
    if (requiresAmountInput && (isNaN(amountValue) || amountValue <= 0)) {
      setCashoutStatus({ message: 'Amount (USD) must be a positive number for this cashout type.', type: 'error' });
      return;
    }
    // If it's a fixed amount invoice, ensure amount is populated
    if (!requiresAmountInput && (isNaN(amountValue) || amountValue <= 0)) {
        setCashoutStatus({ message: 'Invoice detected with no amount. Please re-check the invoice or provide an amount.', type: 'error' });
        return;
    }


    const confirmMessage = `Are you sure you want to send a cashout for ${username} to ${destination}? Amount: ${requiresAmountInput ? `$${amountValue.toFixed(2)} USD` : 'invoice amount'}.`;
    if (!window.confirm(confirmMessage)) {
      setCashoutStatus({ message: 'Cashout cancelled by user.', type: 'info' });
      return;
    }

    setIsSendingCashout(true);

    try {
      const response = await fetch('/api/admin/cashouts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          invoice: destination, // send original string, backend will handle parsing
          amount: requiresAmountInput ? amountValue.toFixed(2) : null, // Only send amount if required
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send cashout');
      }

      setCashoutStatus({
        message: `Cashout initiated! Status: ${data.details.status}. Transaction ID: ${data.cashoutId}. ${parseFloat(data.details.amountBTC).toFixed(8)} BTC ${data.details.amountUSD ? `($${parseFloat(data.details.amountUSD).toFixed(2)} USD)` : ''} sent.`,
        type: 'success'
      });
      // Clear form after successful send
      setCashoutUsername('');
      setCashoutDestination('');
      setCashoutAmount('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(false);
      loadCashoutHistory(); // Refresh history
    } catch (error) {
      console.error('Error sending cashout:', error);
      setCashoutStatus({ message: error.message || 'An unexpected error occurred while sending cashout.', type: 'error' });
    } finally {
      setIsSendingCashout(false);
    }
  };

  if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Redirecting to admin login...</div>;
  }

  return (
    <div className="admin-dashboard"> {/* Reusing admin-dashboard styling */}
      <div className="sidebar">
        <h1>Lucky Paw Admin</h1>
        <a className="nav-btn" href="/admin/dashboard">📋 Orders</a>
        <a className="nav-btn" href="/admin/games">🎮 Games</a>
        <a className="nav-btn" href="/admin/profit-loss">📊 Profit & Loss</a>
        <a className="nav-btn" href="/admin/cashouts">⚡ Cashouts</a> {/* Current page link */}
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>
      <div className="main-content">
        {/* --- CASHOUT SECTION --- */}
        <div className="card mt-lg" style={{ background: '#fff0f5', border: '1px solid #ddd', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>💸 Send Lightning Cashout</h3>
          <form onSubmit={handleSendCashout}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="cashoutUser" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Username (for records):</label>
              <input
                id="cashoutUser"
                type="text"
                className="input"
                value={cashoutUsername}
                onChange={(e) => setCashoutUsername(e.target.value)}
                placeholder="e.g., player123"
                style={{ width: '100%', padding: '0.6rem 0.8rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="cashoutDestination" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Lightning Invoice or Address:</label>
              <input
                id="cashoutDestination"
                type="text"
                className="input"
                value={cashoutDestination}
                onChange={(e) => setCashoutDestination(e.target.value)}
                placeholder="Paste lnbc... invoice OR user@example.com address"
                style={{ width: '100%', padding: '0.6rem 0.8rem', boxSizing: 'border-box' }}
                required
              />
               <small style={{ display: 'block', marginTop: '0.3rem', color: '#777' }}>
                For a Bolt11 invoice (starts with 'lnbc'), the amount might auto-fill. For Lightning Addresses, you must enter the USD amount.
              </small>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="cashoutAmt" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Amount (USD):</label>
              <input
                id="cashoutAmt"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                placeholder="e.g., 10.50"
                required={isAmountlessInvoice || isLightningAddressDetected} // Required only if amount not fixed by invoice
                disabled={cashoutDestination.startsWith('lnbc') && !isAmountlessInvoice && cashoutAmount !== '' && cashoutStatus.type === 'info'} // Disable if fixed amount invoice
                style={{ width: '100%', padding: '0.6rem 0.8rem', boxSizing: 'border-box' }}
              />
              <small style={{ display: 'block', marginTop: '0.3rem', color: '#777' }}>
                This is the USD value that will be converted to sats and sent. For fixed invoices, it's displayed, otherwise you enter it.
              </small>
            </div>
            <button type="submit" className="btn btn-success" disabled={isSendingCashout} style={{ padding: '0.7rem 1.4rem', fontSize: '1.1rem' }}>
              {isSendingCashout ? 'Sending Cashout...' : '⚡ Send Cashout & Record'}
            </button>
            {cashoutStatus.message && (
              <p style={{
                color: cashoutStatus.type === 'error' ? '#d63031' : (cashoutStatus.type === 'info' ? '#2d3436' : '#00b894'),
                marginTop: '1.5rem',
                padding: '1rem',
                background: cashoutStatus.type === 'error' ? '#ffebee' : (cashoutStatus.type === 'info' ? '#e9ecef' : '#e6fffa'),
                border: `1px solid ${cashoutStatus.type === 'error' ? '#d63031' : (cashoutStatus.type === 'info' ? '#ced4da' : '#00b894')}`,
                borderRadius: '4px',
                wordBreak: 'break-word',
                fontSize: '0.95rem'
              }}>
                {cashoutStatus.message}
              </p>
            )}
          </form>
        </div>

        {/* --- CASHOUT HISTORY SECTION --- */}
        <div className="card mt-lg" style={{ background: '#f8f9fa', border: '1px solid #ddd', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>💰 Lightning Cashout History</h3>
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
                    <th>Status</th>
                    <th>Time</th>
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
                      <td style={{
                        color: cashout.status === 'completed' ? 'green' :
                               cashout.status === 'pending' ? '#ff9800' :
                               '#d63031'
                      }}>
                        {cashout.status}
                      </td>
                      <td>{new Date(cashout.time).toLocaleString()}</td>
                      <td>{cashout.paymentGatewayId || 'N/A'}</td>
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