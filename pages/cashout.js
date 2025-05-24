// pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice';

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
    if (localStorage.getItem('admin_auth') !== '1') {
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
      const res = await fetch('/api/admin/cashouts/history'); // New dedicated history endpoint
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setHistory(data.sort((a, b) => new Date(b.time) - new Date(a.time)));
    } catch (err) {
      setStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [loadHistory]);

  // --- Real-time Price Quote ---
  const fetchQuote = useCallback(async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
        setLiveQuote({sats: 0, btcPrice: 0});
        return;
    }
    try {
        const res = await fetch(`/api/admin/cashouts/quote?amount=${amount}`);
        const data = await res.json();
        if(res.ok) {
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
        const decoded = bolt11.decode(dest);
        const sats = decoded.satoshis || (decoded.millisatoshis ? parseInt(decoded.millisatoshis) / 1000 : null);
        if (sats && sats > 0) {
          setIsAmountless(false);
          setIsLnAddress(false);
          fetchQuote(sats / 100000000 * 30000); // Approximate for initial display
          setStatus({ message: `Fixed amount invoice detected: ${formatSats(sats)} sats.`, type: 'info' });
        } else {
          setIsAmountless(true);
          setStatus({ message: 'Amountless invoice detected. Enter a USD amount.', type: 'info' });
        }
      } catch (e) {
        setStatus({ message: `Invalid Bolt11 invoice format: ${e.message}`, type: 'error' });
      }
    } else if (dest.includes('@')) {
      setIsLnAddress(true);
      setStatus({ message: 'Lightning Address detected. Enter a USD amount.', type: 'info' });
    } else {
      setStatus({ message: 'Not a valid Bolt11 invoice or Lightning Address.', type: 'error' });
    }
  }, [destination, fetchQuote]);

  // Handle amount change for live quote
  useEffect(() => {
    if(isAmountless || isLnAddress) {
        const handler = setTimeout(() => {
            fetchQuote(usdAmount);
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
      setStatus({ message: 'A positive USD amount is required.', type: 'error' });
      return;
    }

    if (!window.confirm(`Proceed with this cashout for ${username}?`)) return;

    setIsSending(true);
    setStatus({ message: 'Processing... Please do not close this window.', type: 'info' });

    try {
      const res = await fetch('/api/admin/cashouts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } finally {
      setIsSending(false);
    }
  };

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
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Lightning Invoice or Address</label>
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdAmount}
                onChange={(e) => setUsdAmount(e.target.value)}
                required={isAmountless || isLnAddress}
                disabled={!isAmountless && !isLnAddress}
              />
            </div>

            {liveQuote.sats > 0 && (
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
          {isLoadingHistory ? <p>Loading history...</p> : (
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
                      <td title={tx.destination}>{tx.destination.substring(0, 25)}...</td>
                      <td>${tx.amountUSD?.toFixed(2)} ({formatSats(tx.amountSats)} sats)</td>
                      <td className={`status-${tx.status}`}>{tx.status}</td>
                      <td>{new Date(tx.time).toLocaleString()}</td>
                      <td>
                        {tx.paymentGatewayId ? (
                           <a href={`https://mempool.space/tx/${tx.paymentGatewayId}`} target="_blank" rel="noopener noreferrer">
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