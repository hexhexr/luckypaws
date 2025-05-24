// pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice'; // Import bolt11 library

export default function AdminCashouts() {
  const router = useRouter();

  // --- STATES FOR CASHOUT ---
  const [cashoutUsername, setCashoutUsername] = useState('');
  const [cashoutDestination, setCashoutDestination] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [isSendingCashout, setIsSendingCashout] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState({ message: '', type: '' });
  const [isAmountlessInvoice, setIsAmountlessInvoice] = useState(false);
  const [isLightningAddressDetected, setIsLightningAddressDetected] = useState(false);

  // --- STATES FOR CASHOUT HISTORY ---
  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [loadingCashoutHistory, setLoadingCashoutHistory] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin');
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

  // Function to load cashout history
  const loadCashoutHistory = useCallback(async () => {
    setLoadingCashoutHistory(true);
    try {
      const res = await fetch('/api/admin/cashouts'); // This endpoint will fetch cashout history
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

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') === '1') {
      loadCashoutHistory();
      const cashoutInterval = setInterval(() => loadCashoutHistory(), 10000);
      return () => {
        clearInterval(cashoutInterval);
      };
    }
  }, [loadCashoutHistory]);

  // Effect to decode invoice and set amount
  useEffect(() => {
    setCashoutStatus({ message: '', type: '' });
    setCashoutAmount('');
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
          const estimatedUsd = (invoiceSats / 3000); // Example rate, adjust as needed. Server will do actual conversion.
          setCashoutAmount(estimatedUsd.toFixed(2));
          setIsAmountlessInvoice(false);
          setCashoutStatus({ message: `Fixed amount invoice detected: ${invoiceSats} sats (~$${estimatedUsd.toFixed(2)})`, type: 'info' });
        } else {
          setCashoutAmount('');
          setIsAmountlessInvoice(true);
          setCashoutStatus({ message: 'Amountless invoice detected. Please enter the USD amount to cashout.', type: 'info' });
        }
      } catch (e) {
        setCashoutAmount('');
        setIsAmountlessInvoice(false);
        setCashoutStatus({ message: 'Invalid Bolt11 Lightning Invoice format. Please ensure it is a valid invoice.', type: 'error' });
      }
    } else if (destination.includes('@') && destination.split('@').length === 2 && destination.split('@')[1].includes('.')) {
      setCashoutAmount('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(true);
      setCashoutStatus({ message: 'Lightning Address detected. Please enter the USD amount to cashout.', type: 'info' });
    } else {
      setCashoutAmount('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(false);
      setCashoutStatus({ message: 'Please enter a valid Bolt11 invoice (lnbc...) or Lightning Address (user@example.com).', type: 'info' });
    }
  }, [cashoutDestination]);

  // --- CASHOUT HANDLER ---
  const handleSendCashout = async (e) => {
    e.preventDefault();
    setCashoutStatus({ message: '', type: '' });

    if (!cashoutUsername.trim()) {
      setCashoutStatus({ message: 'Username is required for record-keeping.', type: 'error' });
      return;
    }
    if (!cashoutDestination.trim()) {
      setCashoutStatus({ message: 'Lightning Invoice or Address is required.', type: 'error' });
      return;
    }

    const amountValue = parseFloat(cashoutAmount);
    const requiresAmount = isAmountlessInvoice || isLightningAddressDetected;
    if (requiresAmount) {
        if (isNaN(amountValue) || amountValue <= 0) {
            setCashoutStatus({ message: 'Amount (USD) must be a positive number for this type of cashout.', type: 'error' });
            return;
        }
    }

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
          invoice: cashoutDestination.trim(),
          amount: requiresAmount ? amountValue.toFixed(2) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send cashout');
      }

      setCashoutStatus({
        message: `Cashout initiated! Status: ${data.details.status}. Transaction ID: ${data.cashoutId}. ${data.details.amountBTC} BTC ${data.details.amountUSD ? `($${data.details.amountUSD} USD)` : ''} sent.`,
        type: 'success'
      });
      setCashoutUsername('');
      setCashoutDestination('');
      setCashoutAmount('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(false);
      loadCashoutHistory();
    } catch (error) {
      setCashoutStatus({ message: error.message || 'An error occurred while sending cashout.', type: 'error' });
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
                required={isAmountlessInvoice || isLightningAddressDetected}
                disabled={cashoutDestination.startsWith('lnbc') && !isAmountlessInvoice && cashoutAmount !== ''}
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

        {/* --- CASHOUT HISTORY SECTION --- */}
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
                      <td style={{
                        color: cashout.status === 'completed' ? 'green' :
                               cashout.status === 'pending' ? '#ff9800' :
                               '#d63031'
                      }}>
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
      </div>
    </div>
  );
}