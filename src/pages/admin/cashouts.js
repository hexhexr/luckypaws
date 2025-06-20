// src/pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as bolt11 from 'lightning-invoice';

const formatSats = (sats) => new Intl.NumberFormat().format(sats);

export default function AdminCashouts() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState('');
  const [destination, setDestination] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isAmountless, setIsAmountless] = useState(false);
  const [isLnAddress, setIsLnAddress] = useState(false);
  const [liveQuote, setLiveQuote] = useState({ sats: 0, btcPrice: 0 });
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
            try {
                const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                    setIsAdmin(true);
                } else {
                    router.replace('/admin');
                }
            } catch (e) {
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

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const adminIdToken = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch('/api/admin/cashouts/history', {
        headers: { 'Authorization': `Bearer ${adminIdToken}` }
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to load');
      const data = await res.json();
      setHistory(data.sort((a, b) => (new Date(b.time) - new Date(a.time))));
    } catch (err) {
      setStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadHistory();
      const interval = setInterval(loadHistory, 15000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, loadHistory]);

  const fetchQuote = useCallback(async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      setLiveQuote({ sats: 0, btcPrice: 0 });
      return;
    }
    try {
      const adminIdToken = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch(`/api/admin/cashouts/quote?amount=${amount}`, {
        headers: { 'Authorization': `Bearer ${adminIdToken}` }
      });
      const data = await res.json();
      if (res.ok) setLiveQuote({ sats: data.sats, btcPrice: data.btcPrice });
    } catch (error) {
      console.error("Quote fetch error:", error);
    }
  }, []);

  useEffect(() => {
    setStatus({ message: '', type: '' });
    const dest = destination.trim();
    if (!dest) return;

    if (dest.startsWith('lnbc')) {
      try {
        const decoded = bolt11.decode(dest);
        const sats = decoded.satoshis || (decoded.millisatoshis ? parseInt(decoded.millisatoshis) / 1000 : null);
        if (sats > 0) {
          const estimatedUsd = (sats / 100000000) * (liveQuote.btcPrice || 60000);
          setUsdAmount(estimatedUsd.toFixed(2));
          setIsAmountless(false);
          setIsLnAddress(false);
          setStatus({ message: `Fixed amount invoice: ${formatSats(sats)} sats.`, type: 'info' });
        } else {
          setIsAmountless(true);
          setIsLnAddress(false);
          setStatus({ message: 'Amountless invoice. Enter USD amount.', type: 'info' });
        }
      } catch (e) {
        setStatus({ message: `Invalid invoice: ${e.message}`, type: 'error' });
      }
    } else if (dest.includes('@')) {
      setIsLnAddress(true);
      setIsAmountless(false);
      setStatus({ message: 'Lightning Address. Enter USD amount.', type: 'info' });
    } else {
      setIsLnAddress(false);
      setIsAmountless(false);
    }
  }, [destination, liveQuote.btcPrice]);

  useEffect(() => {
    if (isAmountless || isLnAddress) {
      const handler = setTimeout(() => {
        if (parseFloat(usdAmount) > 0) fetchQuote(usdAmount);
      }, 500);
      return () => clearTimeout(handler);
    }
  }, [usdAmount, isAmountless, isLnAddress, fetchQuote]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !destination || ((isAmountless || isLnAddress) && (!usdAmount || parseFloat(usdAmount) <= 0))) {
      setStatus({ message: 'All fields are required.', type: 'error' });
      return;
    }
    if (!window.confirm(`Confirm cashout for ${username}?`)) return;
    setIsSending(true);
    setStatus({ message: 'Processing...', type: 'info' });
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
      setStatus({ message: `Success! Tx ID: ${data.details.paymentGatewayId}`, type: 'success' });
      setUsername(''); setDestination(''); setUsdAmount('');
      loadHistory();
    } catch (error) {
      setStatus({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading) return <div className="loading-screen">Authenticating...</div>;
  if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

  return (
    <div className="admin-dashboard-container">
      <Head><title>Admin - Lightning Cashouts</title></Head>
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
          <h2 class="card-header">💸 Send Lightning Cashout</h2>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="form-group">
                <label>Username</label>
                <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g., player123" required />
              </div>
              <div className="form-group">
                <label>Lightning Invoice or Address</label>
                <input className="input" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Paste lnbc... or user@example.com" required />
              </div>
              <div className="form-group">
                <label>Amount (USD)</label>
                <input className="input" type="number" step="0.01" min="0.01" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} placeholder="e.g., 10.50" required={isAmountless || isLnAddress} disabled={!isAmountless && !isLnAddress} />
              </div>
              {(isAmountless || isLnAddress) && liveQuote.sats > 0 && (
                  <div className="alert alert-info form-full-width">
                      You will send ~<strong>{formatSats(liveQuote.sats)} sats</strong>.
                  </div>
              )}
              <div className="form-group form-full-width">
                <button type="submit" className="btn btn-success btn-full-width" disabled={isSending}>
                  {isSending ? 'Processing...' : '⚡ Send Cashout'}
                </button>
              </div>
            </form>
            {status.message && (
                <div className={`alert ${status.type === 'success' ? 'alert-success' : status.type === 'error' ? 'alert-danger' : 'alert-info'} mt-md`}>
                  {status.message}
                </div>
            )}
          </div>
        </div>
        <div className="card mt-lg">
          <h2 class="card-header">💰 Lightning Cashout History</h2>
          <div class="card-body">
            {isLoadingHistory ? <p>Loading history...</p> : history.length === 0 ? <p>No cashouts recorded yet.</p> : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Username</th><th>Destination</th><th>Amount</th><th>Status</th><th>Time</th><th>Gateway ID</th></tr></thead>
                  <tbody>
                    {history.map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.username}</td>
                        <td title={tx.destination}>{tx.destination?.substring(0, 25)}...</td>
                        <td>{tx.amountUSD ? `$${tx.amountUSD.toFixed(2)}` : ''}</td>
                        <td><span className={`status-badge status-${tx.status}`}>{tx.status}</span></td>
                        <td>{new Date(tx.time).toLocaleString()}</td>
                        {/* --- FIX: Removed broken hyperlink --- */}
                        <td title={tx.paymentGatewayId}>{tx.paymentGatewayId?.substring(0, 15)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}