// pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice'; // Ensure this library is installed: npm install lightning-invoice

// --- Helper to format Sats ---
const formatSats = (sats) => new Intl.NumberFormat().format(sats);

export default function AdminCashouts() {
  const router = useRouter();

  // --- FORM STATES ---
  const [username, setUsername] = useState('');
  const [destination, setDestination] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isAmountless, setIsAmountless] = useState(false);
  const [isLnAddress, setIsLnAddress] = useState(false);
  const [liveQuote, setLiveQuote] = useState({ sats: 0, btcPrice: 0 });

  // --- HISTORY STATES ---
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // --- Auth & Logout ---
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_auth') !== '1') {
      router.replace('/admin');
    }
  }, [router]);

  const logout = useCallback(async () => {
    localStorage.removeItem('admin_auth');
    router.replace('/admin');
  }, [router]);

  // --- Load Cashout History ---
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      // You will need to send the token in your frontend fetch calls for protected API routes
      const adminIdToken = localStorage.getItem('admin_id_token'); // Assuming you store this
      const res = await fetch('/api/admin/cashouts/history', {
        headers: {
          'Authorization': `Bearer ${adminIdToken}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to load');
      }
      const data = await res.json();
      setHistory(data.sort((a, b) => new Date(b.time) - new Date(a.time)));
    } catch (err) {
      setStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' });
      // If error is unauthorized, redirect to login
      if (err.message.includes('Unauthorized') || err.message.includes('Forbidden')) {
        router.replace('/admin');
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, [router]);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [loadHistory]);

  // --- Real-time Price Quote ---
  const fetchQuote = useCallback(async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      setLiveQuote({ sats: 0, btcPrice: 0 });
      return;
    }
    try {
      const adminIdToken = localStorage.getItem('admin_id_token'); // Assuming you store this
      const res = await fetch(`/api/admin/cashouts/quote?amount=${amount}`, {
        headers: {
          'Authorization': `Bearer ${adminIdToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setLiveQuote({ sats: data.sats, btcPrice: data.btcPrice });
      }
    } catch (error) {
      console.error("Quote fetch error:", error);
    }
  }, []);

  // --- Destination Parser ---
  useEffect(() => {
    setStatus({ message: '', type: '' });
    setUsdAmount('');
    setIsAmountless(false);
    setIsLnAddress(false);
    const dest = destination.trim();

    if (!dest) {
      setStatus({ message: 'Enter a Lightning Invoice or Address.', type: 'info' });
      return;
    }

    if (dest.startsWith('lnbc')) {
      try {
        const decoded = bolt11.decode(dest); // This is where the error occurs
        const sats = decoded.satoshis || (decoded.millisatoshis ? parseInt(decoded.millisatoshis) / 1000 : null);

        if (sats && sats > 0) {
          // Fixed amount invoice logic
          const estimatedUsd = (sats / 100000000) * (liveQuote.btcPrice || 60000);
          setUsdAmount(estimatedUsd.toFixed(2));
          setIsAmountless(false);
          setIsLnAddress(false);
          setStatus({ message: `Fixed amount invoice detected: ${formatSats(sats)} sats.`, type: 'info' });
        } else {
          // Amountless invoice logic
          setIsAmountless(true);
          setStatus({ message: 'Amountless invoice detected. Please enter the USD amount.', type: 'info' });
        }
      } catch (e) {
        // *** MODIFICATION START ***
        console.error("Error decoding Bolt11 invoice:", e);
        if (e.message.includes('Assertion failed')) {
            // Provide a much more helpful error message for this specific case
            setStatus({ message: 'Invoice decoding failed. Please ensure the entire invoice is copied correctly without any modifications.', type: 'error' });
        } else if (e.message.includes('Invalid bech32')) {
            setStatus({ message: 'Invalid invoice format. Make sure it starts with "lnbc" and is fully copied.', type: 'error' });
        } else {
            // General fallback error
            setStatus({ message: `Failed to decode invoice: ${e.message}. Please check the format.`, type: 'error' });
        }
        setUsdAmount('');
        setIsAmountless(false);
        // *** MODIFICATION END ***
      }
    } else if (dest.includes('@') && dest.split('@').length === 2 && dest.split('@')[1].includes('.')) {
      setIsLnAddress(true);
      setStatus({ message: 'Lightning Address detected. Please enter the USD amount.', type: 'info' });
    } else {
      setStatus({ message: 'Not a valid Bolt11 invoice (lnbc...) or Lightning Address (user@domain.com).', type: 'error' });
    }
  }, [destination, fetchQuote, liveQuote.btcPrice]);


  // Handle amount change for live quote
  useEffect(() => {
    if (isAmountless || isLnAddress) {
      const handler = setTimeout(() => {
        if (parseFloat(usdAmount) > 0) {
          fetchQuote(usdAmount);
        }
      }, 500); // Debounce
      return () => clearTimeout(handler);
    }
  }, [usdAmount, isAmountless, isLnAddress, fetchQuote]);


  // --- SUBMIT HANDLER ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ message: '', type: '' });

    if (!username || !destination) {
      setStatus({ message: 'Username and Destination are required.', type: 'error' });
      return;
    }
    if ((isAmountless || isLnAddress) && (!usdAmount || parseFloat(usdAmount) <= 0)) {
      setStatus({ message: 'A positive USD amount is required for this type of cashout.', type: 'error' });
      return;
    }

    const confirmMessage = `Are you sure you want to send a cashout for ${username}?`;
    if (!window.confirm(confirmMessage)) {
      setStatus({ message: 'Cashout cancelled.', type: 'info' });
      return;
    }

    setIsSending(true);
    setStatus({ message: 'Processing... Please do not close this window.', type: 'info' });

    try {
      // You must send the Firebase ID token for server-side verification
      const adminIdToken = localStorage.getItem('admin_id_token'); // Make sure you store this after admin login
      if (!adminIdToken) {
        throw new Error('Admin authentication token not found. Please log in again.');
      }

      const res = await fetch('/api/admin/cashouts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminIdToken}` // Send the token in the Authorization header
        },
        body: JSON.stringify({
          username,
          destination,
          usdAmount: (isAmountless || isLnAddress) ? usdAmount : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStatus({
        message: `Success! ${formatSats(data.details.amountSats)} sats sent. Tx ID: ${data.details.paymentGatewayId}`,
        type: 'success'
      });
      setUsername('');
      setDestination('');
      setUsdAmount('');
      loadHistory();
    } catch (error) {
      setStatus({ message: `Error: ${error.message}`, type: 'error' });
      if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        router.replace('/admin'); // Redirect on auth failure
      }
    } finally {
      setIsSending(false);
    }
  };

  // --- Render component ---
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
        <a className="nav-btn active" href="/admin/cashouts">⚡ Cashouts</a>
        <button className="nav-btn" onClick={logout}>🚪 Logout</button>
      </div>
      <div className="main-content">
        <div className="card" style={{ background: '#fff' }}>
          <h3>💸 Send Lightning Cashout</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g., player123" required />
            </div>
            <div className="form-group">
              <label>Lightning Invoice or Address</label>
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Paste lnbc... invoice or user@example.com" required />
            </div>
            <div className="form-group">
              <label>Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdAmount}
                onChange={(e) => setUsdAmount(e.target.value)}
                placeholder="e.g., 10.50"
                required={isAmountless || isLnAddress}
                disabled={!isAmountless && !isLnAddress}
              />
            </div>

            {(isAmountless || isLnAddress) && liveQuote.sats > 0 && (
                <div className="quote-display">
                    You will send approximately <strong>{formatSats(liveQuote.sats)} sats</strong>.
                    <small> (Current Rate: ~${new Intl.NumberFormat().format(liveQuote.btcPrice)}/BTC)</small>
                </div>
            )}

            <button type="submit" className="btn btn-success" disabled={isSending}>
              {isSending ? 'Processing...' : '⚡ Send Cashout'}
            </button>
            {status.message && (
              <p className={`status-message ${status.type}`}>
                {status.message}
              </p>
            )}
          </form>
        </div>

        <div className="card">
          <h3>💰 Lightning Cashout History</h3>
          {isLoadingHistory ? <p>Loading history...</p> : history.length === 0 ? <p>No cashouts recorded yet.</p> : (
            <div className="orders-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Destination</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Gateway ID</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.username}</td>
                      <td title={tx.destination}>{tx.destination ? tx.destination.substring(0, 25) + '...' : 'N/A'}</td>
                      <td>{tx.amountUSD ? `$${tx.amountUSD.toFixed(2)}` : ''} ({tx.amountSats ? formatSats(tx.amountSats) + ' sats' : 'N/A'})</td>
                      <td className={`status-${tx.status}`}>{tx.status}</td>
                      <td>{new Date(tx.time).toLocaleString()}</td>
                      <td>
                        {tx.paymentGatewayId ? (
                           <a href={`https://mempool.space/tx/${tx.paymentGatewayId}`} target="_blank" rel="noopener noreferrer" title={tx.paymentGatewayId}>
                            {tx.paymentGatewayId.substring(0, 15)}...
                          </a>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        /* Add some basic styling for the new elements */
        .quote-display {
            padding: 10px;
            margin: 10px 0;
            background: #e9f7ef;
            border-left: 4px solid #2ecc71;
            font-size: 0.95rem;
        }
        .status-message {
            margin-top: 15px;
            padding: 12px;
            border-radius: 4px;
            word-break: break-word;
        }
        .status-message.info { background-color: #e0f7fa; border-left: 4px solid #00bcd4; }
        .status-message.success { background-color: #e8f5e9; border-left: 4px solid #4caf50; }
        .status-message.error { background-color: #ffebee; border-left: 4px solid #f44336; }
        .status-completed { color: #2e7d32; font-weight: bold; }
        .status-pending, .status-initializing { color: #f57c00; font-weight: bold; }
        .status-failed { color: #c62828; font-weight: bold; }
      `}</style>
    </div>
  );
}