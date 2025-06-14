// src/pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as bolt11 from 'lightning-invoice';

// Helper to format Sats
const formatSats = (sats) => new Intl.NumberFormat().format(sats);

export default function AdminCashouts() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
            try {
                const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                    setIsAdmin(true);
                } else {
                    await firebaseAuth.signOut();
                    router.replace('/admin');
                }
            } catch (e) {
                console.error("Auth check error:", e);
                await firebaseAuth.signOut();
                router.replace('/admin');
            }
        } else {
            router.replace('/admin');
        }
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);


  const logout = useCallback(async () => {
    await firebaseAuth.signOut();
    router.push('/admin');
  }, [router]);

  // --- Load Cashout History ---
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const adminIdToken = await firebaseAuth.currentUser.getIdToken();
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
      setHistory(data.sort((a, b) => {
        const timeA = a.time?.seconds ? new Date(a.time.seconds * 1000) : new Date(a.time);
        const timeB = b.time?.seconds ? new Date(b.time.seconds * 1000) : new Date(b.time);
        return timeB - timeA;
      }));
    } catch (err) {
      setStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadHistory();
      const interval = setInterval(loadHistory, 15000); // Refresh every 15s
      return () => clearInterval(interval);
    }
  }, [isAdmin, loadHistory]);

  // --- Real-time Price Quote ---
  const fetchQuote = useCallback(async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      setLiveQuote({ sats: 0, btcPrice: 0 });
      return;
    }
    try {
      const adminIdToken = await firebaseAuth.currentUser.getIdToken();
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
        const decoded = bolt11.decode(dest);
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
        console.error("Error decoding Bolt11 invoice:", e);
        if (e.message.includes('Assertion failed')) {
            setStatus({ message: 'Invoice decoding failed. Please ensure the entire invoice is copied correctly without any modifications.', type: 'error' });
        } else if (e.message.includes('Invalid bech32')) {
            setStatus({ message: 'Invalid invoice format. Make sure it starts with "lnbc" and is fully copied.', type: 'error' });
        } else {
            setStatus({ message: `Failed to decode invoice: ${e.message}. Please check the format.`, type: 'error' });
        }
        setUsdAmount('');
        setIsAmountless(false);
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
      const adminIdToken = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch('/api/admin/cashouts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
        body: JSON.stringify({
          username,
          destination,
          usdAmount: (isAmountless || isLnAddress) ? usdAmount : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStatus({
        message: `Success! ${data.details.amountSats ? formatSats(data.details.amountSats) : ''} sats sent. Tx ID: ${data.details.paymentGatewayId}`,
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

  if (authLoading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Authenticating...</div>;
  }

  if (!isAdmin) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Access Denied.</div>;
  }

  return (
    <div className="admin-dashboard-container">
      <Head>
        <title>Admin - Lightning Cashouts</title>
      </Head>
       <header className="admin-header">
          <h1>Lightning Cashouts</h1>
          <nav>
              <ul className="admin-nav">
                  <li><a href="/admin/dashboard">Dashboard</a></li>
                  <li><a href="/admin/cashouts" className="active">Cashouts</a></li>
                  <li><a href="/admin/games">Games</a></li>
                  <li><a href="/admin/agents">Agents</a></li>
                  <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                  <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
              </ul>
          </nav>
      </header>
      <main className="admin-main-content">
        <div className="card">
          <h3>💸 Send Lightning Cashout</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g., player123" required />
            </div>
            <div className="form-group">
              <label>Lightning Invoice or Address</label>
              <input className="input" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Paste lnbc... invoice or user@example.com" required />
            </div>
            <div className="form-group">
              <label>Amount (USD)</label>
              <input
                className="input"
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
                <div className="alert alert-info">
                    You will send approximately <strong>{formatSats(liveQuote.sats)} sats</strong>.
                    <small> (Current Rate: ~${new Intl.NumberFormat().format(liveQuote.btcPrice)}/BTC)</small>
                </div>
            )}

            <button type="submit" className="btn btn-success" disabled={isSending}>
              {isSending ? 'Processing...' : '⚡ Send Cashout'}
            </button>
            {status.message && (
              <p className={`alert ${status.type === 'success' ? 'alert-success' : status.type === 'error' ? 'alert-danger' : 'alert-info'} mt-md`}>
                {status.message}
              </p>
            )}
          </form>
        </div>

        <div className="card mt-lg">
          <h3>💰 Lightning Cashout History</h3>
          {isLoadingHistory ? <p>Loading history...</p> : history.length === 0 ? <p>No cashouts recorded yet.</p> : (
            <div className="table-responsive">
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
                      <td><span className={`status-badge status-${tx.status}`}>{tx.status}</span></td>
                      <td>{tx.time?.seconds ? new Date(tx.time.seconds * 1000).toLocaleString() : new Date(tx.time).toLocaleString()}</td>
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
      </main>
    </div>
  );
}